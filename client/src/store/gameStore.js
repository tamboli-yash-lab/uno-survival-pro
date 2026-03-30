import { create } from 'zustand';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://uno-survival-backend.onrender.com';

// ─── Load persisted settings from localStorage ───────────────────────────────
const defaultSettings = {
  theme:             'theme-neon',
  cardGlow:          true,
  animationsEnabled: true,
  sfxVolume:         70,
  bgmVolume:         30,
  bgmTrack:          'lofi',
  cardSize:          'md',   // 'sm' | 'md' | 'lg'
  confettiEnabled:   true,
  font:              'Inter',
  bgStyle:           'gradient', // 'solid' | 'gradient' | 'starfield'
};

function loadSettings() {
  try {
    const saved = localStorage.getItem('uno_settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem('uno_settings', JSON.stringify(settings));
  } catch {}
}

// ─── Apply settings to DOM immediately on load ────────────────────────────────
const initialSettings = loadSettings();
document.body.className = initialSettings.theme;
document.documentElement.style.setProperty('--user-font', initialSettings.font);

export const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ['websocket'],
  reconnectionAttempts: 5
});

export const useGameStore = create((set, get) => ({
  // ── Network / Game state ──
  username: '',
  isHost:    false,
  roomId:    null,
  gameState: 'LOBBY',
  players:   [],
  settings:  {},
  tokens:    {},

  // ── In-game state ──
  myHand:        [],
  topCard:       null,
  currentColor:  null,
  direction:     1,
  deckCount:     0,
  turnTimeLeft:  null,
  messages:      [],
  rankings:      [],
  isGameOver:    false,
  hasDrawnThisTurn: false,

  // ── User Preferences (persisted) ──
  ...initialSettings,

  // ── Actions ──
  setUsername: (name) => set({ username: name }),

  updateSetting: (key, value) => {
    set({ [key]: value });
    const next = { ...get(), [key]: value };
    saveSettings({
      theme:             next.theme,
      cardGlow:          next.cardGlow,
      animationsEnabled: next.animationsEnabled,
      sfxVolume:         next.sfxVolume,
      bgmVolume:         next.bgmVolume,
      bgmTrack:          next.bgmTrack,
      cardSize:          next.cardSize,
      confettiEnabled:   next.confettiEnabled,
      font:              next.font,
      bgStyle:           next.bgStyle,
    });
    // Apply theme to DOM immediately
    if (key === 'theme') document.body.className = value;
    if (key === 'font')  document.documentElement.style.setProperty('--user-font', value);
  },

  // ── Socket setup ──
  initSocket: () => {
    socket.connect();

    socket.on('lobby_joined', (data) => {
      set({
        players:   data.players,
        settings:  data.settings,
        isHost:    data.isHost,
        gameState: data.gameState,
        roomId:    data.roomId,
      });
    });

    socket.on('player_list_update', (players) => set({ players }));
    socket.on('tokens_update',      (tokens)  => set({ tokens }));
    socket.on('settings_updated',   (settings)=> set({ settings }));
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
      });
      if (state.isGameOver) set({ gameState: 'END' });
    });

    socket.on('chat_message', (msg) => {
      set(s => ({ messages: [...s.messages, msg] }));
    });

    socket.on('error', (err) => alert('Error: ' + err));

    socket.on('sound_effect', (type) => {
      const e = new CustomEvent('play_sound', { detail: type });
      window.dispatchEvent(e);
    });
  },
}));
