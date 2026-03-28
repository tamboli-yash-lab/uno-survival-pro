import { v4 as uuidv4 } from 'uuid';
import { MIN_PLAYERS, MAX_PLAYERS, ENTRY_PASSWORD, TOKEN_STATES, buildDeck, isValidPlay, GAME_STATES, DEFAULT_HOST_SETTINGS } from '../shared/gameLogic.js';
import { GameEngine } from './gameEngine.js';

const rooms = {}; 

export const setupSocketEvents = (io) => {
    
    // Periodically let engine do bot turns for all active rooms
    setInterval(() => {
        Object.values(rooms).forEach(room => {
            if(room.engine && room.gameState === GAME_STATES.PLAYING) {
                room.engine.update(io, room.id);
            }
        });
    }, 1000);

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // --- AUTH & LOBBY ---
        socket.on('create_room', ({ username }) => {
            const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            rooms[roomId] = {
                id: roomId,
                settings: { ...DEFAULT_HOST_SETTINGS },
                players: [], // Array of { id, username, socketId, isHost, isBot, status }
                tokens: {}, // invite tokens (not strictly required if using generic link, but keeping for compatibility)
                gameState: GAME_STATES.LOBBY,
                engine: null // Instance of GameEngine
            };

            const newPlayer = {
                 id: uuidv4(),
                 username,
                 socketId: socket.id,
                 isHost: true,
                 isBot: false,
                 status: 'ONLINE'
            };
            
            rooms[roomId].players.push(newPlayer);
            socket.roomId = roomId;
            socket.join(roomId);

            socket.emit('room_created', { roomId });
            socket.emit('lobby_joined', { 
                players: rooms[roomId].players, 
                settings: rooms[roomId].settings,
                isHost: true,
                gameState: rooms[roomId].gameState,
                roomId
            });
        });

        socket.on('join_lobby', ({ password, username, token, roomId }) => {
            // If they don't specify roomId, they can't join in a multi-room setup,
            // unless we support a fallback (which we can skip for strict multi-room).
            if (!roomId || !rooms[roomId]) {
                socket.emit('error', 'Room not found.');
                return;
            }
            
            const room = rooms[roomId];

            // In a real system you'd validate password or token here. For this implementation plan, 
            // if they have the link/code, we let them in to keep it simple and playable.
            // If you wish to use the token logic, you could do it here.

            // Check max players
            if (room.players.length >= MAX_PLAYERS) {
                 socket.emit('error', 'Room is currently full.');
                 return;
            }

            // Check duplicate or reconnect
            if (room.players.find(p => p.username === username)) {
                let existing = room.players.find(p => p.username === username);
                existing.socketId = socket.id;
                existing.status = 'ONLINE';
                
                socket.roomId = roomId;
                socket.join(roomId);

                socket.emit('lobby_joined', { 
                    players: room.players, 
                    settings: room.settings,
                    isHost: existing.isHost,
                    gameState: room.gameState,
                    roomId
                });
                
                if (room.engine) {
                    socket.emit('game_update', room.engine.getDetailedStateFor(username));
                }
                
                io.to(roomId).emit('player_list_update', room.players);
                return;
            }

            // New Player
            const isHost = room.players.length === 0;
            const newPlayer = {
                 id: uuidv4(),
                 username,
                 socketId: socket.id,
                 isHost,
                 isBot: false,
                 status: 'ONLINE'
            };
            
            room.players.push(newPlayer);
            socket.roomId = roomId;
            socket.join(roomId);
            
            socket.emit('lobby_joined', { 
                players: room.players, 
                settings: room.settings,
                isHost,
                gameState: room.gameState,
                roomId
            });
            io.to(roomId).emit('player_list_update', room.players);
            io.to(roomId).emit('notification', `${username} has joined the game.`);
        });

        // --- HOST CONTROLS ---
        socket.on('add_bot', () => {
             const roomId = socket.roomId;
             if (!roomId || !rooms[roomId]) return;
             const room = rooms[roomId];
             const p = room.players.find(pl => pl.socketId === socket.id);
             
             if (!p || !p.isHost || room.gameState === GAME_STATES.PLAYING) return;
             
             const botCount = room.players.filter(pl => pl.isBot).length;
             const botArchetype = Math.random() > 0.5 ? 'AGGRESSIVE' : 'SAFE';
             const newBot = {
                 id: uuidv4(),
                 username: `Bot_${botCount + 1}`,
                 socketId: `bot_${uuidv4()}`,
                 isHost: false,
                 isBot: true,
                 archetype: botArchetype,
                 status: 'ONLINE'
             };
             
             room.players.push(newBot);
             io.to(roomId).emit('player_list_update', room.players);
        });

        socket.on('generate_invite', () => {
             const roomId = socket.roomId;
             if (!roomId || !rooms[roomId]) return;
             const p = rooms[roomId].players.find(pl => pl.socketId === socket.id);
             if(!p || !p.isHost) return;
             
             const token = uuidv4();
             rooms[roomId].tokens[token] = TOKEN_STATES.UNUSED;
             socket.emit('invite_generated', token);
             socket.emit('tokens_update', rooms[roomId].tokens);
        });

        socket.on('update_settings', (newSettings) => {
             const roomId = socket.roomId;
             if (!roomId || !rooms[roomId]) return;
             const room = rooms[roomId];
             const p = room.players.find(pl => pl.socketId === socket.id);
             if(!p || !p.isHost || room.gameState === GAME_STATES.PLAYING) return;
             
             room.settings = { ...room.settings, ...newSettings };
             io.to(roomId).emit('settings_updated', room.settings);
        });

        socket.on('kick_player', (username) => {
             const roomId = socket.roomId;
             if (!roomId || !rooms[roomId]) return;
             const room = rooms[roomId];
             const p = room.players.find(pl => pl.socketId === socket.id);
             if(!p || !p.isHost) return;
             
             room.players = room.players.filter(pl => pl.username !== username);
             io.to(roomId).emit('player_list_update', room.players);
             
             if (room.engine) {
                room.engine.handlePlayerExit(username);
             }
        });

        // --- GAME FLOW ---
        socket.on('start_game', () => {
             const roomId = socket.roomId;
             if (!roomId || !rooms[roomId]) return;
             const room = rooms[roomId];
             const p = room.players.find(pl => pl.socketId === socket.id);
             if(!p || !p.isHost) return;
             
             // In multi-room testing, bots count as players
             if(room.players.length < room.settings.minPlayers) {
                  socket.emit('error', `Need at least ${room.settings.minPlayers} to start.`);
                  return;
             }

             room.gameState = GAME_STATES.PLAYING;
             room.engine = new GameEngine(room.players, room.settings);
             room.engine.start();
             
             io.to(roomId).emit('game_started');
             
             room.players.forEach(pl => {
                if(pl.status === 'ONLINE' && !pl.isBot) {
                   io.to(pl.socketId).emit('game_update', room.engine.getDetailedStateFor(pl.username));
                }
             });
        });

        socket.on('play_card', ({ cardId, selectedColor }) => {
            const roomId = socket.roomId;
            if(!roomId || !rooms[roomId] || !rooms[roomId].engine) return;
            const room = rooms[roomId];
            const p = room.players.find(pl => pl.socketId === socket.id);
            if(!p) return;
            
            const success = room.engine.playCard(p.username, cardId, selectedColor);
            if(success) {
                room.players.forEach(pl => {
                   if(pl.status === 'ONLINE' && !pl.isBot) {
                      io.to(pl.socketId).emit('game_update', room.engine.getDetailedStateFor(pl.username));
                   }
                });
                io.to(roomId).emit('sound_effect', 'play');
            } else {
                socket.emit('error', "Invalid play!");
            }
        });

        socket.on('draw_card', () => {
            const roomId = socket.roomId;
            if(!roomId || !rooms[roomId] || !rooms[roomId].engine) return;
            const room = rooms[roomId];
            const p = room.players.find(pl => pl.socketId === socket.id);
            if(!p) return;
            
            room.engine.drawCard(p.username);
            room.players.forEach(pl => {
                if(pl.status === 'ONLINE' && !pl.isBot) {
                    io.to(pl.socketId).emit('game_update', room.engine.getDetailedStateFor(pl.username));
                }
            });
            io.to(roomId).emit('sound_effect', 'draw');
        });

        socket.on('pass_turn', () => {
            const roomId = socket.roomId;
            if(!roomId || !rooms[roomId] || !rooms[roomId].engine) return;
            const room = rooms[roomId];
            const p = room.players.find(pl => pl.socketId === socket.id);
            if(!p) return;
            
            room.engine.passTurn(p.username);
            room.players.forEach(pl => {
                if(pl.status === 'ONLINE' && !pl.isBot) {
                    io.to(pl.socketId).emit('game_update', room.engine.getDetailedStateFor(pl.username));
                }
            });
            io.to(roomId).emit('sound_effect', 'play');
        });

        socket.on('call_uno', () => {
            const roomId = socket.roomId;
            if(!roomId || !rooms[roomId] || !rooms[roomId].engine) return;
            const room = rooms[roomId];
            const p = room.players.find(pl => pl.socketId === socket.id);
            if(!p) return;
            
            room.engine.callUno(p.username);
            io.to(roomId).emit('uno_called', p.username);
            io.to(roomId).emit('sound_effect', 'uno');
        });

        socket.on('return_to_lobby', () => {
             const roomId = socket.roomId;
             if(!roomId || !rooms[roomId]) return;
             const room = rooms[roomId];
             const p = room.players.find(pl => pl.socketId === socket.id);
             if(!p || !p.isHost) return;
             
             // Reset room state
             room.gameState = GAME_STATES.LOBBY;
             room.engine = null;
             
             io.to(roomId).emit('lobby_joined', {
                 players: room.players,
                 settings: room.settings,
                 isHost: true,
                 gameState: room.gameState,
                 roomId
             });
        });

        // --- WEBRTC SIGNALING ---
        socket.on('webrtc_offer', (data) => {
            const roomId = socket.roomId;
            if(!roomId || !rooms[roomId]) return;
            const target = rooms[roomId].players.find(p => p.username === data.target);
            if(target && target.status === 'ONLINE' && !target.isBot) io.to(target.socketId).emit('webrtc_offer', { ...data, sender: socket.id });
        });

        socket.on('webrtc_answer', (data) => {
            const roomId = socket.roomId;
            if(!roomId || !rooms[roomId]) return;
            const target = rooms[roomId].players.find(p => p.username === data.target);
            if(target && target.status === 'ONLINE' && !target.isBot) io.to(target.socketId).emit('webrtc_answer', { ...data, sender: socket.id });
        });

        socket.on('webrtc_ice_candidate', (data) => {
            const roomId = socket.roomId;
            if(!roomId || !rooms[roomId]) return;
            const target = rooms[roomId].players.find(p => p.username === data.target);
            if(target && target.status === 'ONLINE' && !target.isBot) io.to(target.socketId).emit('webrtc_ice_candidate', { ...data, sender: socket.id });
        });

        // --- SOCIAL ---
        socket.on('send_chat', (msg) => {
             const roomId = socket.roomId;
             if(!roomId || !rooms[roomId]) return;
             const room = rooms[roomId];
             const p = room.players.find(pl => pl.socketId === socket.id);
             if(!p || !room.settings.enableChat) return;
             io.to(roomId).emit('chat_message', { sender: p.username, message: msg });
        });

        socket.on('reaction', (emoji) => {
             const roomId = socket.roomId;
             if(!roomId || !rooms[roomId]) return;
             const room = rooms[roomId];
             const p = room.players.find(pl => pl.socketId === socket.id);
             if(!p || !room.settings.enableReactions) return;
             io.to(roomId).emit('reaction', { username: p.username, emoji });
        });

        // --- DISCONNECT ---
        socket.on('disconnect', () => {
             const roomId = socket.roomId;
             if(!roomId || !rooms[roomId]) return;
             
             const room = rooms[roomId];
             const p = room.players.find(pl => pl.socketId === socket.id);
             if(p) {
                 p.status = 'OFFLINE';
                 io.to(roomId).emit('player_list_update', room.players);
                 
                 if (room.engine) {
                    room.engine.markOfflineTime(p.username);
                 } else {
                     // If game hasn't started and player leaves, remove them
                     room.players = room.players.filter(pl => pl.username !== p.username);
                     io.to(roomId).emit('player_list_update', room.players);
                     
                     // If room is empty, clean it up
                     if (room.players.length === 0 || room.players.every(pl => pl.isBot || pl.status === 'OFFLINE')) {
                         delete rooms[roomId];
                     }
                 }
             }
        });
    });
};
