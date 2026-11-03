// Bouwen in de wereld (muizen): de bouwbalk rechtsboven, de muis in bouwmodus, en alles van de industrie tekenen:
// boren (die de machine naar hun plek gooit), banden met lading, hopen in de opslag en kabels naar de ring.
// Regels staan in industrie.ts; dit bestand tekent alleen en vertaalt klikken.
import { Graphics } from 'pixi.js';
import { naarTegel } from '../kern/besturing';
import { naarScherm } from '../kern/iso';
import { binnenRing } from '../kern/kaart';
import type { SpelStaat } from '../kern/spel';
import type { Richting } from '../kern/types';
import { PIXEL, type Stuk, type WereldBeeld } from '../kern/wereldbeeld';
import { energie } from './energie';
import {
  bouwBoor, bouwStapel, erf, getallen, GRONDSTOFFEN, industrie, kanBandOp, kanBoor, kanStapel, legBand,
  RICHTINGEN, sloop, stapelBlok, tegel, type Oordeel,
} from './industrie';
import { kanBetalen, kostTekst } from './kosten';
import { FONT, KL } from './paneel';

declare global {
  interface Window {
    MUIZEN: {
      industrie: () => ReturnType<typeof industrie>;
      zoekBoorplek: (goed: string) => [number, number] | null;
      boor: (x: number, y: number) => boolean;
      band: (a: [number, number], b: [number, number]) => number;
      stapel: (x: number, y: number) => boolean;
      sloop: (x: number, y: number) => boolean;
      scherm: (kol: number, rij: number) => { x: number; y: number };
    };
  }
}

type Modus = 'boor' | 'band' | 'stapel' | 'sloop' | null;
const MODI: { id: Exclude<Modus, null>; naam: string; toets: string }[] = [
  { id: 'boor', naam: 'BOOR', toets: 'B' },
  { id: 'band', naam: 'BAND', toets: 'L' },
  { id: 'stapel', naam: 'STAPEL', toets: 'O' },
  { id: 'sloop', naam: 'SLOOP', toets: 'X' },
];
const BW = 236, BH = 46;

export function maakBouwen(staat: () => SpelStaat, beeld: WereldBeeld): { werk(sec: number): void } {
  const canvas = document.body.querySelector('canvas') as HTMLCanvasElement; // het spel zelf (eerste canvas)
  let modus: Modus = null;
  let draai: Richting = 'O'; // richting van een losse bandtegel (R draait)
  let muis: { kol: number; rij: number } | null = null;
  let sleep: { kol: number; rij: number } | null = null;
  let melding: Oordeel | null = null;
  let t = 0;

  // ---- lagen in de wereld ----
  const kabels = new Graphics();
  const kabelGloed = new Graphics();
  kabelGloed.blendMode = 'add';
  const geest = new Graphics(); // bouwvoorbeeld
  const stof = new Graphics();
  beeld.vloer.addChild(kabels);
  beeld.scherp.addChild(kabelGloed);
  beeld.wereld.addChildAt(stof, beeld.wereld.getChildIndex(beeld.dingen) + 1);
  beeld.wereld.addChildAt(geest, beeld.wereld.getChildIndex(beeld.dingen) + 1);
  const deeltjes: { x: number; y: number; vx: number; vy: number; leeft: number; kleur: number; maat: number }[] = [];

  const boren = new Map<number, { st: Stuk; vloog: boolean; buffer: Stuk[] }>();
  const banden = new Map<number, { st: Stuk; last: Stuk | null }>();
  const stapels = new Map<string, Stuk>();
  const hopen: Stuk[] = [];
  let geestStuk: Stuk | null = null;

  const plof = (x: number, y: number) => {
    const p = naarScherm(x, y);
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 220;
      deeltjes.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - 60, leeft: 0.6 + Math.random() * 0.9, kleur: [0x6a6258, 0x4a443d, 0x857b6e][i % 3], maat: PIXEL * (1 + Math.floor(Math.random() * 3)) });
    }
    beeld.schudden(9);
  };

  // ---- de bouwbalk (pixelart, rechtsboven) ----
  const bv = Object.assign(document.createElement('canvas'), { width: BW, height: BH });
  bv.id = 'bouwbalk';
  bv.setAttribute('aria-label', 'Bouwbalk van de muizen: boor, band, stapelplaats en slopen');
  Object.assign(bv.style, { position: 'fixed', right: '0', top: '0', zIndex: '5', imageRendering: 'pixelated', cursor: 'pointer' });
  document.body.appendChild(bv);
  const bc = bv.getContext('2d')!;
  let bs = 2;
  const maat = () => {
    bs = Math.max(1, Math.min(3, Math.floor((innerWidth * 0.36) / BW * 2) / 2));
    bv.style.width = `${BW * bs}px`;
    bv.style.height = `${BH * bs}px`;
  };
  maat();
  window.addEventListener('resize', maat);
  const R = (x: number, y: number, w: number, h: number, k: string) => {
    bc.fillStyle = k;
    bc.fillRect(x, y, w, h);
  };
  const txt = (s: string, x: number, y: number, k: string) => {
    for (const ch of s.toUpperCase()) {
      const f = FONT[ch] ?? FONT['?'];
      for (let i = 0; i < 15; i++) if (f[i] === '1') R(x + (i % 3), y + Math.floor(i / 3), 1, 1, k);
      x += 4;
    }
    return x;
  };
  const kostVan = (m: Exclude<Modus, null>) => {
    const G = getallen();
    return m === 'boor' ? G.boor.kosten : m === 'band' ? G.band.kosten : m === 'stapel' ? G.stapel.kosten : {};
  };
  function tekenBalk(s: SpelStaat): void {
    R(0, 0, BW, BH, '#0b0c0c');
    R(0, BH - 1, BW, 1, '#353837');
    R(0, 0, 1, BH, '#353837');
    for (let i = 0; i < BW; i++) R(i, BH - 3, 1, 1, Math.floor(i / 3) % 2 ? '#0a0a0a' : '#5a4a12');
    MODI.forEach((m, i) => {
      const x = 4 + i * 58, y = 4, aan = modus === m.id;
      const kost = kostVan(m.id);
      const kan = kanBetalen(s.voorraad, kost);
      R(x, y, 54, 22, aan ? '#1d2a14' : '#141615');
      R(x, y, 54, 1, aan ? KL.groen : '#060606');
      R(x, y + 21, 54, 1, aan ? KL.groen : '#353837');
      txt(m.toets, x + 3, y + 3, KL.stencil);
      txt(m.naam, x + 11, y + 3, aan ? KL.groen : kan ? '#d8d4c4' : KL.dim);
      txt(m.id === 'sloop' ? 'ALLES TERUG' : `${kostTekst(kost)}${m.id === 'band' ? '/T' : ''}`, x + 3, y + 13, kan ? KL.amber : KL.rood);
    });
    const regel = melding ? melding.reden : modus ? hulpVan(modus) : 'BOUW: KIES EEN KNOP OF TOETS B L O X';
    txt(regel.slice(0, 57), 4, 31, melding ? (melding.ok ? KL.groen : KL.rood) : KL.cyaan);
  }
  const hulpVan = (m: Exclude<Modus, null>) =>
    m === 'boor' ? 'KLIK NAAST EEN VELD BUITEN DE RING. RECHTS = STOP'
      : m === 'band' ? 'SLEEP VAN BOOR NAAR OPSLAG. R = DRAAI. RECHTS = STOP'
        : m === 'stapel' ? 'BINNEN DE RING: +' + getallen().stapel.extra + ' OPSLAG PER GRONDSTOF'
          : 'KLIK OF SLEEP OVER WAT WEG MOET. RECHTS = STOP';
  const kies = (m: Modus) => {
    modus = modus === m ? null : m;
    melding = null;
    sleep = null;
  };
  bv.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const r = bv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * BW, y = ((e.clientY - r.top) / r.height) * BH;
    const i = Math.floor((x - 4) / 58);
    if (y < 28 && i >= 0 && i < MODI.length && x - 4 - i * 58 < 54) kies(MODI[i].id);
  });
  bv.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- invoer in de wereld ----
  const opTegel = (e: PointerEvent | MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    const p = beeld.wereld.toLocal({ x: e.clientX - r.left, y: e.clientY - r.top });
    return naarTegel(p.x, p.y);
  };
  // Pad van een gesleepte band: eerst langs de langste as, dan de bocht.
  function pad(a: { kol: number; rij: number }, b: { kol: number; rij: number }): { x: number; y: number; naar: Richting }[] {
    const pts: { x: number; y: number }[] = [];
    const dx = Math.sign(b.kol - a.kol), dy = Math.sign(b.rij - a.rij);
    let x = a.kol, y = a.rij;
    pts.push({ x, y });
    const eerstX = Math.abs(b.kol - a.kol) >= Math.abs(b.rij - a.rij);
    const loopX = () => { while (x !== b.kol) { x += dx; pts.push({ x, y }); } };
    const loopY = () => { while (y !== b.rij) { y += dy; pts.push({ x, y }); } };
    if (eerstX) { loopX(); loopY(); } else { loopY(); loopX(); }
    const richting = (p: { x: number; y: number }, q: { x: number; y: number }): Richting =>
      q.x > p.x ? 'O' : q.x < p.x ? 'W' : q.y > p.y ? 'Z' : 'N';
    return pts.map((p, i) => ({
      ...p,
      naar: i < pts.length - 1 ? richting(p, pts[i + 1]) : i > 0 ? richting(pts[i - 1], p) : draai,
    }));
  }
  function doe(s: SpelStaat, kol: number, rij: number, eind?: { kol: number; rij: number }): void {
    if (modus === 'boor') {
      if (bouwBoor(s, kol, rij)) modus = null;
    } else if (modus === 'stapel') {
      if (bouwStapel(s, kol, rij)) modus = null;
    } else if (modus === 'band') {
      legBand(s, pad({ kol, rij }, eind ?? { kol, rij }));
    } else if (modus === 'sloop') {
      for (const p of pad({ kol, rij }, eind ?? { kol, rij })) sloop(s, p.x, p.y);
    }
  }
  window.addEventListener('pointerdown', (e) => {
    if (!modus || e.target !== canvas || e.defaultPrevented) return;
    if (e.button === 1) return; // middelste knop: gewoon kijken
    e.stopPropagation();
    e.preventDefault();
    if (e.button === 2) return kies(null);
    const tg = opTegel(e);
    if (modus === 'band' || modus === 'sloop') sleep = tg;
    else doe(staat(), tg.kol, tg.rij);
  }, { capture: true });
  window.addEventListener('pointermove', (e) => {
    if (e.target !== canvas && !sleep) {
      muis = null;
      return;
    }
    muis = opTegel(e);
  });
  window.addEventListener('pointerup', (e) => {
    if (!sleep || e.button !== 0) return;
    const a = sleep;
    sleep = null;
    doe(staat(), a.kol, a.rij, opTegel(e));
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const t = e.key.toUpperCase();
    const m = MODI.find((x) => x.toets === t);
    if (m) kies(m.id);
    if (t === 'ESCAPE') kies(null);
    if (t === 'R' && modus === 'band') draai = ({ O: 'Z', Z: 'W', W: 'N', N: 'O' } as const)[draai];
  });

  // Testhaak voor de rooktest en de console: window.MUIZEN.boor(x, y), .band([x, y], [x, y]), .stapel(x, y), .sloop(x, y)
  window.MUIZEN = {
    industrie: () => industrie(staat()),
    zoekBoorplek: (goed) => {
      const s = staat();
      for (const a of s.kaart.afzettingen.filter((a) => a.goed === goed && a.rest > 0))
        for (const [dx, dy] of [[-2, 0], [1, 0], [0, -2], [0, 1], [-2, -2], [1, 1]])
          if (kanBoor(s, a.x + dx, a.y + dy).ok) return [a.x + dx, a.y + dy];
      return null;
    },
    boor: (x, y) => bouwBoor(staat(), x, y),
    band: (a, b) => legBand(staat(), pad({ kol: a[0], rij: a[1] }, { kol: b[0], rij: b[1] })),
    stapel: (x, y) => bouwStapel(staat(), x, y),
    sloop: (x, y) => sloop(staat(), x, y),
    scherm: (kol, rij) => {
      const p = beeld.wereld.toGlobal(naarScherm(kol, rij));
      return { x: p.x, y: p.y };
    },
  };

  // ---- tekenen ----
  const zetStuk = (st: Stuk, x: number, y: number, tegels: number, spiegel: 1 | -1, z?: number) => {
    beeld.zetGebouw(st, x, y, tegels, spiegel);
    if (z !== undefined) st.delen[0].zIndex = z;
  };
  const zetDing = (st: Stuk, x: number, y: number, z: number) => {
    beeld.zetEenheid(st, x, y, 1, 0);
    st.delen[0].zIndex = z;
  };
  const toon = (st: Stuk, aan: boolean) => st.delen.forEach((d) => (d.visible = aan));

  function machineTop(s: SpelStaat) {
    const m = s.kaart.machine;
    const p = naarScherm(m.x + m.breed / 2 - 0.5, m.y + m.diep / 2 - 0.5);
    return { x: p.x, y: p.y - 300 };
  }

  function tekenWereld(s: SpelStaat, sec: number): void {
    const ind = industrie(s);
    const G = getallen();

    // stapelplaatsen
    const nuStapels = new Set(ind.stapels.map((p) => `${p.x},${p.y}`));
    for (const [k, st] of stapels) if (!nuStapels.has(k)) { beeld.weg(st); stapels.delete(k); }
    for (const p of ind.stapels) {
      const k = `${p.x},${p.y}`;
      if (!stapels.has(k)) {
        const st = beeld.maak('stapel');
        zetStuk(st, p.x, p.y, 2, 1, (p.x + p.y) * 10 - 5);
        stapels.set(k, st);
      }
    }

    // boren: vliegen, landen, trillen
    const ids = new Set(ind.boren.map((b) => b.id));
    for (const [id, b] of boren) if (!ids.has(id)) { beeld.weg(b.st); b.buffer.forEach((x) => beeld.weg(x)); boren.delete(id); }
    for (const b of ind.boren) {
      let r = boren.get(b.id);
      if (!r) {
        r = { st: beeld.maak('boor'), vloog: b.vlieg > 0, buffer: [] };
        boren.set(b.id, r);
      }
      zetStuk(r.st, b.x, b.y, 2, 1);
      if (b.vlieg > 0) {
        // in een boog vanaf de machine naar zijn plek, en hij valt het laatste stuk
        const f = 1 - b.vlieg / G.boor.vliegSec;
        const doel = naarScherm(b.x + 0.5, b.y + 0.5), van = machineTop(s);
        const x = van.x + (doel.x - van.x) * f, y = van.y + (doel.y - van.y) * f - Math.sin(f * Math.PI) * 240;
        for (const d of r.st.delen) {
          d.x += x - doel.x;
          d.y += y - doel.y;
        }
        r.st.delen[0].zIndex = 99999;
        if (Math.random() < 0.6) deeltjes.push({ x, y: y - 40, vx: (Math.random() - 0.5) * 30, vy: 20, leeft: 0.5, kleur: 0x2a2724, maat: PIXEL * 2 });
      } else {
        if (r.vloog) plof(b.x + 0.5, b.y + 0.5);
        if (b.graaft && Math.sin(t * 40 + b.id) > 0) for (const d of r.st.delen) d.y -= PIXEL;
        if (b.graaft && Math.random() < sec * 6) {
          const p = naarScherm(b.x + 0.5 + (Math.random() - 0.5), b.y + 0.5 + (Math.random() - 0.5));
          deeltjes.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60, leeft: 0.5, kleur: 0x4a443d, maat: PIXEL });
        }
      }
      r.vloog = b.vlieg > 0;
      // wat hij gegraven heeft en nog niet kwijt kan: brokken voor zijn voet
      while (r.buffer.length < b.buffer.length) r.buffer.push(beeld.maak(`last-${b.buffer[r.buffer.length]}`, true));
      while (r.buffer.length > b.buffer.length) beeld.weg(r.buffer.pop()!);
      r.buffer.forEach((st, i) => {
        const naam = `last-${b.buffer[i]}`;
        if (st.naam !== naam) beeld.wissel(st, naam);
        zetDing(st, b.x + 1.75 - (i % 3) * 0.3, b.y + 1.85 - Math.floor(i / 3) * 0.25, (b.x + b.y + 3) * 10 + 5);
      });
    }

    // banden en wat erop ligt
    for (const [k, r] of banden) if (!ind.banden.has(k)) { beeld.weg(r.st); if (r.last) beeld.weg(r.last); banden.delete(k); }
    for (const [k, b] of ind.banden) {
      let r = banden.get(k);
      if (!r) {
        r = { st: beeld.maak('band-leeg'), last: null };
        banden.set(k, r);
      }
      const kol = b.naar === 'O' || b.naar === 'W';
      zetStuk(r.st, b.x, b.y, 1, kol ? 1 : -1, (b.x + b.y) * 10 - 5);
      if (b.goed) {
        const naam = `last-${b.goed}`;
        if (!r.last) r.last = beeld.maak(naam, true);
        else if (r.last.naam !== naam) beeld.wissel(r.last, naam);
        toon(r.last, true);
        const [dx, dy] = RICHTINGEN[b.naar];
        const f = Math.min(1, b.voortgang) - 0.5;
        zetDing(r.last, b.x + dx * f, b.y + dy * f, (b.x + b.y) * 10 + 2);
        for (const d of r.last.delen) d.y -= 4 * PIXEL;
      } else if (r.last) toon(r.last, false);
    }

    // de opslag in beeld: op het erf en op elke stapelplaats een berg per grondstof, die laag voor laag groeit
    // (4 onderop, dan 3, 2 en 1). Elke hoop is G.hoop grondstof.
    const vakken = [{ blok: erf(s), max: G.opslagMax }, ...ind.stapels.map((p) => ({ blok: stapelBlok(p), max: G.stapel.extra }))];
    const LAGEN: [number, number, number][] = [
      [-0.22, -0.22, 0], [0.22, -0.22, 0], [-0.22, 0.22, 0], [0.22, 0.22, 0],
      [0, -0.2, 1], [-0.2, 0.1, 1], [0.15, 0.15, 1], [-0.05, -0.05, 2], [0.12, 0.08, 2], [0.03, 0.03, 3],
    ];
    let n = 0;
    for (const [gi, g] of GRONDSTOFFEN.entries()) {
      let rest = Math.ceil((s.voorraad[g] ?? 0) / G.hoop - 0.01);
      for (const v of vakken) {
        const hier = Math.min(rest, Math.floor(v.max / G.hoop), LAGEN.length);
        rest -= hier;
        // drie bergen schuin over het 2x2-vak: schroot achter, hout midden, kristal voor
        const bx = v.blok.x + [0.05, 0.5, 0.95][gi], by = v.blok.y + [0.95, 0.5, 0.05][gi];
        for (let j = 0; j < hier; j++) {
          const [dx, dy, laag] = LAGEN[j];
          let st = hopen[n];
          if (!st) st = hopen[n] = beeld.maak(`hoop-${g}`, true);
          else if (st.naam !== `hoop-${g}`) beeld.wissel(st, `hoop-${g}`);
          toon(st, true);
          zetDing(st, bx + dx, by + dy, Math.floor(bx + by) * 10 + 4 + laag);
          for (const d of st.delen) d.y -= laag * 5 * PIXEL;
          n++;
        }
      }
    }
    for (let i = n; i < hopen.length; i++) toon(hopen[i], false);

    // kabels: van elke boor buiten de ring naar de rand van de ring (de stroom komt van de machine)
    kabels.clear();
    kabelGloed.clear();
    const ring = s.kaart.ring;
    const krijgt = energie(s).verbruikers.find((c) => c.id === 'industrie')?.krijgt ?? 0;
    for (const b of ind.boren) {
      if (b.vlieg > 0) continue;
      const bx = b.x + 0.5, by = b.y + 0.5;
      if (binnenRing(s.kaart, bx, by)) continue;
      const hoek = Math.atan2(by - ring.y, bx - ring.x);
      const a = naarScherm(ring.x + Math.cos(hoek) * (ring.r - 0.5), ring.y + Math.sin(hoek) * (ring.r - 0.5));
      const z = naarScherm(bx, by);
      for (const [dx, kleur] of [[0, 0x07070a], [3, 0x3a1312], [-3, 0x3f3510]] as [number, number][]) {
        const pts: number[] = [];
        for (let i = 0; i <= 16; i++) {
          const f = i / 16;
          pts.push(Math.round((a.x + (z.x - a.x) * f + dx) / PIXEL) * PIXEL, Math.round((a.y + (z.y - a.y) * f + Math.sin(f * Math.PI * 3 + b.id) * 4) / PIXEL) * PIXEL);
        }
        kabels.poly(pts, false).stroke({ width: PIXEL, color: kleur });
      }
      if (krijgt > 0) {
        // stroompulsjes die over de kabel naar de boor lopen
        for (let i = 0; i < 3; i++) {
          const f = (t * 0.6 * krijgt + i / 3 + b.id * 0.13) % 1;
          const x = a.x + (z.x - a.x) * f, y = a.y + (z.y - a.y) * f + Math.sin(f * Math.PI * 3 + b.id) * 4;
          kabelGloed.rect(Math.round(x / PIXEL) * PIXEL, Math.round(y / PIXEL) * PIXEL, PIXEL, PIXEL).fill(0x9dff2e);
        }
      }
    }

    // stof
    stof.clear();
    for (const d of deeltjes) {
      d.leeft -= sec;
      d.vy += 260 * sec;
      d.vx *= 1 - sec * 2;
      d.x += d.vx * sec;
      d.y += d.vy * sec;
    }
    for (let i = deeltjes.length - 1; i >= 0; i--) if (deeltjes[i].leeft <= 0) deeltjes.splice(i, 1);
    for (const d of deeltjes) stof.rect(Math.round(d.x / PIXEL) * PIXEL, Math.round(d.y / PIXEL) * PIXEL, d.maat, d.maat).fill({ color: d.kleur, alpha: Math.min(1, d.leeft * 2) });
  }

  const ruitPad = (x: number, y: number, w = 1, h = 1) => {
    const a = naarScherm(x - 0.5, y - 0.5), b = naarScherm(x + w - 0.5, y - 0.5), c = naarScherm(x + w - 0.5, y + h - 0.5), d = naarScherm(x - 0.5, y + h - 0.5);
    return [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y];
  };
  function pijl(x: number, y: number, naar: Richting, kleur: number): void {
    const [dx, dy] = RICHTINGEN[naar];
    const p = naarScherm(x + dx * 0.25, y + dy * 0.25), q = naarScherm(x - dx * 0.2 + dy * 0.2, y - dy * 0.2 + dx * 0.2), r = naarScherm(x - dx * 0.2 - dy * 0.2, y - dy * 0.2 - dx * 0.2);
    geest.poly([p.x, p.y - 4, q.x, q.y - 4, r.x, r.y - 4]).fill({ color: kleur, alpha: 0.9 });
  }

  function tekenGeest(s: SpelStaat): void {
    geest.clear();
    melding = null;
    if (geestStuk) toon(geestStuk, false);
    if (!modus) return;
    const ind = industrie(s);
    // richtingen van de banden laten zien
    if (modus === 'band' || modus === 'sloop') for (const b of ind.banden.values()) pijl(b.x, b.y, b.naar, 0xffd23f);
    if (modus === 'boor') {
      // waar staan velden: een zachte rand om de grondstoffen
      for (const b of ind.boren) geest.poly(ruitPad(b.x - getallen().boor.bereik, b.y - getallen().boor.bereik, 4, 4)).stroke({ width: PIXEL, color: 0x9dff2e, alpha: 0.2 });
    }
    if (!muis) return;
    const { kol, rij } = muis;
    if (modus === 'boor' || modus === 'stapel') {
      const o = modus === 'boor' ? kanBoor(s, kol, rij) : kanStapel(s, kol, rij);
      melding = o;
      const kleur = o.ok ? 0x9dff2e : 0xff2a3a;
      const naam = modus === 'boor' ? 'boor' : 'stapel';
      if (!geestStuk || geestStuk.naam !== naam) {
        if (geestStuk) beeld.weg(geestStuk);
        geestStuk = beeld.maak(naam);
      }
      toon(geestStuk, true);
      zetStuk(geestStuk, kol, rij, 2, 1, 99998);
      geestStuk.delen.forEach((d) => (d.alpha = 0.55));
      geestStuk.delen[0].tint = kleur;
      geest.poly(ruitPad(kol, rij, 2, 2)).fill({ color: kleur, alpha: 0.18 }).stroke({ width: PIXEL, color: kleur, alpha: 0.8 });
      if (modus === 'boor') {
        const r = getallen().boor.bereik;
        geest.poly(ruitPad(kol - r, rij - r, 2 + 2 * r, 2 + 2 * r)).stroke({ width: PIXEL, color: kleur, alpha: 0.45 });
      }
      return;
    }
    const p = pad(sleep ?? muis, muis);
    const nieuw = p.filter((q) => kanBandOp(s, q.x, q.y) && !ind.banden.has(tegel(q.x, q.y))).length;
    for (const q of p) {
      const kan = modus === 'sloop' || kanBandOp(s, q.x, q.y);
      const kleur = modus === 'sloop' ? 0xff9a1f : kan ? 0x9dff2e : 0xff2a3a;
      geest.poly(ruitPad(q.x, q.y)).fill({ color: kleur, alpha: 0.2 }).stroke({ width: PIXEL, color: kleur, alpha: 0.7 });
      if (modus === 'band' && kan) pijl(q.x, q.y, q.naar, kleur);
    }
    if (modus === 'band') {
      const kost = getallen().band.kosten;
      const ok = kanBetalen(s.voorraad, kost, nieuw);
      melding = { ok, reden: `${nieuw} NIEUWE TEGELS: ${kostTekst(Object.fromEntries(Object.entries(kost).map(([g, n]) => [g, (n ?? 0) * nieuw])))}${ok ? '' : ' TE WEINIG'}` };
    } else melding = { ok: true, reden: `${p.length} TEGELS SLOPEN` };
  }

  return {
    werk(sec) {
      t += sec;
      const s = staat();
      tekenWereld(s, sec);
      tekenGeest(s);
      canvas.style.cursor = modus ? 'crosshair' : '';
      tekenBalk(s);
    },
  };
}

