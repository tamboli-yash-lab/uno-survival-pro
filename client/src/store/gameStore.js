import { create } from 'zustand';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://uno-survival-backend.onrender.com';
export const socket = io(SERVER_URL, { 
    autoConnect: false,
    transports: ['websocket'],
    reconnectionAttempts: 5
});

export const useGameStore = create((set, get) => ({
  username: '',
  isHost: false,
  roomId: null,
  gameState: 'LOBBY', // LOBBY, PLAYING, END
  players: [],
  settings: {},
  tokens: {},
  
  // Game specifics
  myHand: [],
  topCard: null,
  currentColor: null,
  direction: 1,
  deckCount: 0,
  turnTimeLeft: null,
  messages: [],
  rankings: [],
  isGameOver: false,
  theme: 'theme-classic',

  // Actions
  setUsername: (name) => set({ username: name }),
  setTheme: (theme) => set({ theme }),
  
  // Socket Handlers setup
  initSocket: () => {
     socket.connect();
     
     socket.on('lobby_joined', (data) => {
         set({ players: data.players, settings: data.settings, isHost: data.isHost, gameState: data.gameState, roomId: data.roomId });
     });
     
     socket.on('player_list_update', (players) => {
         set({ players });
     });
     
     socket.on('tokens_update', (tokens) => {
         set({ tokens });
     });

     socket.on('settings_updated', (settings) => {
         set({ settings });
     });

     socket.on('game_started', () => {
         set({ gameState: 'PLAYING' });
     });

     socket.on('game_update', (state) => {
         set({
             players: state.players,
             myHand: state.myHand,
             topCard: state.topCard,
             currentColor: state.currentColor,
             direction: state.direction,
             deckCount: state.deckCount,
             turnTimeLeft: state.turnTimeLeft,
             messages: state.messages,
             rankings: state.rankings,
             isGameOver: state.isGameOver
         });
         
         if (state.isGameOver) {
             set({ gameState: 'END' });
         }
     });

     socket.on('chat_message', (msg) => {
         set(state => ({ messages: [...state.messages, msg] }));
     });
     
     socket.on('error', (err) => {
         alert("Error: " + err);
     });
     
     socket.on('sound_effect', (type) => {
         // Simple global hook for audio
         const e = new CustomEvent('play_sound', { detail: type });
         window.dispatchEvent(e);
     });
  }
}));
