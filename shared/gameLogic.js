// Constants configuring the game

export const MAX_PLAYERS = 7;
export const MIN_PLAYERS = 2;
export const ENTRY_PASSWORD = '8238557163';

export const COLORS = ['red', 'blue', 'green', 'yellow'];
export const SPECIAL_CARDS = ['skip', 'reverse', 'draw2'];
export const WILD_CARDS = ['wild', 'wildDraw4'];

export const TWIST_CARDS = [];

export const GAME_STATES = {
  LOBBY: 'LOBBY',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  END: 'END'
};

export const TOKEN_STATES = {
  UNUSED: 'UNUSED',
  USED: 'USED',
  EXPIRED: 'EXPIRED'
};

export const DEFAULT_HOST_SETTINGS = {
  minPlayers: 2,
  cardDistribution: 7, 
  turnTimer: 12, // Reduced from 15s to 12s for faster pacing
  enableChat: true,
  enableReactions: true,
};

export const buildDeck = (includeTwists = true, chaosSlider = 'MEDIUM') => {
  let deck = [];
  
  // Standard UNO Cards
  for (const color of COLORS) {
    deck.push({ color, value: '0', type: 'number', id: Math.random().toString(36).substr(2, 9) });
    for (let i = 1; i <= 9; i++) {
       // Two of each 1-9
       deck.push({ color, value: i.toString(), type: 'number', id: Math.random().toString(36).substr(2, 9) });
       deck.push({ color, value: i.toString(), type: 'number', id: Math.random().toString(36).substr(2, 9) });
    }
    // Actions
    for (const special of SPECIAL_CARDS) {
        deck.push({ color, value: special, type: 'action', id: Math.random().toString(36).substr(2, 9) });
        deck.push({ color, value: special, type: 'action', id: Math.random().toString(36).substr(2, 9) });
    }
  }

  // Wild Cards
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'black', value: 'wild', type: 'wild', id: Math.random().toString(36).substr(2, 9) });
    deck.push({ color: 'black', value: 'wildDraw4', type: 'wild', id: Math.random().toString(36).substr(2, 9) });
  }

  // Twists removed for classic, clean gameplay
  
  // Basic Fisher-Yates shuffle
  for(let i = deck.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
};

export const isValidPlay = (cardToPlay, currentTopCard, currentColor) => {
   if (cardToPlay.type === 'wild') return true;
   if (cardToPlay.color === currentColor) return true;
   if (cardToPlay.value === currentTopCard.value) return true;
   return false;
};
