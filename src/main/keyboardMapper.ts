type KeyboardEventLike = {
  keycode: number;
  shiftKey?: boolean;
};

const LETTERS: Record<number, string> = {
  30: "a",
  48: "b",
  46: "c",
  32: "d",
  18: "e",
  33: "f",
  34: "g",
  35: "h",
  23: "i",
  36: "j",
  37: "k",
  38: "l",
  50: "m",
  49: "n",
  24: "o",
  25: "p",
  16: "q",
  19: "r",
  31: "s",
  20: "t",
  22: "u",
  47: "v",
  17: "w",
  45: "x",
  21: "y",
  44: "z"
};

const DIGITS: Record<number, [string, string]> = {
  2: ["1", "!"],
  3: ["2", "@"],
  4: ["3", "#"],
  5: ["4", "$"],
  6: ["5", "%"],
  7: ["6", "^"],
  8: ["7", "&"],
  9: ["8", "*"],
  10: ["9", "("],
  11: ["0", ")"]
};

const SYMBOLS: Record<number, [string, string]> = {
  12: ["-", "_"],
  13: ["=", "+"],
  26: ["[", "{"],
  27: ["]", "}"],
  39: [";", ":"],
  40: ["'", "\""],
  41: ["`", "~"],
  43: ["\\", "|"],
  51: [",", "<"],
  52: [".", ">"],
  53: ["/", "?"],
  57: [" ", " "]
};

export const CANCEL_KEYCODES = new Set([
  1, // Esc
  28, // Enter
  57 // Space
]);

export function eventToPrintableCharacter(event: KeyboardEventLike): string | null {
  const shift = Boolean(event.shiftKey);

  if (event.keycode in LETTERS) {
    const value = LETTERS[event.keycode];
    return shift ? value.toUpperCase() : value;
  }

  if (event.keycode in DIGITS) {
    return DIGITS[event.keycode][shift ? 1 : 0];
  }

  if (event.keycode in SYMBOLS) {
    return SYMBOLS[event.keycode][shift ? 1 : 0];
  }

  return null;
}
