// Gegenereerd door scripts/pixel/muizen.mjs. Niet met de hand aanpassen.
// anker = pixel in de sprite die op de achterhoek van de tegel valt (voor muizen: de voeten).
// gloed = er is een <naam>-gloed.png met alleen de neonpixels, voor de gloedlaag.
export const MUIZEN_SPRITES = {
  'muis': { w: 11, h: 10, ankerX: 4, ankerY: 8, tegels: 0, gloed: true },
  'muis-monteur': { w: 11, h: 10, ankerX: 4, ankerY: 8, tegels: 0, gloed: true },
  'muis-schroot': { w: 11, h: 10, ankerX: 4, ankerY: 8, tegels: 0, gloed: true },
  'muis-hout': { w: 11, h: 10, ankerX: 4, ankerY: 8, tegels: 0, gloed: true },
  'muis-kristal': { w: 11, h: 10, ankerX: 4, ankerY: 8, tegels: 0, gloed: true },
  'mech': { w: 170, h: 228, ankerX: 56, ankerY: 176, tegels: 3, gloed: true },
  'sjouwbot': { w: 128, h: 144, ankerX: 52, ankerY: 100, tegels: 2, gloed: true },
  'boor': { w: 88, h: 152, ankerX: 44, ankerY: 112, tegels: 2, gloed: true },
  'pers': { w: 96, h: 148, ankerX: 48, ankerY: 110, tegels: 2, gloed: true },
  'dynamo': { w: 96, h: 156, ankerX: 48, ankerY: 118, tegels: 2, gloed: true },
  'band': { w: 40, h: 30, ankerX: 22, ankerY: 13, tegels: 1, gloed: true },
  'mast': { w: 28, h: 60, ankerX: 14, ankerY: 44, tegels: 1, gloed: true },
  'kabels': { w: 36, h: 30, ankerX: 9, ankerY: 43, tegels: 2, gloed: true },
  'machine': { w: 150, h: 330, ankerX: 75, ankerY: 258, tegels: 4, gloed: true },
  'opslag': { w: 80, h: 80, ankerX: 40, ankerY: 44, tegels: 2, gloed: true },
  'band-leeg': { w: 40, h: 30, ankerX: 22, ankerY: 13, tegels: 1, gloed: true },
  'last-schroot': { w: 18, h: 16, ankerX: 9, ankerY: 13, tegels: 0, gloed: false },
  'hoop-schroot': { w: 28, h: 24, ankerX: 14, ankerY: 19, tegels: 0, gloed: false },
  'last-hout': { w: 18, h: 16, ankerX: 9, ankerY: 13, tegels: 0, gloed: false },
  'hoop-hout': { w: 28, h: 24, ankerX: 14, ankerY: 19, tegels: 0, gloed: false },
  'last-kristal': { w: 18, h: 16, ankerX: 9, ankerY: 13, tegels: 0, gloed: true },
  'hoop-kristal': { w: 28, h: 24, ankerX: 14, ankerY: 19, tegels: 0, gloed: true },
  'last-plaat': { w: 18, h: 16, ankerX: 9, ankerY: 13, tegels: 0, gloed: false },
  'hoop-plaat': { w: 28, h: 24, ankerX: 14, ankerY: 19, tegels: 0, gloed: false },
  'last-balk': { w: 18, h: 16, ankerX: 9, ankerY: 13, tegels: 0, gloed: false },
  'hoop-balk': { w: 28, h: 24, ankerX: 14, ankerY: 19, tegels: 0, gloed: false },
  'stapel': { w: 80, h: 60, ankerX: 40, ankerY: 28, tegels: 2, gloed: true },
  'houtbrander': { w: 88, h: 130, ankerX: 44, ankerY: 90, tegels: 2, gloed: true },
} as const;

export type MuizenSprite = keyof typeof MUIZEN_SPRITES;
