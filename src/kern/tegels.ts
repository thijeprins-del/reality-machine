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
