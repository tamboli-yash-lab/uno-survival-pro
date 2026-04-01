// ─── Constants ────────────────────────────────────────────────────────────────
export const MAX_PLAYERS = 7;
export const MIN_PLAYERS = 2;
export const ENTRY_PASSWORD = '8238557163';

export const COLORS         = ['red', 'blue', 'green', 'yellow'];
export const SPECIAL_CARDS  = ['skip', 'reverse', 'draw2'];
export const WILD_CARDS     = ['wild', 'wildDraw4'];
export const TWIST_CARDS    = [];

export const GAME_STATES = {
  LOBBY:   'LOBBY',
  PLAYING: 'PLAYING',
  PAUSED:  'PAUSED',
  END:     'END',
};

export const TOKEN_STATES = {
  UNUSED:  'UNUSED',
  USED:    'USED',
  EXPIRED: 'EXPIRED',
};

// ─── Default host settings (all optional rules OFF by default) ────────────────
export const DEFAULT_HOST_SETTINGS = {
  minPlayers:      2,
  cardDistribution: 7,
  turnTimer:       15,
  enableChat:      true,
  enableReactions: true,
  // Optional rules
  stackDrawCards:  false,  // +2 stacks on +2, +4 stacks on +4
  sevenZeroRule:   false,  // 7=swap hands, 0=rotate all hands
  jumpInRule:      false,  // Same card can interrupt any turn
  forcePlay:       false,  // Auto-play drawn card if valid
  strictWildDraw4: true,   // Wild+4 only legal if player has no matching colour
};

// ─── Deck builder ─────────────────────────────────────────────────────────────
export const buildDeck = (includeTwists = false, chaosSlider = 'MEDIUM') => {
  let deck = [];

  for (const color of COLORS) {
    // One zero
    deck.push({ color, value: '0', type: 'number', id: _uid() });
    // Two of each 1-9
    for (let i = 1; i <= 9; i++) {
      deck.push({ color, value: String(i), type: 'number', id: _uid() });
      deck.push({ color, value: String(i), type: 'number', id: _uid() });
    }
    // Two of each action
    for (const special of SPECIAL_CARDS) {
      deck.push({ color, value: special, type: 'action', id: _uid() });
      deck.push({ color, value: special, type: 'action', id: _uid() });
    }
  }

  // Four of each wild
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'black', value: 'wild',      type: 'wild', id: _uid() });
    deck.push({ color: 'black', value: 'wildDraw4', type: 'wild', id: _uid() });
  }

  _shuffle(deck);
  return deck;
};

function _uid() {
  return Math.random().toString(36).substr(2, 9);
}
function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ─── Card play validation ─────────────────────────────────────────────────────
// playerHand is optional — required only for strictWildDraw4 check
export const isValidPlay = (cardToPlay, currentTopCard, currentColor, playerHand = null, settings = {}) => {
  // Wild is always playable (legality enforced separately for Wild+4)
  if (cardToPlay.type === 'wild') {
    // Strict Wild+4: only legal if player holds NO card matching currentColor
    if (cardToPlay.value === 'wildDraw4' && settings.strictWildDraw4 && playerHand) {
      const hasMatchingColor = playerHand.some(
        c => c.color === currentColor && c.id !== cardToPlay.id
      );
      if (hasMatchingColor) return false;
    }
    return true;
  }
  if (cardToPlay.color === currentColor)        return true;
  if (currentTopCard && cardToPlay.value === currentTopCard.value) return true;
  return false;
};

// ─── Card sort utility (client + bot use) ────────────────────────────────────
const COLOR_SORT = { red: 0, yellow: 1, green: 2, blue: 3, black: 99 };
const VALUE_SORT = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
  '6': 6, '7': 7, '8': 8, '9': 9,
  'skip': 10, 'reverse': 11, 'draw2': 12,
  'wild': 20, 'wildDraw4': 21,
};

export const sortHand = (hand) =>
  [...hand].sort((a, b) => {
    const cd = (COLOR_SORT[a.color] ?? 50) - (COLOR_SORT[b.color] ?? 50);
    if (cd !== 0) return cd;
    return (VALUE_SORT[a.value] ?? 15) - (VALUE_SORT[b.value] ?? 15);
  });
