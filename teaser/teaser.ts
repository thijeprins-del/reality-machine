// Teaser van Reality Machine: een levend diorama met de echte sprites uit assets/.
// Een zwevend stuk muizenindustrie werkt door, tot de stream komt: dan springt alles naar de volgende dimensie.
// Gewoon canvas 2D (geen Pixi): de pagina moet licht zijn, ook als kaartje in een iframe op thijeprins.nl.
// ?kaart = compacte versie voor in een kaart, ?og = stilstaand beeld voor de og-image (scripts/teaser-og.mjs).
import { MUIZEN_SPRITES } from '../src/muizen/sprites';
import { WERELD_SPRITES } from '../src/kern/wereld-sprites';

type Naam = keyof typeof MUIZEN_SPRITES | keyof typeof WERELD_SPRITES;
const SPRITES: Record<string, { w: number; h: number; ankerX: number; ankerY: number; tegels: number; gloed: boolean }> = {
  ...MUIZEN_SPRITES,
  ...WERELD_SPRITES,
};

const bestanden = import.meta.glob(['../assets/muizen/*.png', '../assets/wereld/*.png'], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const zoek = new URLSearchParams(location.search);
const KAART = zoek.has('kaart');
const OG = zoek.has('og');
if (KAART) document.body.classList.add('kaart');
if (OG) document.body.classList.add('og');

// ---------- iso: 1 bufferpixel = 1 sprite-pixel, een tegel is 32 x 16 ----------
const N = 14; // eiland van N x N tegels
const iso = (k: number, r: number) => ({ x: (k - r) * 16, y: (k + r) * 8 });

// ---------- toeval met zaad (beeld moet bij ?og elke keer hetzelfde zijn) ----------
let zaad = 20261101;
const rnd = () => {
  zaad = (zaad * 1664525 + 1013904223) >>> 0;
  return zaad / 4294967296;
};

// ---------- dimensies: elke sprong een andere wereld ----------
interface Dimensie {
  nr: string;
  naam: string;
  boven: string;
  onder: string;
  ring: string;
  grond: [number, number, number];
  deeltje: 'regen' | 'scherven' | 'as' | 'vuurvliegjes' | 'bellen';
  kleur: string;
  zin: string;
}
const DIMENSIES: Dimensie[] = [
  { nr: '0413', naam: 'ROESTREGEN', boven: '#24110a', onder: '#060302', ring: '#ff7a1a', grond: [46, 40, 36], deeltje: 'regen', kleur: '#ff9a4a', zin: 'Het regent roest. De muizen merken het niet eens.' },
  { nr: '2207', naam: 'KRISTALNACHT', boven: '#081a33', onder: '#02040a', ring: '#3ff0ff', grond: [34, 40, 50], deeltje: 'scherven', kleur: '#7ff6ff', zin: 'Kristal groeit hier uit de lucht. Graaf snel.' },
  { nr: '0666', naam: 'DE ASVLAKTE', boven: '#1f1414', onder: '#050404', ring: '#ff2e4a', grond: [44, 40, 40], deeltje: 'as', kleur: '#b9aaa6', zin: 'Hier was ooit iemand anders zijn fabriek.' },
  { nr: '9001', naam: 'NEONMOERAS', boven: '#0b2214', onder: '#020604', ring: '#9dff2e', grond: [32, 42, 34], deeltje: 'vuurvliegjes', kleur: '#c6ff5a', zin: 'Alles gloeit. Ook dingen die niet zouden moeten gloeien.' },
  { nr: '3141', naam: 'OTTERWATER', boven: '#06202a', onder: '#010508', ring: '#2bd1a0', grond: [30, 40, 44], deeltje: 'bellen', kleur: '#8ff0ff', zin: 'Het ruikt hier naar otter. Dat is geen goed teken.' },
];
const DIM_DUUR = 13; // seconden per dimensie in de teaser (in het spel: 4 minuten)

// ---------- de scène ----------
interface Ding {
  naam: Naam;
  k: number;
  r: number;
  spiegel?: boolean;
  blok?: boolean; // muizen lopen er niet doorheen
}
const DINGEN: Ding[] = [
  { naam: 'machine', k: 5, r: 4, blok: true },
  { naam: 'boor', k: 1, r: 0, blok: true },
  { naam: 'band', k: 3, r: 1 },
  { naam: 'band', k: 4, r: 1 },
  { naam: 'pers', k: 5, r: 0, blok: true },
  { naam: 'band', k: 7, r: 2, spiegel: true },
  { naam: 'band', k: 7, r: 3, spiegel: true },
  { naam: 'dynamo', k: 1, r: 4, blok: true },
  { naam: 'mast', k: 1, r: 8, blok: true },
  { naam: 'mast', k: 3, r: 8, blok: true },
  { naam: 'kabels', k: 1, r: 8 },
  { naam: 'mast', k: 10, r: 1, blok: true },
  { naam: 'mast', k: 12, r: 1, blok: true },
  { naam: 'kabels', k: 10, r: 1 },
  { naam: 'mech', k: 10, r: 8, blok: true },
  { naam: 'opslag', k: 5, r: 10, blok: true },
  { naam: 'sjouwbot', k: 1, r: 11, blok: true },
  { naam: 'kristal-1', k: 12, r: 4, blok: true },
  { naam: 'kristal-2', k: 13, r: 5, blok: true },
  { naam: 'kristal-1', k: 12, r: 6, blok: true },
  { naam: 'schroot-1', k: 9, r: 12, blok: true },
  { naam: 'schroot-2', k: 10, r: 13, blok: true },
  { naam: 'schroot-1', k: 12, r: 12, blok: true },
  { naam: 'hout-1', k: 0, r: 7, blok: true },
  { naam: 'hout-2', k: 0, r: 9, blok: true },
];

// bezette tegels
const bezet = new Set<string>();
for (const d of DINGEN) {
  if (!d.blok) continue;
  const t = Math.max(1, SPRITES[d.naam].tegels);
  for (let i = 0; i < t; i++) for (let j = 0; j < t; j++) bezet.add(`${d.k + i},${d.r + j}`);
}
const vrij = (k: number, r: number) => k >= 0 && r >= 0 && k < N && r < N && !bezet.has(`${k},${r}`);

// grondstofplekken: een vrije tegel naast de stapel
const BRONNEN: { soort: 'schroot' | 'hout' | 'kristal'; k: number; r: number }[] = [];
for (const d of DINGEN) {
  const soort = d.naam.startsWith('kristal') ? 'kristal' : d.naam.startsWith('schroot') ? 'schroot' : d.naam.startsWith('hout') ? 'hout' : null;
  if (!soort) continue;
  for (const [dk, dr] of [[-1, 0], [0, -1], [1, 0], [0, 1]]) {
    if (vrij(d.k + dk, d.r + dr)) {
      BRONNEN.push({ soort, k: d.k + dk, r: d.r + dr });
      break;
    }
  }
}
const OPSLAG_DEUR = { k: 7, r: 10 };

function pad(a: { k: number; r: number }, b: { k: number; r: number }): { k: number; r: number }[] {
  const sleutel = (k: number, r: number) => k * 100 + r;
  const vorige = new Map<number, number>([[sleutel(a.k, a.r), -1]]);
  const rij = [[a.k, a.r]];
  while (rij.length) {
    const [k, r] = rij.shift()!;
    if (k === b.k && r === b.r) break;
    for (const [dk, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = k + dk, nr = r + dr;
      if (!vrij(nk, nr) && !(nk === b.k && nr === b.r)) continue;
      if (vorige.has(sleutel(nk, nr))) continue;
      vorige.set(sleutel(nk, nr), sleutel(k, r));
      rij.push([nk, nr]);
    }
  }
  const uit: { k: number; r: number }[] = [];
  let s = sleutel(b.k, b.r);
  if (!vorige.has(s)) return [b];
  while (s !== -1) {
    uit.unshift({ k: Math.floor(s / 100), r: s % 100 });
    s = vorige.get(s)!;
  }
  return uit;
}
const padCache = new Map<string, { k: number; r: number }[]>();
const zoekPad = (a: { k: number; r: number }, b: { k: number; r: number }) => {
  const s = `${a.k},${a.r}>${b.k},${b.r}`;
  if (!padCache.has(s)) padCache.set(s, pad(a, b));
  return padCache.get(s)!;
};

// ---------- muizen ----------
interface Muis {
  k: number;
  r: number;
  dx: number;
  dy: number;
  route: { k: number; r: number }[];
  doel: 'bron' | 'opslag';
  bron: (typeof BRONNEN)[number];
  wacht: number;
  last: 'schroot' | 'hout' | 'kristal' | null;
  kijkt: 1 | -1;
  fase: number;
  snel: number;
  monteur: boolean;
}
const muizen: Muis[] = [];
const AANTAL = KAART ? 46 : 74;
for (let i = 0; i < AANTAL; i++) {
  const bron = BRONNEN[i % BRONNEN.length];
  // begin ergens op de route tussen bron en opslag
  const route = zoekPad(OPSLAG_DEUR, bron);
  const start = route[Math.floor(rnd() * route.length)];
  muizen.push({
    k: start.k, r: start.r, dx: (rnd() - 0.5) * 0.6, dy: (rnd() - 0.5) * 0.6,
    route: zoekPad(start, bron).slice(1), doel: 'bron', bron, wacht: rnd() * 2, last: null,
    kijkt: 1, fase: rnd() * 10, snel: 1.1 + rnd() * 0.7, monteur: i % 9 === 0,
  });
}

function stapMuis(m: Muis, dt: number): void {
  if (m.wacht > 0) {
    m.wacht -= dt;
    if (m.wacht <= 0) {
      if (m.doel === 'bron') {
        m.last = m.bron.soort;
        m.doel = 'opslag';
        m.route = zoekPad(m.bron, OPSLAG_DEUR).slice(1);
      } else {
        m.last = null;
        m.bron = BRONNEN[Math.floor(rnd() * BRONNEN.length)];
        m.doel = 'bron';
        m.route = zoekPad(OPSLAG_DEUR, m.bron).slice(1);
      }
    }
    return;
  }
  const doel = m.route[0];
  if (!doel) {
    m.wacht = m.doel === 'bron' ? 1.2 + rnd() * 1.5 : 0.3;
    return;
  }
  const vk = doel.k - m.k, vr = doel.r - m.r;
  const af = Math.hypot(vk, vr);
  const stap = m.snel * dt;
  const sx = vk - vr; // schermrichting
  if (Math.abs(sx) > 0.01) m.kijkt = sx > 0 ? 1 : -1;
  if (af <= stap) {
    m.k = doel.k;
    m.r = doel.r;
    m.route.shift();
  } else {
    m.k += (vk / af) * stap;
    m.r += (vr / af) * stap;
  }
}

// ---------- spullen op de banden ----------
// band 1: boor -> pers langs kol op rij 1.5; band 2: pers -> machine langs rij op kol 7.5
const BANDEN = [
  { van: { k: 2.9, r: 1.5 }, naar: { k: 5.1, r: 1.5 }, kleur: '#ffb347' },
  { van: { k: 7.5, r: 1.9 }, naar: { k: 7.5, r: 4.1 }, kleur: '#3ff0ff' },
];

// ---------- plaatjes laden ----------
const plaatjes = new Map<string, HTMLImageElement>();
function laad(naam: string): Promise<void> {
  const sleutel = Object.keys(bestanden).find((k) => k.endsWith(`/${naam}.png`));
  if (!sleutel) return Promise.resolve();
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      plaatjes.set(naam, img);
      ok();
    };
    img.onerror = () => ok();
    img.src = bestanden[sleutel];
  });
}

// ---------- canvassen ----------
const scherm = document.getElementById('scene') as HTMLCanvasElement;
const sc = scherm.getContext('2d')!;
const buf = document.createElement('canvas');
const bc = buf.getContext('2d')!;
const gl = document.createElement('canvas'); // alleen neon
const gc = gl.getContext('2d')!;
const waas1 = document.createElement('canvas');
const w1 = waas1.getContext('2d')!;
const waas2 = document.createElement('canvas');
const w2 = waas2.getContext('2d')!;
const eilandC = document.createElement('canvas'); // grond van het eiland, eenmaal per dimensie getekend
const ec = eilandC.getContext('2d')!;

let schaal = 1, bw = 0, bh = 0, midX = 0, midY = 0;
const SCENE_B = 560, SCENE_H = 420; // ruwe maat van het diorama in sprite-pixels

function maat(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.max(1, Math.round(scherm.clientWidth * dpr));
  const ch = Math.max(1, Math.round(scherm.clientHeight * dpr));
  scherm.width = cw;
  scherm.height = ch;
  const breedBeeld = !KAART && cw / ch > 1.25;
  // op een breed scherm staat de tekst links, dus het eiland mag wat groter en naar rechts
  let s = Math.min(cw / (SCENE_B * (breedBeeld ? 1.3 : 1)), ch / SCENE_H);
  if (KAART) s = Math.min(cw / 470, ch / 340);
  // hele pixelmaten blijven scherp; liever iets afsnijden dan een te klein eiland
  schaal = s >= 1 ? Math.max(1, Math.round(s)) : s;
  bw = Math.ceil(cw / schaal);
  bh = Math.ceil(ch / schaal);
  for (const c of [buf, gl]) {
    c.width = bw;
    c.height = bh;
  }
  waas1.width = Math.ceil(bw / 3);
  waas1.height = Math.ceil(bh / 3);
  waas2.width = Math.ceil(bw / 9);
  waas2.height = Math.ceil(bh / 9);
  midX = Math.round(breedBeeld ? bw * 0.64 : bw / 2);
  midY = Math.round(bh / 2 - (KAART ? 30 : 48) + (KAART ? 0 : 10));
}

// ---------- het eiland ----------
const DIKTE = 26;
function tekenEiland(d: Dimensie): void {
  const b = N * 32 + 8, h = N * 16 + DIKTE + 70;
  eilandC.width = b;
  eilandC.height = h;
  ec.clearRect(0, 0, b, h);
  const ox = b / 2, oy = 4 + 8;
  zaad = 777 + d.nr.charCodeAt(0);
  const [gr, gg, gb] = d.grond;
  // onderkant: ruwe rots die naar beneden spits toeloopt
  for (let x = 0; x < b; x++) {
    const rel = Math.abs(x - ox) / (N * 16);
    const bovenkant = oy + N * 8 + (1 - rel) * N * 8 - 8;
    const diep = DIKTE + (1 - rel * rel) * 46 + rnd() * 6;
    for (let y = 0; y < diep; y++) {
      const f = 1 - y / diep;
      const v = 18 + f * 22 + rnd() * 8;
      ec.fillStyle = `rgb(${v + 6},${v},${v - 4})`;
      ec.fillRect(x, Math.round(bovenkant + y), 1, 1);
    }
  }
  // tegels: grauw beton met vuil, roest en hier en daar een vlek olie
  for (let r = 0; r < N; r++) {
    for (let k = 0; k < N; k++) {
      const p = iso(k, r);
      const v = ((k + r) % 2 ? 0 : 5) + rnd() * 6;
      for (let y = -8; y < 8; y++) {
        const half = 16 - Math.abs(y + 0.5) * 2;
        for (let x = -half; x < half; x++) {
          const ruis = rnd() * 7;
          const rand = Math.abs(y + 0.5) * 2 + Math.abs(x + 0.5) > 15;
          const c = rand ? 0.72 : 1;
          ec.fillStyle = `rgb(${(gr + v + ruis) * c | 0},${(gg + v + ruis) * c | 0},${(gb + v + ruis) * c | 0})`;
          ec.fillRect(ox + p.x + x, oy + p.y + y, 1, 1);
        }
      }
      if (rnd() < 0.18) {
        ec.fillStyle = 'rgba(70,40,20,.55)';
        ec.fillRect(ox + p.x - 4 + rnd() * 8, oy + p.y - 2 + rnd() * 4, 3 + rnd() * 4, 1 + rnd() * 2);
      }
      if (rnd() < 0.08) {
        ec.fillStyle = 'rgba(0,0,0,.45)';
        ec.fillRect(ox + p.x - 3, oy + p.y - 1, 6, 2);
        ec.fillRect(ox + p.x - 2, oy + p.y - 2, 4, 4);
      }
    }
  }
  // gevarenstrepen langs de voorranden
  for (let i = 0; i < N * 16; i += 1) {
    const geel = Math.floor(i / 4) % 2 === 0;
    ec.fillStyle = geel ? '#a8861c' : '#141210';
    // linkervoorrand: van (0,N) naar (N,N)
    const pl = iso(i / 16, N - 0.06);
    ec.fillRect(ox + pl.x - 16 + 16, oy + pl.y - 8 + 8 - 1, 1, 2);
    const pr = iso(N - 0.06, i / 16);
    ec.fillRect(ox + pr.x, oy + pr.y - 1, 1, 2);
  }
}

// ---------- deeltjes (weer van de dimensie, vonken, stoom) ----------
interface Deeltje { x: number; y: number; vx: number; vy: number; leven: number; max: number; kleur: string; gloed: boolean; maat: number }
const deeltjes: Deeltje[] = [];
function weer(d: Dimensie, dt: number): void {
  const kans = { regen: 90, scherven: 14, as: 30, vuurvliegjes: 6, bellen: 10 }[d.deeltje] * dt * (bw * bh) / 300000;
  let n = Math.floor(kans) + (rnd() < kans % 1 ? 1 : 0);
  while (n--) {
    const x = rnd() * bw, y = rnd() * bh;
    switch (d.deeltje) {
      case 'regen': deeltjes.push({ x, y: -10, vx: -30, vy: 260 + rnd() * 80, leven: 0, max: 3, kleur: d.kleur, gloed: rnd() < 0.3, maat: 1 }); break;
      case 'scherven': deeltjes.push({ x, y: bh + 5, vx: 0, vy: -20 - rnd() * 30, leven: 0, max: 14, kleur: d.kleur, gloed: true, maat: 1 + (rnd() < 0.3 ? 1 : 0) }); break;
      case 'as': deeltjes.push({ x, y: -5, vx: 10 + rnd() * 10, vy: 14 + rnd() * 14, leven: 0, max: 30, kleur: d.kleur, gloed: false, maat: 1 }); break;
      case 'vuurvliegjes': deeltjes.push({ x, y, vx: (rnd() - 0.5) * 16, vy: (rnd() - 0.5) * 16, leven: 0, max: 4 + rnd() * 3, kleur: d.kleur, gloed: true, maat: 1 }); break;
      case 'bellen': deeltjes.push({ x, y: bh + 4, vx: 0, vy: -16 - rnd() * 20, leven: 0, max: 30, kleur: d.kleur, gloed: rnd() < 0.5, maat: 1 + (rnd() < 0.2 ? 1 : 0) }); break;
    }
  }
}

// ---------- staat van de stream ----------
let dimIx = 0;
let dimT = OG ? 4 : 2; // tijd in deze dimensie
let sprong = -1; // >= 0 tijdens de sprong zelf
let flits = 0;
let t = 0;
let bliksem: { x: number; y: number }[][] = [];
const hudNaam = document.getElementById('dimNaam');
const hudTijd = document.getElementById('streamTijd');
const hudZin = document.getElementById('dimZin');
const balk = document.getElementById('streamBalk');

function zetHud(): void {
  const d = DIMENSIES[dimIx];
  if (hudNaam) hudNaam.textContent = `DIMENSIE ${d.nr} · ${d.naam}`;
  if (hudZin) hudZin.textContent = d.zin;
  document.documentElement.style.setProperty('--dim', d.ring);
}

function machineTop(): { x: number; y: number } {
  const p = iso(5, 4);
  return { x: p.x + 2, y: p.y - 8 - 258 + 18 };
}

function maakBliksem(eilandY: number): void {
  const top = machineTop();
  bliksem = [];
  const n = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const hoek = -Math.PI / 2 + (rnd() - 0.5) * 2.4;
    const doelX = top.x + Math.cos(hoek) * 230, doelY = top.y + eilandY + Math.sin(hoek) * 110;
    const lijn = [{ x: top.x, y: top.y + eilandY }];
    const stappen = 9;
    for (let s = 1; s <= stappen; s++) {
      const f = s / stappen;
      lijn.push({ x: top.x + (doelX - top.x) * f + (rnd() - 0.5) * 22, y: top.y + eilandY + (doelY - top.y - eilandY) * f + (rnd() - 0.5) * 22 });
    }
    bliksem.push(lijn);
  }
}

// ---------- tekenen ----------
function sprite(c: CanvasRenderingContext2D, naam: string, ax: number, ay: number, spiegel: boolean, m = SPRITES[naam]): void {
  const img = plaatjes.get(naam);
  if (!img) return;
  if (spiegel) {
    c.save();
    c.translate(Math.round(ax), Math.round(ay - m.ankerY));
    c.scale(-1, 1);
    c.drawImage(img, -m.ankerX, 0);
    c.restore();
  } else {
    c.drawImage(img, Math.round(ax - m.ankerX), Math.round(ay - m.ankerY));
  }
}

function tekenFrame(dt: number): void {
  const d = DIMENSIES[dimIx];
  const tot = DIM_DUUR - dimT;

  // eilandpositie: zweeft, schudt voor de sprong, schiet weg in de sprong, valt in na aankomst
  let ey = Math.sin(t * 1.3) * 3;
  let ex = 0;
  if (tot < 3 && sprong < 0) {
    const f = 1 - tot / 3;
    ex += (rnd() - 0.5) * f * 4;
    ey += (rnd() - 0.5) * f * 4;
  }
  if (sprong >= 0) ey -= sprong * sprong * 2600;
  if (dimT < 0.9 && sprong < 0) {
    const f = dimT / 0.9;
    const terug = 1 - f;
    ey += terug * terug * 340 - Math.sin(f * Math.PI) * 10 * terug;
  }
  ex = Math.round(ex);
  ey = Math.round(ey);
  const ox = midX + ex, oy = midY + ey;

  // lucht
  const lucht = bc.createLinearGradient(0, 0, 0, bh);
  lucht.addColorStop(0, d.boven);
  lucht.addColorStop(1, d.onder);
  bc.fillStyle = lucht;
  bc.fillRect(0, 0, bw, bh);
  gc.clearRect(0, 0, bw, bh);

  // verre sterren / stof
  zaad = 4242;
  for (let i = 0; i < 90; i++) {
    const x = (rnd() * bw + t * (2 + i % 3)) % bw, y = rnd() * bh;
    const a = 0.15 + 0.35 * Math.abs(Math.sin(t * 0.7 + i));
    bc.fillStyle = `rgba(220,220,230,${a.toFixed(2)})`;
    bc.fillRect(x | 0, y | 0, 1, 1);
  }
  zaad = (t * 1000) | 0;

  // de stream: een poort achter het eiland, die opgeladen wordt naarmate de sprong nadert
  const laad = Math.max(0, 1 - tot / 4);
  const ringX = midX, ringY = midY - 60;
  const rx = 250 + laad * 25, ry = 150 + laad * 15;
  const draai = t * (0.25 + laad * 2.5);
  for (const c of [bc, gc]) {
    c.save();
    c.translate(ringX, ringY);
    c.strokeStyle = d.ring;
    // buitenring: grove streepjes die draaien; binnenring: fijne stippen die de andere kant op gaan
    c.lineWidth = 2;
    c.setLineDash([14, 7]);
    c.lineDashOffset = -draai * 120;
    c.globalAlpha = c === bc ? 0.7 : 0.35 + laad * 0.65;
    c.beginPath();
    c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 1;
    c.setLineDash([2, 9]);
    c.lineDashOffset = draai * 200;
    c.globalAlpha = c === bc ? 0.4 : 0.2 + laad * 0.5;
    c.beginPath();
    c.ellipse(0, 0, rx * 0.88, ry * 0.88, 0, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    c.restore();
  }
  bc.globalAlpha = 1;
  gc.globalAlpha = 1;

  // eiland
  if (eilandC.width) bc.drawImage(eilandC, ox - eilandC.width / 2, oy - 12);

  // alles met diepte sorteren
  const lijst: { diep: number; doe: () => void }[] = [];
  for (const ding of DINGEN) {
    const m = SPRITES[ding.naam];
    const t2 = Math.max(1, m.tegels);
    const p = iso(ding.k, ding.r);
    const ax = ox + p.x, ay = oy + p.y - 8;
    let bob = 0;
    if (ding.naam === 'mech') bob = Math.sin(t * 1.1) > 0.6 ? -1 : 0;
    if (ding.naam === 'pers') bob = Math.sin(t * 5) > 0.7 ? 1 : 0;
    const diep = (ding.k + ding.r + 2 * (t2 - 1)) * 10 + (ding.naam === 'kabels' ? 5 : 0);
    lijst.push({
      diep,
      doe: () => {
        sprite(bc, ding.naam, ax, ay + bob, !!ding.spiegel, m);
        if (m.gloed) sprite(gc, `${ding.naam}-gloed`, ax, ay + bob, !!ding.spiegel, m);
      },
    });
  }
  for (const mu of muizen) {
    const p = iso(mu.k + mu.dx, mu.r + mu.dy);
    const loopt = mu.wacht <= 0;
    const hup = loopt ? (Math.sin(t * 14 + mu.fase) > 0.3 ? 1 : 0) : Math.sin(t * 22 + mu.fase) > 0 ? 1 : 0;
    const naam = mu.last ? `muis-${mu.last}` : mu.monteur ? 'muis-monteur' : 'muis';
    lijst.push({
      diep: (mu.k + mu.dx + mu.r + mu.dy) * 10 + 3,
      doe: () => {
        sprite(bc, naam, ox + p.x, oy + p.y - hup, mu.kijkt < 0);
        sprite(gc, `${naam}-gloed`, ox + p.x, oy + p.y - hup, mu.kijkt < 0, SPRITES[naam]);
      },
    });
  }
  // spullen op de banden
  for (const band of BANDEN) {
    for (let i = 0; i < 5; i++) {
      const f = ((t * 0.35 + i / 5) % 1);
      const k = band.van.k + (band.naar.k - band.van.k) * f, r = band.van.r + (band.naar.r - band.van.r) * f;
      const p = iso(k, r);
      lijst.push({
        diep: (k + r) * 10 + 4,
        doe: () => {
          bc.fillStyle = '#222';
          bc.fillRect(ox + p.x - 2, oy + p.y - 7, 4, 3);
          bc.fillStyle = band.kleur;
          bc.fillRect(ox + p.x - 1, oy + p.y - 7, 2, 2);
          gc.fillStyle = band.kleur;
          gc.fillRect(ox + p.x - 1, oy + p.y - 7, 2, 2);
        },
      });
    }
  }
  lijst.sort((a, b) => a.diep - b.diep);
  for (const l of lijst) l.doe();

  // stoom uit de machine en vonken uit de boor
  if (rnd() < dt * 6) {
    const top = machineTop();
    deeltjes.push({ x: ox + top.x - 30 + rnd() * 40, y: oy + top.y + 60, vx: (rnd() - 0.5) * 6, vy: -10 - rnd() * 8, leven: 0, max: 3, kleur: '#6b6b70', gloed: false, maat: 2 });
  }
  if (rnd() < dt * 10) {
    const p = iso(2, 1);
    deeltjes.push({ x: ox + p.x, y: oy + p.y - 4, vx: (rnd() - 0.5) * 60, vy: -30 - rnd() * 40, leven: 0, max: 0.6, kleur: '#ffd23f', gloed: true, maat: 1 });
  }

  // deeltjes
  for (let i = deeltjes.length - 1; i >= 0; i--) {
    const q = deeltjes[i];
    q.leven += dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    if (q.kleur === '#ffd23f') q.vy += 120 * dt;
    if (q.leven > q.max || q.y > bh + 20 || q.y < -30) {
      deeltjes.splice(i, 1);
      continue;
    }
    const a = Math.min(1, (q.max - q.leven) * 2);
    bc.globalAlpha = a * (q.gloed ? 1 : 0.7);
    bc.fillStyle = q.kleur;
    const h = d.deeltje === 'regen' && q.kleur === d.kleur ? 4 : q.maat;
    bc.fillRect(q.x | 0, q.y | 0, q.maat, h);
    if (q.gloed) {
      gc.globalAlpha = a;
      gc.fillStyle = q.kleur;
      gc.fillRect(q.x | 0, q.y | 0, q.maat, h);
    }
  }
  bc.globalAlpha = 1;
  gc.globalAlpha = 1;

  // bliksem tussen machine en poort, vlak voor de sprong
  if (tot < 2.5 && sprong < 0 && !OG) {
    if (rnd() < dt * (4 + (2.5 - tot) * 10)) maakBliksem(0);
    for (const lijn of bliksem) {
      for (const c of [bc, gc]) {
        c.strokeStyle = c === bc ? '#ffffff' : d.ring;
        c.lineWidth = 1;
        c.beginPath();
        lijn.forEach((p, i) => (i ? c.lineTo(ox + p.x + 0.5, oy + p.y + 0.5) : c.moveTo(ox + p.x + 0.5, oy + p.y + 0.5)));
        c.stroke();
      }
    }
    if (rnd() < 0.3) bliksem = [];
  }

  // naar het scherm: pixels scherp, gloed zacht
  sc.globalCompositeOperation = 'source-over';
  sc.globalAlpha = 1;
  sc.imageSmoothingEnabled = schaal < 1;
  sc.drawImage(buf, 0, 0, bw * schaal, bh * schaal);
  sc.globalCompositeOperation = 'lighter';
  sc.drawImage(gl, 0, 0, bw * schaal, bh * schaal);
  // bloom: verkleinen en weer opblazen met gladmaken = goedkope blur, werkt in elke browser
  w1.clearRect(0, 0, waas1.width, waas1.height);
  w1.imageSmoothingEnabled = true;
  w1.drawImage(gl, 0, 0, waas1.width, waas1.height);
  w2.clearRect(0, 0, waas2.width, waas2.height);
  w2.imageSmoothingEnabled = true;
  w2.drawImage(waas1, 0, 0, waas2.width, waas2.height);
  const flikker = Math.random() < 0.012 && !OG ? 0.4 : 1;
  sc.imageSmoothingEnabled = true;
  sc.globalAlpha = (0.9 + 0.1 * Math.sin(t * 2.1) * Math.sin(t * 7.3)) * flikker * (1 + laad * 0.6);
  sc.drawImage(waas1, 0, 0, bw * schaal, bh * schaal);
  sc.drawImage(waas1, 0, 0, bw * schaal, bh * schaal);
  sc.globalAlpha = 0.9 * flikker * (1 + laad);
  sc.drawImage(waas2, 0, 0, bw * schaal, bh * schaal);
  sc.drawImage(waas2, 0, 0, bw * schaal, bh * schaal);
  sc.globalAlpha = 1;
  sc.globalCompositeOperation = 'source-over';

  // sprong: glitch-plakken en een witte flits
  if (sprong >= 0 || flits > 0) {
    const sterk = Math.max(flits, sprong >= 0 ? 1 : 0);
    const n = Math.floor(6 + sterk * 10);
    for (let i = 0; i < n; i++) {
      const y = Math.floor(Math.random() * scherm.height);
      const h = Math.floor(4 + Math.random() * 40);
      const dx = Math.floor((Math.random() - 0.5) * 80 * sterk);
      sc.drawImage(scherm, 0, y, scherm.width, h, dx, y, scherm.width, h);
    }
    sc.fillStyle = `rgba(255,255,255,${Math.min(1, flits).toFixed(2)})`;
    sc.fillRect(0, 0, scherm.width, scherm.height);
  }
  // scanlines
  sc.fillStyle = 'rgba(0,0,0,.18)';
  const stap = Math.max(2, Math.round(schaal * 2));
  for (let y = 0; y < scherm.height; y += stap) sc.fillRect(0, y, scherm.width, 1);
  // vignet
  const v = sc.createRadialGradient(scherm.width / 2, scherm.height / 2, scherm.height * 0.35, scherm.width / 2, scherm.height / 2, scherm.height * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.7)');
  sc.fillStyle = v;
  sc.fillRect(0, 0, scherm.width, scherm.height);
}

// ---------- de lus ----------
let vorige = performance.now();
function lus(nu: number): void {
  const dt = Math.min(0.05, (nu - vorige) / 1000);
  vorige = nu;
  t += dt;
  const d = DIMENSIES[dimIx];
  if (sprong >= 0) {
    sprong += dt;
    flits = Math.min(1, sprong * 3);
    if (sprong > 0.45) {
      sprong = -1;
      flits = 1;
      dimIx = (dimIx + 1) % DIMENSIES.length;
      dimT = 0;
      deeltjes.length = 0;
      tekenEiland(DIMENSIES[dimIx]);
      zetHud();
    }
  } else {
    dimT += dt;
    flits = Math.max(0, flits - dt * 2.2);
    if (dimT >= DIM_DUUR) sprong = 0;
  }
  weer(d, dt);
  for (const m of muizen) stapMuis(m, dt);
  tekenFrame(dt);

  const rest = Math.max(0, DIM_DUUR - dimT);
  if (hudTijd) hudTijd.textContent = sprong >= 0 ? 'SPRONG' : `00:${String(Math.ceil(rest)).padStart(2, '0')}`;
  if (balk) balk.style.transform = `scaleX(${sprong >= 0 ? 0 : (rest / DIM_DUUR).toFixed(3)})`;
  document.body.classList.toggle('alarm', rest < 3 && sprong < 0);
  if (!OG) requestAnimationFrame(lus);
}

// ---------- aftellen naar het einde van Game Off ----------
const EINDE = Date.UTC(2026, 11, 1, 21, 37); // 1 december 2026, 22:37 NL-tijd
function aftellen(): void {
  const el = document.getElementById('aftel');
  if (!el) return;
  const s = Math.max(0, Math.floor((EINDE - Date.now()) / 1000));
  const dagen = Math.floor(s / 86400), uur = Math.floor((s % 86400) / 3600), min = Math.floor((s % 3600) / 60), sec = s % 60;
  el.textContent = `${dagen}d ${String(uur).padStart(2, '0')}u ${String(min).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
}

// ---------- links: werkt op /reality-machine/ (release) en op /reality-machine/dev/teaser/ ----------
const inTeaserMap = location.pathname.includes('/teaser');
for (const a of document.querySelectorAll<HTMLAnchorElement>('a[data-dev]')) a.href = inTeaserMap ? '../' : 'dev/';

async function start(): Promise<void> {
  const namen = new Set<string>(['muis', 'muis-monteur', 'muis-schroot', 'muis-hout', 'muis-kristal']);
  for (const d of DINGEN) namen.add(d.naam);
  await Promise.all(
    [...namen].flatMap((n) => [laad(n), SPRITES[n]?.gloed ? laad(`${n}-gloed`) : Promise.resolve()]),
  );
  maat();
  window.addEventListener('resize', maat);
  tekenEiland(DIMENSIES[dimIx]);
  zetHud();
  aftellen();
  setInterval(aftellen, 1000);
  if (OG) {
    // stilstaand beeld: muizen eerst een tijdje laten lopen zodat ze over het eiland verspreid zijn
    for (let i = 0; i < 200; i++) for (const m of muizen) stapMuis(m, 0.05);
    t = 3.2;
    lus(performance.now());
    document.body.dataset.klaar = '1';
    return;
  }
  requestAnimationFrame((nu) => {
    vorige = nu;
    lus(nu);
  });
}
void start();
