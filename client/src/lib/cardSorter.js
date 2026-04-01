// ─── Card Sort Utility ────────────────────────────────────────────────────────
// Groups: Red → Yellow → Green → Blue → Black(Wild)
// Within group: 0-9, then Skip/Reverse/Draw2, then Wild/Wild+4

const COLOR_ORDER = { red: 0, yellow: 1, green: 2, blue: 3, black: 99 };

const VALUE_ORDER = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'skip':       10,
  'reverse':    11,
  'draw2':      12,
  'wild':       20,
  'wildDraw4':  21,
  'skipEffect': 22,
};

/**
 * Returns a new sorted copy of the hand array.
 * Cards are grouped by colour then by value within that colour.
 * Wild cards always appear last.
 */
export function sortHand(hand) {
  return [...hand].sort((a, b) => {
    const cd = (COLOR_ORDER[a.color] ?? 50) - (COLOR_ORDER[b.color] ?? 50);
    if (cd !== 0) return cd;
    return (VALUE_ORDER[a.value] ?? 15) - (VALUE_ORDER[b.value] ?? 15);
  });
}
