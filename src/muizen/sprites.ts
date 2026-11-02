// Gegenereerd door scripts/pixel/muizen.mjs. Niet met de hand aanpassen.
// anker = pixel in de sprite die op de achterhoek van de tegel valt (voor muizen: de voeten).
export const MUIZEN_SPRITES = {
  'muis': { w: 18, h: 16, ankerX: 9, ankerY: 15, tegels: 0 },
  'muis-monteur': { w: 18, h: 16, ankerX: 9, ankerY: 15, tegels: 0 },
  'mech': { w: 96, h: 100, ankerX: 40, ankerY: 83, tegels: 1 },
  'fabriek': { w: 80, h: 104, ankerX: 40, ankerY: 72, tegels: 2 },
  'pers': { w: 44, h: 66, ankerX: 22, ankerY: 49, tegels: 1 },
  'dynamo': { w: 44, h: 70, ankerX: 22, ankerY: 53, tegels: 1 },
  'band': { w: 40, h: 30, ankerX: 22, ankerY: 13, tegels: 1 },
  'mast': { w: 28, h: 60, ankerX: 14, ankerY: 44, tegels: 1 },
  'kabels': { w: 36, h: 30, ankerX: 9, ankerY: 43, tegels: 2 },
} as const;

export type MuizenSprite = keyof typeof MUIZEN_SPRITES;
