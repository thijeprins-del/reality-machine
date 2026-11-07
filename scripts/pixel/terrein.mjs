// Tekenscript voor de tegelsets van het terrein: per dimensie één plaatje met alle tegelvormen, water en schuim.
// Draai: node scripts/pixel/terrein.mjs. Schrijft assets/wereld/tegels-<naam>.png en src/kern/tegels.ts.
//
// Een vorm is de hoogte van de vier hoeken (achter, rechts, voor, links) ten opzichte van de laagste: 0, 1 of 2. Langs een
// rand schelen twee hoeken hooguit 1, dus een tegel is vlak of een helling (19 vormen). De kern kiest de vorm; het absolute
// niveau is alleen een verschuiving. Klippen zijn geen tegels maar wanden tussen twee tegels: die staan in een eigen plaatje
// (assets/wereld/wanden-<naam>.png), een stuk per combinatie van bovenrand, voet en hoogte.
import { Doek, hex, ruis } from './pixel.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const wortel = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
mkdirSync(join(wortel, 'assets', 'wereld'), { recursive: true });

const CEL_B = 34, CEL_H = 34; // ruimte voor een tegel plus twee niveaus omhoog
const CX = 17, CY = 25; // midden van een vlakke tegel op de laagste hoogte
const NIVEAU = 8; // sprite-pixels per hoogteniveau (HOOGTE_PX / PIXEL)
const KOLOMMEN = 27, VARIANTEN = 3;
const WATER_VARIANTEN = 3, WATER_BEELDEN = 4, SCHUIM_BEELDEN = 2;
const CEL_WATER = 81 * VARIANTEN, CEL_SCHUIM = CEL_WATER + WATER_VARIANTEN * WATER_BEELDEN;
const CELLEN = CEL_SCHUIM + 4 * SCHUIM_BEELDEN;
// De wanden: een stuk is één tegelrand breed. WAND_Y = de rij waar de bovenrand links begint; WAND_MAX = de hoogste wand.
const WAND_B = 16, WAND_H = 96, WAND_Y = 24, WAND_KOLOMMEN = 16, WAND_MAX = 6, WAND_VARIANTEN = 2;
const WAND_CELLEN = WAND_VARIANTEN * 2 * 3 * 3 * (WAND_MAX + 2);
const celWand = (variant, richting, dt, db, hP) => (((variant * 2 + richting) * 3 + dt + 1) * 3 + db + 1) * (WAND_MAX + 2) + hP + 1;

// Per dimensie de kleurtrappen, van donker naar licht. Grond: de vlakke grond zit op trede 3.
const SETS = {
  roestduin: {
    zaad: 11,
    grond: ['#3a1a0c', '#4e2410', '#622d13', '#773718', '#8c431c', '#a55326', '#c16933'],
    rots: ['#120c09', '#1e150f', '#2d2015', '#3f2d1f', '#55402d', '#70563f', '#8f7355'],
    rand: '#a68c68', // de lichte bovenrand van een klip
    water: ['#1a120a', '#241a0f', '#2e2214', '#3f2f1c', '#5a452b'],
    schuim: '#b09a72',
  },
  kristaltoendra: {
    zaad: 23,
    grond: ['#6a7f9f', '#7d93b3', '#90a6c6', '#a6bcdb', '#bbcfe8', '#cfe0f2', '#e3effa'],
    rots: ['#1c2232', '#2b3347', '#3d475f', '#515d78', '#687592', '#8491ad', '#a5b1c9'],
    rand: '#e6f2ff',
    water: ['#1b6f9a', '#2484b0', '#2f99c4', '#55bbdd', '#9fe6f5'],
    schuim: '#d8f8ff',
  },
  gifwoud: {
    zaad: 37,
    grond: ['#18300f', '#203d14', '#2a4c19', '#345c1f', '#3f6e25', '#4e842e', '#619c3a'],
    rots: ['#0b1009', '#131a0f', '#1d2716', '#2a3620', '#39482b', '#4d5f39', '#66794c'],
    rand: '#9fb878',
    water: ['#2f5e0a', '#3f7a0e', '#559c14', '#78c41e', '#b4f23c'],
    schuim: '#d6ff7a',
  },
  magmaveld: {
    zaad: 41,
    grond: ['#1c1715', '#25201d', '#2f2825', '#39312d', '#463c36', '#564a42', '#6a5b50'],
    rots: ['#070505', '#0f0b0a', '#181210', '#231a17', '#302420', '#40302a', '#554037'],
    rand: '#ff8a3a', // de rand van de wand gloeit mee
    water: ['#c22f06', '#e8480c', '#ff6a12', '#ff9a2a', '#ffd860'],
    schuim: '#fff0a8',
  },
  zoutzee: {
    zaad: 53,
    grond: ['#8f5f78', '#a8728c', '#c0849f', '#d498b2', '#e4aec4', '#f0c4d4', '#f9dbe4'],
    rots: ['#2a1724', '#3d2233', '#533046', '#6b405b', '#865372', '#a36b8c', '#c288a8'],
    rand: '#fff0fa',
    water: ['#bda6b8', '#cdb8c8', '#ddcad8', '#ecdde8', '#fff4fb'],
    schuim: '#ffffff',
  },
  aarde: {
    zaad: 67,
    grond: ['#2f4a1c', '#3a5a22', '#466c28', '#527e2f', '#619238', '#74a845', '#8cbf55'],
    rots: ['#15140f', '#222019', '#302d24', '#413d31', '#565141', '#6f6955', '#8e8770'],
    rand: '#b8b19a',
    water: ['#123f73', '#18528f', '#1f66ad', '#3f88cc', '#8cc4ee'],
    schuim: '#e8f6ff',
  },
};

const cel = (d, i) => ({ d, x: (i % KOLOMMEN) * CEL_B, y: Math.floor(i / KOLOMMEN) * CEL_H });

// De driehoeken van een tegel, met dezelfde knik als het spel (terrein.ts): langs de hoeken die het minst verschillen.
function driehoeken(a, r, v, l) {
  const A = { x: CX, y: CY - 8 - a * NIVEAU, z: a, u: 0, w: 0 };
  const R = { x: CX + 16, y: CY - r * NIVEAU, z: r, u: 1, w: 0 };
  const V = { x: CX, y: CY + 8 - v * NIVEAU, z: v, u: 1, w: 1 };
  const L = { x: CX - 16, y: CY - l * NIVEAU, z: l, u: 0, w: 1 };
  if (Math.abs(a - v) > Math.abs(r - l)) return { A, R, V, L, tri: [[A, R, L, r - a, l - a], [V, L, R, v - l, v - r]] };
  return { A, R, V, L, tri: [[A, R, V, r - a, v - r], [A, V, L, v - l, l - a]] };
}

// Hoe groot een driehoek op het scherm is. Negatief of nul: hij kijkt van je af, dus je ziet hem niet.
const zichtbaar = ([p, q, s]) => (q.x - p.x) * (s.y - p.y) - (q.y - p.y) * (s.x - p.x);

// Elke pixel van een driehoek die naar je toe kijkt. Iets ruimer dan precies, zodat er geen naden tussen de tegels vallen.
function perPixel(t, doe) {
  const [p, q, s] = t;
  const opp = zichtbaar(t);
  if (opp < 1) return;
  const x0 = Math.floor(Math.min(p.x, q.x, s.x)) - 1, x1 = Math.ceil(Math.max(p.x, q.x, s.x)) + 1;
  const y0 = Math.floor(Math.min(p.y, q.y, s.y)) - 1, y1 = Math.ceil(Math.max(p.y, q.y, s.y)) + 1;
  const rand = (a, b, x, y) => ((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)) / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const mx = x + 0.5, my = y + 0.5;
      if (rand(p, q, mx, my) < -0.5 || rand(q, s, mx, my) < -0.5 || rand(s, p, mx, my) < -0.5) continue;
      const b0 = ((q.x - mx) * (s.y - my) - (q.y - my) * (s.x - mx)) / opp;
      const b1 = ((s.x - mx) * (p.y - my) - (s.y - my) * (p.x - mx)) / opp;
      const b2 = 1 - b0 - b1;
      doe(x, y, { z: b0 * p.z + b1 * q.z + b2 * s.z, u: b0 * p.u + b1 * q.u + b2 * s.u, w: b0 * p.w + b1 * q.w + b2 * s.w });
    }
}

const trede = (ramp, i) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(i)))];

// Gewone grond: een helling krijgt licht van linksboven, in hele treden zodat de vorm van een heuvel leesbaar is.
// Vlakke tegels verschillen alleen in kleine korrels, dus zie je geen ruitjespatroon: de grond loopt door.
function tekenLand(c, set, a, r, v, l, zaad) {
  const n = ruis(zaad);
  for (const t of driehoeken(a, r, v, l).tri) landDriehoek(c, set, t, n);
}

function landDriehoek(c, set, t, n) {
  const plekken = Array.from({ length: 2 }, () => ({ u: n(), w: n(), s: 0.08 + n() * 0.12, d: n() < 0.5 ? -1 : 1 }));
  {
    const licht = (t[3] - t[4]) * 0.85 - (t[3] + t[4]) * 0.25;
    perPixel(t, (x, y, p) => {
      if (x < 0 || y < 0 || x >= CEL_B || y >= CEL_H) return;
      let i = 3 + licht + (n() - 0.5) * 0.7;
      for (const v2 of plekken) if (Math.hypot(p.u - v2.u, (p.w - v2.w) * 0.8) < v2.s) i += v2.d * 0.7;
      const k = n();
      if (k < 0.035) i -= 1.5;
      else if (k > 0.98) i += 1.5;
      c.d.zet(c.x + x, c.y + y, trede(set.grond, i));
    });
  }
}

// Een wand: het rechte stuk rots tussen twee tegels die niet op elkaar aansluiten. De bovenrand volgt de rand van de hoge tegel
// (dt = hoeveel die van links naar rechts stijgt), de voet die van de lage (db), en links is hij hP niveaus hoog. Kruisen de
// twee randen elkaar, dan is het een driehoek. richting 0 = de rand loopt op het scherm naar rechts omlaag (de wand kijkt naar
// linksonder en vangt het licht), 1 = naar rechts omhoog (hij kijkt naar rechtsonder, in de schaduw).
function tekenWand(d, ox, oy, set, richting, dt, db, hP, zaad) {
  const n = ruis(zaad);
  const basis = richting === 0 ? 3.4 : 2.2;
  const scheuren = Array.from({ length: WAND_B }, () => n() < 0.16);
  for (let x = 0; x < WAND_B; x++) {
    const s = (x + 0.5) / WAND_B;
    const h = hP + (dt - db) * s; // de hoogte van de wand in deze kolom, in niveaus
    if (h <= 0) continue;
    const yT = WAND_Y + (richting === 0 ? 8 : -8) * s - dt * NIVEAU * s;
    const y0 = Math.floor(yT), y1 = Math.floor(yT + h * NIVEAU);
    for (let y = y0; y <= y1; y++) {
      // de lagen tellen vanaf de bovenrand, zodat ze in de stukken ernaast doorlopen
      const laag = Math.floor((y - y0 + Math.sin((x * Math.PI) / 4 + set.zaad) * 0.8) / 3);
      let i = basis + (laag % 2 ? 0.7 : -0.5) + (n() - 0.5) * 0.7;
      if (scheuren[x]) i -= 1.4;
      if (y1 - y < 2 && h >= 0.5) i -= 1.6; // de voet
      d.zet(ox + x, oy + y, trede(set.rots, i));
    }
    d.zet(ox + x, oy + y0, n() < 0.8 ? set.rand : set.rots[5]); // lichte bovenrand
    // een randje schaduw en wat puin op de grond voor de wand
    for (let k = 1; k <= 3; k++) if (n() < 0.75 - k * 0.18) d.zet(ox + x, oy + y1 + k, [0, 0, 0, 90]);
    if (n() < 0.25) d.zet(ox + x, oy + y1 + 1 + Math.floor(n() * 3), trede(set.rots, 3 + n() * 2));
  }
}

function tekenWanden(naam, set) {
  const d = new Doek(WAND_KOLOMMEN * WAND_B, Math.ceil(WAND_CELLEN / WAND_KOLOMMEN) * WAND_H);
  let stukken = 0;
  for (let variant = 0; variant < WAND_VARIANTEN; variant++)
    for (let richting = 0; richting < 2; richting++)
      for (let dt = -1; dt <= 1; dt++)
        for (let db = -1; db <= 1; db++)
          for (let hP = -1; hP <= WAND_MAX; hP++) {
            const hQ = hP + dt - db;
            if ((hP <= 0 && hQ <= 0) || hQ < -1 || hQ > WAND_MAX) continue;
            const i = celWand(variant, richting, dt, db, hP);
            tekenWand(d, (i % WAND_KOLOMMEN) * WAND_B, Math.floor(i / WAND_KOLOMMEN) * WAND_H, set, richting, dt, db, hP, set.zaad * 5000 + i);
            stukken++;
          }
  d.png(join(wortel, 'assets', 'wereld', `wanden-${naam}.png`));
  return stukken;
}

// Water: een vlakke ruit, met strepen die over de beelden heen opkomen en wegebben.
function tekenWater(c, set, variant, beeld, zaad) {
  const n = ruis(zaad);
  const korrel = Array.from({ length: CEL_B * CEL_H }, () => n());
  const strepen = Array.from({ length: 4 }, () => ({ x: 6 + Math.floor(n() * 18), y: CY - 5 + Math.floor(n() * 11), l: 5 + Math.floor(n() * 6), f: Math.floor(n() * WATER_BEELDEN) }));
  const { tri } = driehoeken(0, 0, 0, 0);
  for (const t of tri)
    perPixel(t, (x, y) => {
      if (x < 0 || y < 0 || x >= CEL_B || y >= CEL_H) return;
      c.d.zet(c.x + x, c.y + y, trede(set.water, 1.5 + (korrel[y * CEL_B + x] - 0.5) * 0.6));
    });
  const opRuit = (x, y) => Math.abs(x + 0.5 - CX) / 16 + Math.abs(y + 0.5 - CY) / 8 < 0.95;
  for (const s of strepen) {
    const fase = (beeld + s.f) % WATER_BEELDEN;
    if (fase === 3) continue; // even weg
    const kleur = fase === 1 ? set.water[4] : set.water[3];
    const verschuif = fase; // de streep schuift mee met de golf
    for (let i = 0; i < s.l - (fase === 2 ? 2 : 0); i++) {
      const x = s.x + verschuif + i;
      if (opRuit(x, s.y)) c.d.zet(c.x + x, c.y + s.y, kleur);
    }
  }
}

// Schuim langs één rand van een watertegel: waar water land raakt. Rafelig en iets de tegel in.
function tekenSchuim(c, set, rand, beeld, zaad) {
  const n = ruis(zaad);
  const hoeken = [[[CX, CY - 8], [CX + 16, CY]], [[CX + 16, CY], [CX, CY + 8]], [[CX, CY + 8], [CX - 16, CY]], [[CX - 16, CY], [CX, CY - 8]]];
  const [p, q] = hoeken[rand];
  const binnenX = CX - (p[0] + q[0]) / 2, binnenY = CY - (p[1] + q[1]) / 2;
  const lang = Math.hypot(binnenX, binnenY) || 1;
  const stappen = 16;
  const kleur = hex(set.schuim);
  const zacht = [kleur[0], kleur[1], kleur[2], 120];
  for (let s = 0; s <= stappen; s++) {
    const t = s / stappen;
    const golf = 0.5 + 0.5 * Math.sin(t * 9 + zaad + (beeld * Math.PI) / SCHUIM_BEELDEN * 2);
    const x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t;
    if (n() < 0.82) c.d.zet(c.x + Math.floor(x + (binnenX / lang) * 0.5), c.y + Math.floor(y + (binnenY / lang) * 0.5), kleur);
    if (golf > 0.45 && n() < 0.6) c.d.zet(c.x + Math.floor(x + (binnenX / lang) * (1 + golf * 1.6)), c.y + Math.floor(y + (binnenY / lang) * (1 + golf * 1.6)), zacht);
  }
}

function tekenSet(naam, set) {
  const d = new Doek(KOLOMMEN * CEL_B, Math.ceil(CELLEN / KOLOMMEN) * CEL_H);
  let vormen = 0;
  for (let variant = 0; variant < VARIANTEN; variant++)
    for (let code = 0; code < 81; code++) {
      const a = Math.floor(code / 27) % 3, r = Math.floor(code / 9) % 3, v = Math.floor(code / 3) % 3, l = code % 3;
      if (Math.min(a, r, v, l) !== 0) continue; // de laagste hoek is altijd 0
      const c = cel(d, code + variant * 81);
      const zaad = set.zaad * 1000 + code * 7 + variant * 311;
      if (Math.max(Math.abs(a - r), Math.abs(r - v), Math.abs(v - l), Math.abs(l - a)) >= 2) continue; // zo steil is een tegel nooit
      if (!variant) vormen++;
      tekenLand(c, set, a, r, v, l, zaad);
    }
  for (let variant = 0; variant < WATER_VARIANTEN; variant++)
    for (let beeld = 0; beeld < WATER_BEELDEN; beeld++)
      tekenWater(cel(d, CEL_WATER + variant * WATER_BEELDEN + beeld), set, variant, beeld, set.zaad * 2000 + variant * 13);
  for (let rand = 0; rand < 4; rand++)
    for (let beeld = 0; beeld < SCHUIM_BEELDEN; beeld++)
      tekenSchuim(cel(d, CEL_SCHUIM + rand * SCHUIM_BEELDEN + beeld), set, rand, beeld, set.zaad * 3000 + rand * 17 + beeld);
  d.png(join(wortel, 'assets', 'wereld', `tegels-${naam}.png`));
  return vormen;
}

for (const [naam, set] of Object.entries(SETS)) console.log(`${naam}: ${tekenSet(naam, set)} vormen, ${tekenWanden(naam, set)} stukken wand`);

writeFileSync(
  join(wortel, 'src', 'kern', 'tegels.ts'),
  `// Gegenereerd door scripts/pixel/terrein.mjs. Niet met de hand aanpassen.
// De indeling van een tegelset-plaatje (assets/wereld/tegels-<naam>.png), in sprite-pixels.
export const TEGELSETS = [${Object.keys(SETS).map((n) => `'${n}'`).join(', ')}] as const;
export type TegelSet = (typeof TEGELSETS)[number];
export const CEL_B = ${CEL_B}, CEL_H = ${CEL_H}, CEL_X = ${CX}, CEL_Y = ${CY}, KOLOMMEN = ${KOLOMMEN};
export const VARIANTEN = ${VARIANTEN}, WATER_VARIANTEN = ${WATER_VARIANTEN}, WATER_BEELDEN = ${WATER_BEELDEN}, SCHUIM_BEELDEN = ${SCHUIM_BEELDEN};

// Hoeken ten opzichte van de laagste (0, 1 of 2): achter, rechts, voor, links.
export const celLand = (a: number, r: number, v: number, l: number, variant: number) => a * 27 + r * 9 + v * 3 + l + variant * 81;
export const celWater = (variant: number, beeld: number) => ${CEL_WATER} + variant * WATER_BEELDEN + beeld;
// rand: 0 = achter-rechts, 1 = rechts-voor, 2 = voor-links, 3 = links-achter
export const celSchuim = (rand: number, beeld: number) => ${CEL_SCHUIM} + rand * SCHUIM_BEELDEN + beeld;

// De wanden (assets/wereld/wanden-<naam>.png). Een stuk is één tegelrand breed; de bovenrand begint links op rij WAND_Y.
export const WAND_B = ${WAND_B}, WAND_H = ${WAND_H}, WAND_Y = ${WAND_Y}, WAND_KOLOMMEN = ${WAND_KOLOMMEN}, WAND_MAX = ${WAND_MAX}, WAND_VARIANTEN = ${WAND_VARIANTEN};
// richting: 0 = de rand loopt op het scherm naar rechts omlaag, 1 = naar rechts omhoog. dt en db: hoeveel de bovenrand en de
// voet van links naar rechts stijgen (-1, 0, 1). hP: hoe hoog de wand links is (-1 als de randen elkaar kruisen).
export const celWand = (variant: number, richting: number, dt: number, db: number, hP: number) =>
  (((variant * 2 + richting) * 3 + dt + 1) * 3 + db + 1) * (WAND_MAX + 2) + hP + 1;
`,
);
