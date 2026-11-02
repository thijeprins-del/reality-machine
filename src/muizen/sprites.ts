// Gegenereerd door scripts/pixel/muizen.mjs. Niet met de hand aanpassen.
// anker = pixel in de sprite die op de achterhoek van de tegel valt (voor muizen: de voeten).
// gloed = er is een <naam>-gloed.png met alleen de neonpixels, voor de gloedlaag.
export const MUIZEN_SPRITES = {
  'muis': { w: 18, h: 16, ankerX: 9, ankerY: 15, tegels: 0, gloed: true },
  'muis-monteur': { w: 18, h: 16, ankerX: 9, ankerY: 15, tegels: 0, gloed: true },
  'mech': { w: 156, h: 160, ankerX: 76, ankerY: 118, tegels: 2, gloed: true },
  'sjouwbot': { w: 64, h: 70, ankerX: 26, ankerY: 48, tegels: 1, gloed: true },
  'fabriek': { w: 84, h: 112, ankerX: 42, ankerY: 78, tegels: 2, gloed: true },
  'pers': { w: 48, h: 72, ankerX: 24, ankerY: 54, tegels: 1, gloed: true },
  'dynamo': { w: 48, h: 76, ankerX: 24, ankerY: 58, tegels: 1, gloed: true },
  'band': { w: 40, h: 30, ankerX: 22, ankerY: 13, tegels: 1, gloed: true },
  'mast': { w: 28, h: 60, ankerX: 14, ankerY: 44, tegels: 1, gloed: true },
  'kabels': { w: 36, h: 30, ankerX: 9, ankerY: 43, tegels: 2, gloed: true },
} as const;

export type MuizenSprite = keyof typeof MUIZEN_SPRITES;
