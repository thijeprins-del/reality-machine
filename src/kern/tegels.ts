// Gegenereerd door scripts/pixel/terrein.mjs. Niet met de hand aanpassen.
// De indeling van een tegelset-plaatje (assets/wereld/tegels-<naam>.png), in sprite-pixels.
export const TEGELSETS = ['roestduin', 'kristaltoendra', 'gifwoud', 'magmaveld', 'zoutzee', 'aarde'] as const;
export type TegelSet = (typeof TEGELSETS)[number];
export const CEL_B = 34, CEL_H = 34, CEL_X = 17, CEL_Y = 25, KOLOMMEN = 27;
export const VARIANTEN = 3, WATER_VARIANTEN = 3, WATER_BEELDEN = 4, SCHUIM_BEELDEN = 2;

// Hoeken ten opzichte van de laagste (0, 1 of 2): achter, rechts, voor, links.
export const celLand = (a: number, r: number, v: number, l: number, variant: number) => a * 27 + r * 9 + v * 3 + l + variant * 81;
export const celWater = (variant: number, beeld: number) => 243 + variant * WATER_BEELDEN + beeld;
// rand: 0 = achter-rechts, 1 = rechts-voor, 2 = voor-links, 3 = links-achter
export const celSchuim = (rand: number, beeld: number) => 255 + rand * SCHUIM_BEELDEN + beeld;

// De wanden (assets/wereld/wanden-<naam>.png). Een stuk is één tegelrand breed; de bovenrand begint links op rij WAND_Y.
export const WAND_B = 16, WAND_H = 96, WAND_Y = 24, WAND_KOLOMMEN = 16, WAND_MAX = 6, WAND_VARIANTEN = 2;
// richting: 0 = de rand loopt op het scherm naar rechts omlaag, 1 = naar rechts omhoog. dt en db: hoeveel de bovenrand en de
// voet van links naar rechts stijgen (-1, 0, 1). hP: hoe hoog de wand links is (-1 als de randen elkaar kruisen).
export const celWand = (variant: number, richting: number, dt: number, db: number, hP: number) =>
  (((variant * 2 + richting) * 3 + dt + 1) * 3 + db + 1) * (WAND_MAX + 2) + hP + 1;
