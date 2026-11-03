// Bouwen in de wereld (muizen): de bouwbalk rechtsboven (neerzetten en laten maken in de fabricator), de muis in
// bouwmodus, en alles van de industrie tekenen: houtbrander, fabricator, boren (die de machine naar hun plek gooit),
// banden met lading, palen met kabels, bouwplekken en hopen op de stapels.
// Regels staan in industrie.ts en werk.ts; dit bestand tekent alleen en vertaalt klikken.
import { Graphics } from 'pixi.js';
import { naarTegel } from '../kern/besturing';
import { naarScherm } from '../kern/iso';
import type { Blok } from '../kern/kaart';
import type { SpelStaat } from '../kern/spel';
import type { Grondstof, Richting } from '../kern/types';
import { PIXEL, type Stuk, type WereldBeeld } from '../kern/wereldbeeld';
import { energie, verbruiker } from './energie';
import {
  aangesloten, blok2, getallen, gevoed, GRONDSTOFFEN, industrie, kanBandOp, kanZetten, legBand, maak, midden,
  opslagMax, RICHTINGEN, schrap, sloop, tegel, vast, zet, type Onderdeel, type Oordeel,
} from './industrie';
import { kanBetalen, kostTekst } from './kosten';
import { FONT, KL } from './paneel';

declare global {
  interface Window {
    MUIZEN: {
      industrie: () => ReturnType<typeof industrie>;
      zoekBoorplek: (goed: string) => [number, number] | null;
      zet: (d: Onderdeel, x: number, y: number, goed?: Grondstof) => boolean;
      band: (a: [number, number], b: [number, number]) => number;
      maak: (d: Onderdeel) => void;
      sloop: (x: number, y: number) => boolean;
      scherm: (kol: number, rij: number) => { x: number; y: number };
    };
  }
}

type Modus = Onderdeel | 'sloop' | null;
const KNOPPEN: { id: Exclude<Modus, null>; naam: string; toets: string }[] = [
  { id: 'boor', naam: 'BOOR', toets: 'B' },
  { id: 'band', naam: 'BAND', toets: 'L' },
  { id: 'paal', naam: 'PAAL', toets: 'P' },
  { id: 'stapel', naam: 'STAPEL', toets: 'O' },
  { id: 'sloop', naam: 'SLOOP', toets: 'X' },
];
const BW = 298, BH = 58, KB = 54; // bouwbalk en knopbreedte
const MAAKTEKST: Record<Onderdeel, string> = { boor: 'BOOR', band: '4 BAND', paal: 'PAAL', stapel: 'STAPEL' };

export function maakBouwen(staat: () => SpelStaat, beeld: WereldBeeld): { werk(sec: number): void } {
  const canvas = document.body.querySelector('canvas') as HTMLCanvasElement; // het spel zelf (eerste canvas)
  let modus: Modus = null;
  let draai: Richting = 'O'; // richting van een losse bandtegel (R draait)
  let stapelGoed: Grondstof = 'schroot'; // voor welke grondstof een nieuwe stapel is (R wisselt)
  let muis: { kol: number; rij: number } | null = null;
  let sleep: { kol: number; rij: number } | null = null;
  let melding: Oordeel | null = null;
  let balkHulp = '';
  let t = 0;

  // ---- lagen in de wereld ----
  const kabels = new Graphics();
  const kabelGloed = new Graphics();
  kabelGloed.blendMode = 'add';
  const geest = new Graphics(); // bouwvoorbeeld
  const balken = new Graphics(); // voortgang van bouwplekken
  const stof = new Graphics();
  beeld.wereld.addChildAt(kabels, beeld.wereld.getChildIndex(beeld.dingen) + 1);
  beeld.scherp.addChild(kabelGloed);
  for (const g of [stof, geest, balken]) beeld.wereld.addChildAt(g, beeld.wereld.getChildIndex(beeld.dingen) + 1);
  const deeltjes: { x: number; y: number; vx: number; vy: number; leeft: number; kleur: number; maat: number }[] = [];

  const boren = new Map<number, { st: Stuk; vloog: boolean; buffer: Stuk[] }>();
  const banden = new Map<number, { st: Stuk; last: Stuk | null }>();
  const vaste = new Map<string, Stuk>(); // stapels, palen, bronnen, fabricator
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
  bv.setAttribute('aria-label', 'Bouwbalk van de muizen: onderdelen neerzetten en laten maken in de fabricator');
  Object.assign(bv.style, { position: 'fixed', right: '0', top: '0', zIndex: '5', imageRendering: 'pixelated', cursor: 'pointer' });
  document.body.appendChild(bv);
  const bc = bv.getContext('2d')!;
  let bs = 2;
  const maat = () => {
    bs = Math.max(1, Math.min(3, Math.floor(((innerWidth * 0.42) / BW) * 2) / 2));
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
  const hulpVan = (m: Exclude<Modus, null>) =>
    m === 'boor' ? 'KLIK NAAST EEN VELD. DE MACHINE GOOIT HEM ERHEEN'
      : m === 'band' ? 'SLEEP VAN BOOR NAAR STAPEL. R = DRAAI'
        : m === 'paal' ? `PALEN HOOGUIT ${getallen().paal.link} UIT ELKAAR, STROOM TOT ${getallen().paal.bereik} TEGELS`
          : m === 'stapel' ? `STAPEL VOOR ${stapelGoed.toUpperCase()}. R = ANDERE GRONDSTOF`
            : 'KLIK OF SLEEP OVER WAT WEG MOET. JE KRIJGT HET TERUG';
  function tekenBalk(s: SpelStaat): void {
    const i = industrie(s);
    const f = i.fabricator;
    R(0, 0, BW, BH, '#0b0c0c');
    R(0, BH - 1, BW, 1, '#353837');
    R(0, 0, 1, BH, '#353837');
    for (let x = 0; x < BW; x++) R(x, BH - 3, 1, 1, Math.floor(x / 3) % 2 ? '#0a0a0a' : '#5a4a12');
    KNOPPEN.forEach((k, n) => {
      const x = 4 + n * (KB + 4), y = 4, aan = modus === k.id;
      R(x, y, KB, 30, aan ? '#1d2a14' : '#141615');
      R(x, y, KB, 1, aan ? KL.groen : '#060606');
      R(x, y + 29, KB, 1, aan ? KL.groen : '#353837');
      txt(k.toets, x + 3, y + 3, KL.stencil);
      txt(k.naam, x + 11, y + 3, aan ? KL.groen : '#d8d4c4');
      if (k.id === 'sloop') {
        txt('TERUG', x + 3, y + 12, KL.dim);
        return;
      }
      const n2 = i.delen[k.id];
      txt(`${n2} KLAAR`, x + 3, y + 11, n2 ? KL.groen : KL.dim);
      // onderste helft: laten maken
      const r = getallen().maak[k.id];
      const kan = kanBetalen(s.voorraad, r.kosten);
      R(x + 1, y + 18, KB - 2, 10, '#0a0b0b');
      txt('+', x + 3, y + 20, kan ? KL.geel : KL.dim);
      txt(kostTekst(r.kosten), x + 9, y + 20, kan ? KL.amber : KL.rood);
    });
    // fabricator
    const d = f.rij[0];
    const fy = 38;
    txt('FAB', 4, fy, KL.stencil);
    if (!d) txt('LEEG. KLIK + BIJ EEN ONDERDEEL', 20, fy, KL.dim);
    else {
      const eind = txt(MAAKTEKST[d], 20, fy, KL.cyaan);
      R(eind + 2, fy, 40, 5, '#050505');
      R(eind + 2, fy, Math.round(40 * f.klok), 5, KL.cyaan);
      const na = f.rij.slice(1).map((x) => x[0].toUpperCase()).join('');
      txt(f.geblokt || `${f.ploeg} MUIZEN${na ? ` RIJ ${na}` : ''}`, eind + 46, fy, f.geblokt ? KL.rood : KL.label);
    }
    const regel = melding ? melding.reden : balkHulp || (modus ? hulpVan(modus) : 'B L P O X: NEERZETTEN. SHIFT+TOETS: LATEN MAKEN');
    txt(regel.slice(0, 73), 4, 47, melding ? (melding.ok ? KL.groen : KL.rood) : KL.cyaan);
  }
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
    const n = Math.floor((x - 4) / (KB + 4));
    if (y < 4 || y > 34 || n < 0 || n >= KNOPPEN.length || x - 4 - n * (KB + 4) > KB) {
      if (y >= 36 && y < 44 && e.button === 2) schrap(staat());
      return;
    }
    const k = KNOPPEN[n];
    if (y >= 22 && k.id !== 'sloop') maak(staat(), k.id);
    else kies(k.id);
  });
  bv.addEventListener('pointermove', (e) => {
    const r = bv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * BW, y = ((e.clientY - r.top) / r.height) * BH;
    const n = Math.floor((x - 4) / (KB + 4));
    const k = KNOPPEN[n];
    balkHulp = !k || y > 34 ? (y > 34 && y < 44 ? 'FABRICATOR: MUIZEN EN STROOM NODIG. RECHTS = LAATSTE SCHRAPPEN' : '')
      : k.id === 'sloop' ? 'SLOPEN (X)' : y >= 22 ? `LAAT ${MAAKTEKST[k.id]} MAKEN (SHIFT+${k.toets}): ${kostTekst(getallen().maak[k.id].kosten)}` : `${k.naam} NEERZETTEN (${k.toets})`;
  });
  bv.addEventListener('pointerleave', () => (balkHulp = ''));
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
    return pts.map((p, i) => ({ ...p, naar: i < pts.length - 1 ? richting(p, pts[i + 1]) : i > 0 ? richting(pts[i - 1], p) : draai }));
  }
  function doe(s: SpelStaat, kol: number, rij: number, eind?: { kol: number; rij: number }): void {
    if (modus === 'band') legBand(s, pad({ kol, rij }, eind ?? { kol, rij }));
    else if (modus === 'sloop') for (const p of pad({ kol, rij }, eind ?? { kol, rij })) sloop(s, p.x, p.y);
    else if (modus) {
      const m = modus;
      if (zet(s, m, kol, rij, stapelGoed) && !industrie(s).delen[m]) modus = null;
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
    const k = KNOPPEN.find((x) => x.toets === t);
    if (k) {
      if (e.shiftKey && k.id !== 'sloop') maak(staat(), k.id);
      else kies(k.id);
    }
    if (t === 'ESCAPE') kies(null);
    if (t === 'R' && modus === 'band') draai = ({ O: 'Z', Z: 'W', W: 'N', N: 'O' } as const)[draai];
    if (t === 'R' && modus === 'stapel') stapelGoed = GRONDSTOFFEN[(GRONDSTOFFEN.indexOf(stapelGoed) + 1) % 3];
  });

  // Testhaak voor de console en de rooktest
  window.MUIZEN = {
    industrie: () => industrie(staat()),
    zoekBoorplek: (goed) => {
      const s = staat();
      for (const a of s.kaart.afzettingen.filter((a) => a.goed === goed && a.rest > 0))
        for (const [dx, dy] of [[-2, 0], [1, 0], [0, -2], [0, 1], [-2, -2], [1, 1]])
          if (kanZetten(s, 'boor', a.x + dx, a.y + dy).ok) return [a.x + dx, a.y + dy];
      return null;
    },
    zet: (d, x, y, goed) => zet(staat(), d, x, y, goed),
    band: (a, b) => legBand(staat(), pad({ kol: a[0], rij: a[1] }, { kol: b[0], rij: b[1] })),
    maak: (d) => maak(staat(), d),
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
  const half = (st: Stuk, af: number) => st.delen.forEach((d, i) => (d.alpha = af > 0 ? (i ? 0 : 0.45 + 0.1 * Math.sin(t * 6)) : 1));
  function voortgang(b: Blok, af: number, werk: number): void {
    if (af <= 0) return;
    const c = midden(b);
    const p = naarScherm(c.x, c.y);
    const w = 40;
    balken.rect(p.x - w / 2, p.y - 30, w, PIXEL * 2).fill(0x050505);
    balken.rect(p.x - w / 2, p.y - 30, Math.round(w * (1 - af / werk)), PIXEL * 2).fill(0xffd23f);
  }

  function machineTop(s: SpelStaat) {
    const m = s.kaart.machine;
    const p = naarScherm(m.x + m.breed / 2 - 0.5, m.y + m.diep / 2 - 0.5);
    return { x: p.x, y: p.y - 300 };
  }
  const paalTop = (x: number, y: number) => {
    const p = naarScherm(x, y);
    return { x: p.x, y: p.y - 74 };
  };

  // vaste stukken (één sprite per sleutel), met aan/uit
  function vastStuk(sleutel: string, naam: string, b: Blok, tegels: number, aan: boolean, af = 0, z?: number): void {
    let st = vaste.get(sleutel);
    if (!aan) {
      if (st) {
        beeld.weg(st);
        vaste.delete(sleutel);
      }
      return;
    }
    if (!st) {
      st = beeld.maak(naam);
      vaste.set(sleutel, st);
    }
    zetStuk(st, b.x, b.y, tegels, 1, z);
    half(st, af);
  }

  function tekenWereld(s: SpelStaat, sec: number): void {
    const ind = industrie(s);
    const G = getallen();
    const V = vast(s);
    const e = energie(s);
    const krijgt = verbruiker(s, 'industrie').krijgt;
    balken.clear();
    const gezien = new Set<string>();
    const vastAan = (k: string, ...r: Parameters<typeof vastStuk> extends [string, ...infer T] ? T : never) => {
      gezien.add(k);
      vastStuk(k, ...r);
    };

    // bronnen en fabricator
    for (const b of e.bronnen) {
      const naam = b.id === 'houtbrander' ? 'houtbrander' : b.id === 'dynamo' ? 'dynamo' : '';
      if (naam) vastAan(`bron-${b.id}`, naam, V.bronnen[b.id], 2, b.mk > 0);
      if (b.levert > 0 && Math.random() < sec * (b.stand === 2 ? 14 : 4)) {
        // rook (en vonken als hij overladen is)
        const c = midden(V.bronnen[b.id]);
        const p = naarScherm(c.x - 0.3, c.y - 0.3);
        deeltjes.push({ x: p.x + (Math.random() - 0.5) * 6, y: p.y - (b.id === 'houtbrander' ? 150 : 110), vx: (Math.random() - 0.5) * 20, vy: -60 - Math.random() * 40, leeft: 1.2, kleur: b.stand === 2 ? 0xff6a1a : 0x3a3530, maat: PIXEL * 2 });
      }
    }
    vastAan('fab', 'pers', V.fabricator, 2, true);
    if (ind.fabricator.rij.length && !ind.fabricator.geblokt && Math.sin(t * 30) > 0) for (const d of vaste.get('fab')!.delen) d.y -= PIXEL;

    // stapels en palen
    for (const p of ind.stapels) {
      vastAan(`stapel-${p.id}`, 'stapel', blok2(p), 2, true, p.af, (p.x + p.y) * 10 - 5);
      voortgang(blok2(p), p.af, G.stapel.werk);
    }
    for (const p of ind.palen) {
      vastAan(`paal-${p.id}`, 'mast', { x: p.x, y: p.y, breed: 1, diep: 1 }, 1, true, p.af);
      voortgang({ x: p.x, y: p.y, breed: 1, diep: 1 }, p.af, G.paal.werk);
    }
    for (const [k, st] of vaste) if (!gezien.has(k)) { beeld.weg(st); vaste.delete(k); }

    // boren: vliegen, landen, opgebouwd worden, trillen
    const ids = new Set(ind.boren.map((b) => b.id));
    for (const [id, b] of boren) if (!ids.has(id)) { beeld.weg(b.st); b.buffer.forEach((x) => beeld.weg(x)); boren.delete(id); }
    for (const b of ind.boren) {
      let r = boren.get(b.id);
      if (!r) {
        r = { st: beeld.maak('boor'), vloog: b.vlieg > 0, buffer: [] };
        boren.set(b.id, r);
      }
      zetStuk(r.st, b.x, b.y, 2, 1);
      half(r.st, b.vlieg > 0 ? 0 : b.af);
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
        voortgang(blok2(b), b.af, G.boor.werk);
        if (b.graaft && Math.sin(t * 40 + b.id) > 0) for (const d of r.st.delen) d.y -= PIXEL;
        if (b.graaft && Math.random() < sec * 6) {
          const p = naarScherm(b.x + 0.5 + (Math.random() - 0.5), b.y + 0.5 + (Math.random() - 0.5));
          deeltjes.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60, leeft: 0.5, kleur: 0x4a443d, maat: PIXEL });
        }
      }
      r.vloog = b.vlieg > 0;
      // wat hij gegraven heeft en nog niet kwijt is: brokken voor zijn voet
      while (r.buffer.length < b.buffer.length) r.buffer.push(beeld.maak(`last-${b.buffer[r.buffer.length]}`, true));
      while (r.buffer.length > b.buffer.length) beeld.weg(r.buffer.pop()!);
      r.buffer.forEach((st, i) => {
        const naam = `last-${b.buffer[i]}`;
        if (st.naam !== naam) beeld.wissel(st, naam);
        zetDing(st, b.x + 1.8 - (i % 4) * 0.28, b.y + 1.9 - Math.floor(i / 4) * 0.22, (b.x + b.y + 3) * 10 + 5);
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
      half(r.st, b.af);
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

    // de opslag in beeld: een klein bergje per grondstof op het erf, de rest op de stapel van die grondstof.
    // Een berg groeit laag voor laag (4 onderop, dan 3, 2 en 1). Elke hoop is G.hoop grondstof.
    const LAGEN: [number, number, number][] = [
      [-0.22, -0.22, 0], [0.22, -0.22, 0], [-0.22, 0.22, 0], [0.22, 0.22, 0],
      [0, -0.2, 1], [-0.2, 0.1, 1], [0.15, 0.15, 1], [-0.05, -0.05, 2], [0.12, 0.08, 2], [0.03, 0.03, 3],
    ];
    let n = 0;
    const berg = (g: Grondstof, bx: number, by: number, aantal: number) => {
      for (let j = 0; j < aantal; j++) {
        const [dx, dy, laag] = LAGEN[j];
        let st = hopen[n];
        if (!st) st = hopen[n] = beeld.maak(`hoop-${g}`, true);
        else if (st.naam !== `hoop-${g}`) beeld.wissel(st, `hoop-${g}`);
        toon(st, true);
        zetDing(st, bx + dx, by + dy, Math.floor(bx + by) * 10 + 4 + laag);
        for (const d of st.delen) d.y -= laag * 5 * PIXEL;
        n++;
      }
    };
    for (const [gi, g] of GRONDSTOFFEN.entries()) {
      let rest = Math.ceil((s.voorraad[g] ?? 0) / G.hoop - 0.01);
      const opErf = Math.min(rest, Math.floor(G.opslagMax / G.hoop), 4);
      rest -= opErf;
      berg(g, V.erf.x + [0.05, 0.5, 0.95][gi], V.erf.y + [0.95, 0.5, 0.05][gi], opErf);
      for (const p of ind.stapels) {
        if (p.goed !== g || p.af) continue;
        const hier = Math.min(rest, Math.floor(G.stapel.extra / G.hoop), LAGEN.length);
        rest -= hier;
        berg(g, p.x + 0.5, p.y + 0.5, hier);
      }
    }
    for (let i = n; i < hopen.length; i++) toon(hopen[i], false);

    // kabels: machine -> palen -> palen, en van de dichtstbijzijnde paal naar wat stroom krijgt
    kabels.clear();
    kabelGloed.clear();
    const m = midden(s.kaart.machine);
    const hub = (() => { const p = naarScherm(m.x, m.y); return { x: p.x, y: p.y - 150 }; })();
    const net = aangesloten(s);
    const palen = ind.palen.filter((p) => !p.af);
    // boom: elke aangesloten paal hangt aan de dichtstbijzijnde die dichter bij de machine staat
    for (const p of palen) {
      const pt = paalTop(p.x, p.y);
      if (!net.has(p.id)) {
        if (Math.sin(t * 6) > 0) kabelGloed.rect(pt.x - PIXEL, pt.y - 16, PIXEL * 2, PIXEL * 2).fill(0xff2a3a);
        continue;
      }
      const dm = Math.hypot(p.x - m.x, p.y - m.y);
      let van = dm <= G.paal.link ? hub : null, best = dm <= G.paal.link ? dm : Infinity;
      for (const q of palen) {
        if (q === p || !net.has(q.id)) continue;
        const dq = Math.hypot(q.x - m.x, q.y - m.y), d = Math.hypot(q.x - p.x, q.y - p.y);
        if (dq < dm && d <= G.paal.link && d < best) [van, best] = [paalTop(q.x, q.y), d];
      }
      if (van) kabel(van, pt, p.id, krijgt > 0);
    }
    const voed = (b: Blok, id: number) => {
      const c = midden(b);
      const doel = (() => { const p = naarScherm(c.x, c.y); return { x: p.x, y: p.y - 40 }; })();
      if (Math.hypot(c.x - m.x, c.y - m.y) <= G.paal.bereik + 2) return kabel(hub, doel, id, krijgt > 0);
      let van = null as null | { x: number; y: number }, bd = Infinity;
      for (const p of palen) {
        const d = Math.hypot(p.x - c.x, p.y - c.y);
        if (net.has(p.id) && d <= G.paal.bereik && d < bd) [van, bd] = [paalTop(p.x, p.y), d];
      }
      if (van) kabel(van, doel, id, krijgt > 0);
    };
    for (const b of ind.boren) if (!b.vlieg) voed(blok2(b), b.id);
    voed(V.fabricator, 999);
    for (const b of e.bronnen) if (b.mk) {
      const c = midden(V.bronnen[b.id]);
      const p = naarScherm(c.x, c.y);
      kabel({ x: p.x, y: p.y - 60 }, hub, 900 + b.id.length, b.levert > 0);
    }

    // stof en rook
    for (const d of deeltjes) {
      d.leeft -= sec;
      d.vy += (d.vy < 0 && d.maat > PIXEL ? 10 : 260) * sec;
      d.vx *= 1 - sec * 2;
      d.x += d.vx * sec;
      d.y += d.vy * sec;
    }
    for (let i = deeltjes.length - 1; i >= 0; i--) if (deeltjes[i].leeft <= 0) deeltjes.splice(i, 1);
    stof.clear();
    for (const d of deeltjes) stof.rect(Math.round(d.x / PIXEL) * PIXEL, Math.round(d.y / PIXEL) * PIXEL, d.maat, d.maat).fill({ color: d.kleur, alpha: Math.min(1, d.leeft * 2) });
  }

  // Een doorhangende kabelbundel (zwart, rood, geel) met stroompulsjes als er stroom door gaat.
  function kabel(a: { x: number; y: number }, z: { x: number; y: number }, id: number, stroom: boolean): void {
    const zak = 10 + Math.hypot(z.x - a.x, z.y - a.y) * 0.08;
    const punt = (f: number, dx = 0) => ({ x: a.x + (z.x - a.x) * f + dx, y: a.y + (z.y - a.y) * f + Math.sin(f * Math.PI) * zak });
    for (const [dx, kleur] of [[0, 0x07070a], [2, 0x3a1312], [-2, 0x3f3510]] as [number, number][]) {
      const pts: number[] = [];
      for (let i = 0; i <= 14; i++) {
        const p = punt(i / 14, dx);
        pts.push(Math.round(p.x / PIXEL) * PIXEL, Math.round(p.y / PIXEL) * PIXEL);
      }
      kabels.poly(pts, false).stroke({ width: PIXEL, color: kleur });
    }
    if (!stroom) return;
    for (let i = 0; i < 2; i++) {
      const p = punt((t * 0.7 + i / 2 + id * 0.137) % 1);
      kabelGloed.rect(Math.round(p.x / PIXEL) * PIXEL, Math.round(p.y / PIXEL) * PIXEL, PIXEL, PIXEL).fill(0x9dff2e);
    }
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
  const cirkel = (x: number, y: number, r: number, kleur: number) => {
    const pts: number[] = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const p = naarScherm(x + Math.cos(a) * r, y + Math.sin(a) * r);
      pts.push(p.x, p.y);
    }
    geest.poly(pts).stroke({ width: PIXEL, color: kleur, alpha: 0.35 });
  };

  function tekenGeest(s: SpelStaat): void {
    geest.clear();
    melding = null;
    if (geestStuk) toon(geestStuk, false);
    if (!modus) return;
    const ind = industrie(s);
    const G = getallen();
    if (modus === 'band' || modus === 'sloop') for (const b of ind.banden.values()) pijl(b.x, b.y, b.naar, 0xffd23f);
    if (modus === 'paal' || modus === 'boor') {
      // waar is stroom: het bereik van de machine en van elke aangesloten paal
      const net = aangesloten(s);
      const m = midden(s.kaart.machine);
      cirkel(m.x, m.y, G.paal.bereik + 2, 0x9dff2e);
      for (const p of ind.palen) if (net.has(p.id)) cirkel(p.x, p.y, G.paal.bereik, 0x9dff2e);
    }
    if (!muis) return;
    const { kol, rij } = muis;
    if (modus === 'boor' || modus === 'stapel' || modus === 'paal') {
      const o = kanZetten(s, modus, kol, rij, stapelGoed);
      melding = o;
      const kleur = o.ok ? 0x9dff2e : 0xff2a3a;
      const naam = modus === 'paal' ? 'mast' : modus;
      const w = modus === 'paal' ? 1 : 2;
      if (!geestStuk || geestStuk.naam !== naam) {
        if (geestStuk) beeld.weg(geestStuk);
        geestStuk = beeld.maak(naam);
      }
      toon(geestStuk, true);
      zetStuk(geestStuk, kol, rij, w, 1, 99998);
      geestStuk.delen.forEach((d) => (d.alpha = 0.55));
      geestStuk.delen[0].tint = kleur;
      geest.poly(ruitPad(kol, rij, w, w)).fill({ color: kleur, alpha: 0.18 }).stroke({ width: PIXEL, color: kleur, alpha: 0.8 });
      if (modus === 'boor') geest.poly(ruitPad(kol - G.boor.bereik, rij - G.boor.bereik, 2 + 2 * G.boor.bereik, 2 + 2 * G.boor.bereik)).stroke({ width: PIXEL, color: kleur, alpha: 0.45 });
      if (modus === 'paal') cirkel(kol, rij, G.paal.bereik, kleur);
      if (modus === 'stapel' && o.ok) melding = { ok: true, reden: hulpVan('stapel') };
      void gevoed;
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
      const ok = ind.delen.band >= nieuw;
      melding = { ok, reden: `${nieuw} NIEUWE TEGELS, ${ind.delen.band} BAND KLAAR${ok ? '' : '. LAAT MEER MAKEN (SHIFT+L)'}` };
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

export { opslagMax };
