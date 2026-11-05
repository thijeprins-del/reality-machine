// Terrein: de hoogtekaart van een dimensie. Hoogtes staan op de HOEKEN van tegels, in hele niveaus, dus er zijn
// (breed + 1) x (diep + 1) getallen. Tegel (x, y) loopt van x - 0,5 tot x + 0,5, dus hoek (i, j) ligt op (i - 0,5, j - 0,5).
// Een schuine tegel is twee platte driehoeken; hoogteOp en het tekenen knikken langs dezelfde lijn.
import { HOOGTE_DROOG, HOOGTE_MAX, HOOGTE_MIN, HOOGTE_PX, TERREIN_VLAK, TERREIN_VOL, type Heuvels } from '../data/dimensies';
import { TEGEL_B, TEGEL_H } from './iso';
import { volgende } from './toeval';

export interface Terrein {
  breed: number;
  diep: number;
  hoogte: Int8Array;
}

// De vier hoeken van tegel (x, y), zoals je ze op het scherm ziet: achter, rechts, voor, links.
export function hoeken(t: Terrein, x: number, y: number): { a: number; r: number; v: number; l: number } {
  const s = t.breed + 1, h = t.hoogte, o = y * s + x;
  return { a: h[o], r: h[o + 1], v: h[o + s + 1], l: h[o + s] };
}

// Knikt deze tegel van links naar rechts (anders van achter naar voor)? Altijd langs de hoeken die het minst verschillen,
// zodat één hoge hoek een bultje wordt en geen vouw door de hele tegel.
export const knikLinksRechts = (a: number, r: number, v: number, l: number) => Math.abs(a - v) > Math.abs(r - l);

// De hoogte van de grond op een plek (kommagetallen, in niveaus). Buiten de kaart: de dichtstbijzijnde rand.
export function hoogteOp(t: Terrein, x: number, y: number): number {
  const u = Math.max(0, Math.min(t.breed, x + 0.5)), w = Math.max(0, Math.min(t.diep, y + 0.5));
  const i = Math.min(t.breed - 1, Math.floor(u)), j = Math.min(t.diep - 1, Math.floor(w));
  const f = u - i, g = w - j;
  const { a, r, v, l } = hoeken(t, i, j);
  if (knikLinksRechts(a, r, v, l))
    return f + g < 1 ? a + f * (r - a) + g * (l - a) : v + (1 - f) * (l - v) + (1 - g) * (r - v);
  return f > g ? a + f * (r - a) + g * (v - r) : a + g * (l - a) + f * (v - l);
}

// Welke tegel zie je op dit punt van de wereld (in schermpixels, zonder zoom)? We lopen langs de kijklijn van hoog naar
// laag: de eerste grond die we raken is wat vooraan staat, dus klikken op een heuvel raakt de heuvel en niet wat erachter ligt.
export function tegelOnder(t: Terrein, px: number, py: number): { kol: number; rij: number } {
  const a = px / (TEGEL_B / 2);
  for (let z = HOOGTE_MAX; ; z -= 0.125) {
    const b = (py + z * HOOGTE_PX) / (TEGEL_H / 2);
    const x = (a + b) / 2, y = (b - a) / 2;
    if (z <= HOOGTE_MIN || hoogteOp(t, x, y) >= z) return { kol: Math.round(x), rij: Math.round(y) };
  }
}

// Gladde ruis van -1 tot ongeveer 1: Perlin, met drie lagen die steeds fijner en zwakker worden.
function maakRuis(stroom: { toeval: number }): (x: number, y: number) => number {
  const p = new Uint8Array(512);
  const volgorde = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(volgende(stroom) * (i + 1));
    [volgorde[i], volgorde[j]] = [volgorde[j], volgorde[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = volgorde[i & 255];
  const zacht = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const helling = (h: number, x: number, y: number) => {
    const u = h & 1 ? x : y, v = h & 1 ? y : x;
    return (h & 2 ? -u : u) + (h & 4 ? -0.5 * v : 0.5 * v);
  };
  const laag = (x: number, y: number) => {
    const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j;
    const I = i & 255, J = j & 255, u = zacht(f), w = zacht(g);
    const aa = helling(p[p[I] + J], f, g), ba = helling(p[p[I + 1] + J], f - 1, g);
    const ab = helling(p[p[I] + J + 1], f, g - 1), bb = helling(p[p[I + 1] + J + 1], f - 1, g - 1);
    return aa + u * (ba - aa) + w * (ab - aa + u * (bb - ab - ba + aa));
  };
  return (x, y) => (laag(x, y) + 0.5 * laag(x * 2 + 17, y * 2 + 31) + 0.25 * laag(x * 4 + 53, y * 4 + 71)) / 1.2;
}

// De hoogtekaart van één wereld. Rond de schijf blijft het vlak: daar ligt je eigen land, en muizen moeten er af kunnen.
// Pas verderop mogen de heuvels omhoog komen.
export function maakHoogtes(breed: number, diep: number, ring: { x: number; y: number; r: number }, heuvels: Heuvels, stroom: { toeval: number }): Int8Array {
  const s = breed + 1, n = s * (diep + 1);
  const h = new Int8Array(n);
  const ruis = maakRuis(stroom);
  const v0 = ring.r + TERREIN_VLAK, v1 = ring.r + TERREIN_VOL;
  for (let j = 0; j <= diep; j++)
    for (let i = 0; i <= breed; i++) {
      const d = Math.hypot(i - 0.5 - ring.x, j - 0.5 - ring.y);
      const m = Math.max(0, Math.min(1, (d - v0) / (v1 - v0)));
      const waarde = heuvels.basis + ruis(i / heuvels.schaal, j / heuvels.schaal) * heuvels.hoog;
      h[j * s + i] = Math.max(HOOGTE_DROOG, Math.min(HOOGTE_MAX, Math.round(waarde * m * m * (3 - 2 * m))));
    }
  // Nu nog alleen hellingen: buren schelen hooguit één niveau, ook schuin. Heen en terug is genoeg, en omdat dit alleen
  // verlaagt, blijft de vlakte rond de schijf vlak. Klippen komen in stap 2.
  const beperk = (o: number, b: number) => {
    if (b >= 0 && b < n && h[o] > h[b] + 1) h[o] = h[b] + 1;
  };
  for (let o = 0; o < n; o++) {
    if (o % s > 0) { beperk(o, o - 1); beperk(o, o - s - 1); }
    beperk(o, o - s);
    if (o % s < s - 1) beperk(o, o - s + 1);
  }
  for (let o = n - 1; o >= 0; o--) {
    if (o % s < s - 1) { beperk(o, o + 1); beperk(o, o + s + 1); }
    beperk(o, o + s);
    if (o % s > 0) beperk(o, o + s - 1);
  }
  return h;
}
