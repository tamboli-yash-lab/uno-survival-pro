import { create } from 'zustand';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://uno-survival-backend.onrender.com';

// ─── Persistent settings ──────────────────────────────────────────────────────
const defaultSettings = {
  theme: 'theme-neon', cardGlow: true, animationsEnabled: true,
  sfxVolume: 70, bgmVolume: 30, bgmTrack: 'lofi',
  cardSize: 'md', confettiEnabled: true, font: 'Inter', bgStyle: 'gradient',
  autoSort: true,   // Auto-sort hand by colour then value
};

function loadSettings() {
  try {
    const s = localStorage.getItem('uno_settings');
    return s ? { ...defaultSettings, ...JSON.parse(s) } : defaultSettings;
  } catch { return defaultSettings; }
}
function saveSettings(s) {
  try { localStorage.setItem('uno_settings', JSON.stringify(s)); } catch {}
}

const init = loadSettings();
document.body.className = init.theme;

export const socket = io(SERVER_URL, {
  autoConnect: false, transports: ['websocket'], reconnectionAttempts: 5,
});

export const useGameStore = create((set, get) => ({
  // ── Auth / lobby ──
  username: '',
  isHost: false,
  roomId: null,
  gameState: 'LOBBY',
  players: [],
  roomSettings: {},   // ← Server room settings (rule toggles etc.)
  tokens: {},

  // ── In-game state ──
  myHand: [],
  topCard: null,
  currentColor: null,
  direction: 1,
  deckCount: 0,
  turnTimeLeft: null,
  messages: [],
  rankings: [],
  isGameOver: false,
  hasDrawnThisTurn: false,
  drawStack: 0,
  drawStackType: null,

  // ── User preferences ──
  ...init,

  // ── Actions ──
  setUsername: (name) => set({ username: name }),

  updateSetting: (key, value) => {
    set({ [key]: value });
    const next = { ...get(), [key]: value };
    saveSettings({
      theme: next.theme, cardGlow: next.cardGlow,
      animationsEnabled: next.animationsEnabled,
      sfxVolume: next.sfxVolume, bgmVolume: next.bgmVolume,
      bgmTrack: next.bgmTrack, cardSize: next.cardSize,
      confettiEnabled: next.confettiEnabled, font: next.font,
      bgStyle: next.bgStyle, autoSort: next.autoSort,
    });
    if (key === 'theme') document.body.className = value;
    if (key === 'font') document.documentElement.style.setProperty('--user-font', value);
  },

  // ── Socket init ──
  initSocket: () => {
    socket.connect();

    socket.on('lobby_joined', (data) => set({
      players: data.players, roomSettings: data.settings || {},
      isHost: data.isHost, gameState: data.gameState, roomId: data.roomId,
    }));

    socket.on('player_list_update', (players) => set({ players }));
    socket.on('tokens_update',      (tokens)  => set({ tokens }));
    socket.on('settings_updated',   (s)       => set({ roomSettings: s }));
    socket.on('game_started',       ()        => set({ gameState: 'PLAYING' }));

    socket.on('game_update', (state) => {
      set({
        players:          state.players,
        myHand:           state.myHand,
        topCard:          state.topCard,
        currentColor:     state.currentColor,
        direction:        state.direction,
        deckCount:        state.deckCount,
        turnTimeLeft:     state.turnTimeLeft,
        messages:         state.messages,
        rankings:         state.rankings,
        isGameOver:       state.isGameOver,
        hasDrawnThisTurn: state.hasDrawnThisTurn ?? false,
        drawStack:        state.drawStack ?? 0,
        drawStackType:    state.drawStackType ?? null,
        roomSettings:     state.roomSettings || get().roomSettings,
      });
      if (state.isGameOver) set({ gameState: 'END' });
    });

    socket.on('chat_message', (msg) =>
      set(s => ({ messages: [...s.messages, msg] })));

    socket.on('error', (err) => alert('Error: ' + err));

    socket.on('sound_effect', (type) =>
      window.dispatchEvent(new CustomEvent('play_sound', { detail: type })));
  },
}));
