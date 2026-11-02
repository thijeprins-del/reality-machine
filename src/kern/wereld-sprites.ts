// Gegenereerd door scripts/pixel/wereld.mjs. Niet met de hand aanpassen.
// anker = pixel in de sprite die op de achterhoek van de tegel valt.
export const WERELD_SPRITES = {
  'schroot-1': { w: 40, h: 56, ankerX: 20, ankerY: 34, tegels: 1, gloed: false },
  'schroot-2': { w: 40, h: 56, ankerX: 20, ankerY: 34, tegels: 1, gloed: false },
  'hout-1': { w: 40, h: 56, ankerX: 20, ankerY: 34, tegels: 1, gloed: false },
  'hout-2': { w: 40, h: 56, ankerX: 20, ankerY: 34, tegels: 1, gloed: false },
  'kristal-1': { w: 40, h: 56, ankerX: 20, ankerY: 34, tegels: 1, gloed: true },
  'kristal-2': { w: 40, h: 56, ankerX: 20, ankerY: 34, tegels: 1, gloed: true },
} as const;

export type WereldSprite = keyof typeof WERELD_SPRITES;
