import { v4 as uuidv4 } from 'uuid';
import {
  MIN_PLAYERS, MAX_PLAYERS, TOKEN_STATES,
  GAME_STATES, DEFAULT_HOST_SETTINGS
} from '../shared/gameLogic.js';
import { GameEngine } from './gameEngine.js';

const rooms = {};

// Helper: broadcast personalised game_update to every human in the room
function broadcastGameState(io, room) {
  room.players.forEach(pl => {
    if (pl.status === 'ONLINE' && !pl.isBot) {
      io.to(pl.socketId).emit('game_update', room.engine.getDetailedStateFor(pl.username));
    }
  });
}

export const setupSocketEvents = (io) => {

  // ── Bot / timeout tick ────────────────────────────────────────────────────
  setInterval(() => {
    Object.values(rooms).forEach(room => {
      if (room.engine && room.gameState === GAME_STATES.PLAYING) {
        const before = room.engine.turnIndex;
        room.engine.update(io, room.id);
        // If turn changed (bot moved) → send personalised updates
        if (room.engine.turnIndex !== before) {
          broadcastGameState(io, room);
        }
      }
    });
  }, 1000);

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ────────────────────────────────────────────────────────────────────────
    // ROOM CREATION
    // ────────────────────────────────────────────────────────────────────────
    socket.on('create_room', ({ username }) => {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      rooms[roomId] = {
        id:        roomId,
        settings:  { ...DEFAULT_HOST_SETTINGS },
        players:   [],
        tokens:    {},
        gameState: GAME_STATES.LOBBY,
        engine:    null,
      };

      const newPlayer = {
        id: uuidv4(), username, socketId: socket.id,
        isHost: true, isBot: false, status: 'ONLINE',
      };
      rooms[roomId].players.push(newPlayer);
      socket.roomId = roomId;
      socket.join(roomId);

      socket.emit('room_created', { roomId });
      socket.emit('lobby_joined', {
        players:   rooms[roomId].players,
        settings:  rooms[roomId].settings,
        isHost:    true,
        gameState: rooms[roomId].gameState,
        roomId,
      });
    });

    // ────────────────────────────────────────────────────────────────────────
    // JOIN LOBBY
    // ────────────────────────────────────────────────────────────────────────
    socket.on('join_lobby', ({ username, roomId }) => {
      if (!roomId || !rooms[roomId]) {
        return socket.emit('error', 'Room not found.');
      }
      const room = rooms[roomId];

      if (room.players.length >= MAX_PLAYERS) {
        return socket.emit('error', 'Room is full.');
      }

      // Reconnect existing player
      const existing = room.players.find(p => p.username === username);
      if (existing) {
        existing.socketId = socket.id;
        existing.status   = 'ONLINE';
        socket.roomId     = roomId;
        socket.join(roomId);

        socket.emit('lobby_joined', {
          players:   room.players,
          settings:  room.settings,
          isHost:    existing.isHost,
          gameState: room.gameState,
          roomId,
        });
        if (room.engine) {
          socket.emit('game_update', room.engine.getDetailedStateFor(username));
        }
        io.to(roomId).emit('player_list_update', room.players);
        return;
      }

      // New player
      const newPlayer = {
        id: uuidv4(), username, socketId: socket.id,
        isHost: false, isBot: false, status: 'ONLINE',
      };
      room.players.push(newPlayer);
      socket.roomId = roomId;
      socket.join(roomId);

      socket.emit('lobby_joined', {
        players:   room.players,
        settings:  room.settings,
        isHost:    false,
        gameState: room.gameState,
        roomId,
      });
      io.to(roomId).emit('player_list_update', room.players);
      io.to(roomId).emit('notification', `${username} joined the game.`);
    });

    // ────────────────────────────────────────────────────────────────────────
    // HOST CONTROLS
    // ────────────────────────────────────────────────────────────────────────
    socket.on('add_bot', () => {
      const room = rooms[socket.roomId];
      if (!room) return;
      const p = room.players.find(pl => pl.socketId === socket.id);
      if (!p?.isHost || room.gameState === GAME_STATES.PLAYING) return;
      if (room.players.length >= MAX_PLAYERS) return;

      const botCount = room.players.filter(pl => pl.isBot).length;
      room.players.push({
        id:         uuidv4(),
        username:   `Bot_${botCount + 1}`,
        socketId:   `bot_${uuidv4()}`,
        isHost:     false,
        isBot:      true,
        archetype:  Math.random() > 0.5 ? 'AGGRESSIVE' : 'SAFE',
        status:     'ONLINE',
      });
      io.to(socket.roomId).emit('player_list_update', room.players);
    });

    socket.on('kick_player', (username) => {
      const room = rooms[socket.roomId];
      if (!room) return;
      const p = room.players.find(pl => pl.socketId === socket.id);
      if (!p?.isHost) return;
      room.players = room.players.filter(pl => pl.username !== username);
      io.to(socket.roomId).emit('player_list_update', room.players);
      if (room.engine) room.engine.handlePlayerExit(username);
    });

    socket.on('update_settings', (newSettings) => {
      const room = rooms[socket.roomId];
      if (!room) return;
      const p = room.players.find(pl => pl.socketId === socket.id);
      if (!p?.isHost || room.gameState === GAME_STATES.PLAYING) return;
      room.settings = { ...room.settings, ...newSettings };
      io.to(socket.roomId).emit('settings_updated', room.settings);
    });

    socket.on('generate_invite', () => {
      const room = rooms[socket.roomId];
      if (!room) return;
      const p = room.players.find(pl => pl.socketId === socket.id);
      if (!p?.isHost) return;
      const token = uuidv4();
      room.tokens[token] = TOKEN_STATES.UNUSED;
      socket.emit('invite_generated', token);
      socket.emit('tokens_update', room.tokens);
    });

    // ────────────────────────────────────────────────────────────────────────
    // GAME FLOW
    // ────────────────────────────────────────────────────────────────────────
    socket.on('start_game', () => {
      const room = rooms[socket.roomId];
      if (!room) return;
      const p = room.players.find(pl => pl.socketId === socket.id);
      if (!p?.isHost) return;
      if (room.players.length < room.settings.minPlayers) {
        return socket.emit('error', `Need at least ${room.settings.minPlayers} players.`);
      }

      room.gameState = GAME_STATES.PLAYING;
      room.engine    = new GameEngine(room.players, room.settings);
      room.engine.start();

      io.to(socket.roomId).emit('game_started');
      broadcastGameState(io, room);
    });

    socket.on('play_card', ({ cardId, selectedColor }) => {
      const room = rooms[socket.roomId];
      if (!room?.engine) return;
      const p = room.players.find(pl => pl.socketId === socket.id);
      if (!p) return;

      const success = room.engine.playCard(p.username, cardId, selectedColor);
      if (success) {
        broadcastGameState(io, room);
        io.to(socket.roomId).emit('sound_effect', 'play');
      } else {
        socket.emit('error', 'Invalid play!');
        socket.emit('sound_effect_local', 'error');
      }
    });

    socket.on('draw_card', () => {
      const room = rooms[socket.roomId];
      if (!room?.engine) return;
      const p = room.players.find(pl => pl.socketId === socket.id);
      if (!p) return;

      room.engine.drawCard(p.username);
      broadcastGameState(io, room);
      io.to(socket.roomId).emit('sound_effect', 'draw');
    });

    socket.on('pass_turn', () => {
      const room = rooms[socket.roomId];
      if (!room?.engine) return;
      const p = room.players.find(pl => pl.socketId === socket.id);
      if (!p) return;

      room.engine.passTurn(p.username);
      broadcastGameState(io, room);
    });

    // ── Jump-in ───────────────────────────────────────────────────────────────
    socket.on('jump_in', ({ cardId }) => {
      const room = rooms[socket.roomId];
      if (!room?.engine) return;
      const p = room.players.find(pl => pl.socketId === socket.id);
      if (!p) return;

      const success = room.engine.jumpIn(p.username, cardId);
      if (success) {
        broadcastGameState(io, room);
        io.to(socket.roomId).emit('sound_effect', 'play');
        io.to(socket.roomId).emit('jump_in_event', { username: p.username });
      }
    });

    // ── UNO call ──────────────────────────────────────────────────────────────
    socket.on('call_uno', () => {
      const room = rooms[socket.roomId];
      if (!room?.engine) return;
      const p = room.players.find(pl => pl.socketId === socket.id);
      if (!p) return;

      room.engine.callUno(p.username);
      io.to(socket.roomId).emit('uno_called', p.username);
      io.to(socket.roomId).emit('sound_effect', 'uno');
      broadcastGameState(io, room);
    });

    // ── Catch UNO ─────────────────────────────────────────────────────────────
    socket.on('catch_uno', ({ targetUsername }) => {
      const room = rooms[socket.roomId];
      if (!room?.engine) return;
      const catcher = room.players.find(pl => pl.socketId === socket.id);
      if (!catcher) return;

      const caught = room.engine.catchUno(catcher.username, targetUsername);
      if (caught) {
        io.to(socket.roomId).emit('uno_caught', { catcher: catcher.username, target: targetUsername });
        io.to(socket.roomId).emit('sound_effect', 'error');
        broadcastGameState(io, room);
      }
    });

    // ── Return to lobby ────────────────────────────────────────────────────────
    socket.on('return_to_lobby', () => {
      const room = rooms[socket.roomId];
      if (!room) return;
      const p = room.players.find(pl => pl.socketId === socket.id);
      if (!p?.isHost) return;

      room.gameState = GAME_STATES.LOBBY;
      room.engine    = null;
      io.to(socket.roomId).emit('lobby_joined', {
        players:   room.players,
        settings:  room.settings,
        isHost:    true,
        gameState: room.gameState,
        roomId:    socket.roomId,
      });
    });

    // ── WebRTC signalling ─────────────────────────────────────────────────────
    socket.on('webrtc_offer', (data) => {
      const room = rooms[socket.roomId];
      if (!room) return;
      const target = room.players.find(p => p.username === data.target);
      if (target?.status === 'ONLINE' && !target.isBot)
        io.to(target.socketId).emit('webrtc_offer', { ...data, sender: socket.id });
    });

    socket.on('webrtc_answer', (data) => {
      const room = rooms[socket.roomId];
      if (!room) return;
      const target = room.players.find(p => p.username === data.target);
      if (target?.status === 'ONLINE' && !target.isBot)
        io.to(target.socketId).emit('webrtc_answer', { ...data, sender: socket.id });
    });

    socket.on('webrtc_ice_candidate', (data) => {
      const room = rooms[socket.roomId];
      if (!room) return;
      const target = room.players.find(p => p.username === data.target);
      if (target?.status === 'ONLINE' && !target.isBot)
        io.to(target.socketId).emit('webrtc_ice_candidate', { ...data, sender: socket.id });
    });

    // ── Social ────────────────────────────────────────────────────────────────
    socket.on('send_chat', (msg) => {
      const room = rooms[socket.roomId];
      if (!room) return;
      const p = room.players.find(pl => pl.socketId === socket.id);
      if (!p || !room.settings.enableChat) return;
      io.to(socket.roomId).emit('chat_message', { sender: p.username, message: msg });
    });

    socket.on('reaction', (emoji) => {
      const room = rooms[socket.roomId];
      if (!room) return;
      const p = room.players.find(pl => pl.socketId === socket.id);
      if (!p || !room.settings.enableReactions) return;
      io.to(socket.roomId).emit('reaction', { username: p.username, emoji });
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const room = rooms[socket.roomId];
      if (!room) return;

      const p = room.players.find(pl => pl.socketId === socket.id);
      if (p) {
        p.status = 'OFFLINE';
        io.to(socket.roomId).emit('player_list_update', room.players);

        if (room.engine) {
          room.engine.markOfflineTime(p.username);
        } else {
          room.players = room.players.filter(pl => pl.username !== p.username);
          io.to(socket.roomId).emit('player_list_update', room.players);
          if (room.players.length === 0 || room.players.every(pl => pl.isBot || pl.status === 'OFFLINE')) {
            delete rooms[socket.roomId];
          }
        }
      }
    });
  });
};
