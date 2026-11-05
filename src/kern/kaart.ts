// De kaart van een dimensie: de machine en de opslag in het midden, velden met grondstoffen eromheen.
import { dimensieHeuvels, dimensieKaart, KAART_BREED, KAART_DIEP, KAART_MIN, RING_STRAAL, VELDEN } from '../data/dimensies';
import type { Doorgang } from './routes';
import { maakTerrein, openRanden, tegelSoorten, type Terrein } from './terrein';
import { hash01, volgende } from './toeval';
import type { Grondstof } from './types';

export interface Afzetting {
  id: number;
  goed: Grondstof;
  x: number; // tegel
  y: number;
  rest: number; // wat er nog te halen valt; 0 = op
  variant: number; // welk plaatje
}

export interface Blok {
  x: number;
  y: number;
  breed: number;
  diep: number;
}

export interface Kaart extends Terrein {
  soort: Uint8Array; // per tegel: TEGEL_LAND of TEGEL_WATER
  lopen: Doorgang; // waar lopende eenheden kunnen komen
  afzettingen: Afzetting[];
  machine: Blok;
  opslag: Blok;
  ring: { x: number; y: number; r: number }; // de gele transportring: midden en straal in tegels
}

export function binnenRing(k: Kaart, x: number, y: number): boolean {
  return Math.hypot(x - k.ring.x, y - k.ring.y) <= k.ring.r;
}

// Je eigen land: een grove schijf die buiten de ring steekt, alsof hij lomp in de wereld is geplakt.
// Straal op hoek `hoek` (radialen). Altijd dezelfde vorm: het is steeds hetzelfde stuk land.
export function schijfStraal(k: Kaart, hoek: number): number {
  const n = 28;
  const f = ((hoek / (Math.PI * 2)) % 1 + 1) % 1 * n;
  const i = Math.floor(f), t = f - i;
  const a = hash01(i * 97 + 13), b = hash01(((i + 1) % n) * 97 + 13);
  return k.ring.r + 1.1 + 1.6 * (a + (b - a) * t * t * (3 - 2 * t));
}

// Een wereld hangt alleen af van de seed en de hoeveelste dimensie het is, niet van wat er intussen gespeeld is.
// Het terrein en de velden hebben elk een eigen toevalsstroom: heuvels aanpassen verschuift de velden niet.
function stroomVoor(seed: number, dimensie: number, soort: number): { toeval: number } {
  return { toeval: (Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul(dimensie, 0x85ebca6b) ^ Math.imul(soort, 0xc2b2ae35)) >>> 0 };
}

// De maat van een wereld: uit het adres (?kaart=256x64, of ?kaart=256x64,128x128 om de beurt per wereld), anders uit de data.
function kaartMaat(dimensie: number): [number, number] {
  const m = (typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('kaart') ?? '').split(',');
  const paar = /^(\d+)x(\d+)$/.exec(m[(dimensie - 1) % m.length]);
  const [b, d] = paar ? [Number(paar[1]), Number(paar[2])] : dimensieKaart(dimensie);
  return [Math.max(KAART_MIN, b), Math.max(KAART_MIN, d)];
}

// Is tegel (kol, rij) deel van je eigen schijf?
export function opSchijf(k: Kaart, kol: number, rij: number): boolean {
  const dx = kol - k.ring.x, dy = rij - k.ring.y;
  return Math.hypot(dx, dy) <= schijfStraal(k, Math.atan2(dy, dx));
}

export function maakKaart(seed: number, dimensie: number): Kaart {
  const [breed, diep] = kaartMaat(dimensie);
  const mx = Math.floor(breed / 2) - 2;
  const my = Math.floor(diep / 2) - 2;
  const machine: Blok = { x: mx, y: my, breed: 4, diep: 4 };
  const opslag: Blok = { x: mx + 5, y: my + 1, breed: 2, diep: 2 };
  const midden = { x: mx + 2, y: my + 2 };
  const ring = { x: mx + 1.5, y: my + 1.5, r: RING_STRAAL };
  const stroom = stroomVoor(seed, dimensie, 1);
  const terrein = maakTerrein(breed, diep, ring, dimensieHeuvels(dimensie), stroom, midden);
  const soort = tegelSoorten(terrein);
  const lopen = maakLopen(terrein, soort, midden, machine);

  const bezet = new Uint8Array(breed * diep);
  const vrij = (x: number, y: number) =>
    x >= 1 && y >= 1 && x < breed - 1 && y < diep - 1 && !bezet[y * breed + x] && lopen.vrij[y * breed + x] === 1 &&
    Math.hypot(x - ring.x, y - ring.y) > ring.r + 3.5; // grondstoffen alleen buiten de ring en de schijf

  const afzettingen: Afzetting[] = [];
  const veldStroom = stroomVoor(seed, dimensie, 2);
  const r = () => volgende(veldStroom);
  for (const goed of Object.keys(VELDEN) as Grondstof[]) {
    const v = VELDEN[goed];
    // Een grotere wereld heeft ook meer velden, verspreid over de hele kaart; de eerste liggen altijd om de schijf heen.
    const extra = Math.max(0, Math.round(v.aantal * ((breed * diep) / (KAART_BREED * KAART_DIEP) - 1)));
    for (let n = 0; n < v.aantal + extra; n++) {
      // zoek een vrije plek voor het hart van het veld, op de goede afstand
      let hart: { x: number; y: number } | null = null;
      // (lukt dat niet, omdat er bijvoorbeeld een meer ligt, dan langzaam verder weg: elk veld moet er komen)
      for (let poging = 0; poging < 400 && !hart; poging++) {
        const hoek = r() * Math.PI * 2;
        const af = v.afstand[0] + r() * (v.afstand[1] - v.afstand[0]) + Math.max(0, poging - 60) * 0.05;
        const ver = n >= v.aantal;
        const x = ver ? 1 + Math.floor(r() * (breed - 2)) : Math.round(midden.x + Math.cos(hoek) * af);
        const y = ver ? 1 + Math.floor(r() * (diep - 2)) : Math.round(midden.y + Math.sin(hoek) * af);
        if (vrij(x, y)) hart = { x, y };
      }
      if (!hart) continue;
      // groei het veld tegel voor tegel vanuit het hart
      const doel = v.tegels[0] + Math.floor(r() * (v.tegels[1] - v.tegels[0] + 1));
      const veld = [hart];
      bezet[hart.y * breed + hart.x] = 1;
      for (let poging = 0; poging < doel * 8 && veld.length < doel; poging++) {
        const van = veld[Math.floor(r() * veld.length)];
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(r() * 4)];
        const x = van.x + dx, y = van.y + dy;
        if (!vrij(x, y)) continue;
        bezet[y * breed + x] = 1;
        veld.push({ x, y });
      }
      for (const t of veld)
        afzettingen.push({ id: afzettingen.length, goed, x: t.x, y: t.y, rest: v.perTegel, variant: Math.floor(r() * 2) });
    }
  }
  return { ...terrein, soort, lopen, afzettingen, machine, opslag, ring };
}

// Het terrein is veranderd (terreinbewerker): tegelsoorten en routes opnieuw.
export function herberekenTerrein(k: Kaart): void {
  k.soort = tegelSoorten(k);
  k.lopen = maakLopen(k, k.soort, { x: k.machine.x + 2, y: k.machine.y + 2 }, k.machine);
}

// Waar lopende eenheden kunnen staan: land dat je vanaf de machine kunt bereiken zonder over water of langs een wand te gaan,
// niet op of vlak tegen de machine.
function maakLopen(t: Terrein, soort: Uint8Array, start: { x: number; y: number }, machine: Blok): Doorgang {
  const { breed, diep } = t;
  const open = openRanden(t, soort);
  const vrij = new Uint8Array(breed * diep);
  const stapel = [start.y * breed + start.x];
  vrij[stapel[0]] = 1;
  while (stapel.length) {
    const o = stapel.pop() as number, x = o % breed;
    const buren = [
      x < breed - 1 && open[o] & 1 ? o + 1 : -1,
      x > 0 && open[o - 1] & 1 ? o - 1 : -1,
      o + breed < vrij.length && open[o] & 2 ? o + breed : -1,
      o >= breed && open[o - breed] & 2 ? o - breed : -1,
    ];
    for (const b of buren) {
      if (b < 0 || vrij[b]) continue;
      vrij[b] = 1;
      stapel.push(b);
    }
  }
  for (let y = machine.y - 1; y <= machine.y + machine.diep; y++)
    for (let x = machine.x - 1; x <= machine.x + machine.breed; x++) vrij[y * breed + x] = 0;
  return { breed, diep, vrij, open, velden: new Map() };
}

export function afzettingOp(k: Kaart, x: number, y: number): Afzetting | undefined {
  return k.afzettingen.find((a) => a.x === x && a.y === y && a.rest > 0);
}

export function binnenBlok(b: Blok, x: number, y: number): boolean {
  return x >= b.x && y >= b.y && x < b.x + b.breed && y < b.y + b.diep;
}
