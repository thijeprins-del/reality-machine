// Bouwen in de wereld (muizen): het bouwmenu rechts (wat je kunt neerzetten en welke onderdelen het kost, en de
// fabricator die je hebt aangeklikt), de muis in bouwmodus, en alles van de industrie tekenen: houtbrander,
// fabricators, boren (die de machine naar hun plek gooit), banden met lading, palen met kabels, bouwplekken en hopen.
// Regels staan in industrie.ts en werk.ts; dit bestand tekent alleen en vertaalt klikken. Tekst in beeld is Engels.
import { Graphics } from 'pixi.js';
import { naarScherm } from '../kern/iso';
import type { Blok } from '../kern/kaart';
import type { SpelStaat } from '../kern/spel';
import { hoogteOp, tegelOnder } from '../kern/terrein';
import type { Goed, Richting, Voorraad } from '../kern/types';
import { PIXEL, type Stuk, type WereldBeeld } from '../kern/wereldbeeld';
import { energie, verbruiker } from './energie';
import {
  aangesloten, blok2, DELEN, fabriekOp, PRIOS, stapelExtra, stapelOp, stapelPrio, stapelVoor, stapelVolgorde, getallen, GOEDEREN, industrie, kanBandOp, kanZetten, kiesRecept, legBand,
  midden, opslagMax, RICHTINGEN, sloop, tegel, vast, zet, type Bouwsel, type Deel, type Maker, type Oordeel,
} from './industrie';
import { kanBetalen, kostTekst, naamVan } from './kosten';
import { werk } from './werk';
import { tekenRegels, type Regel } from './letters';
import { KL } from './paneel';

declare global {
  interface Window {
    MUIZEN: {
      industrie: () => ReturnType<typeof industrie>;
      zoekBoorplek: (goed: string) => [number, number] | null;
      zet: (d: Bouwsel, x: number, y: number, goed?: Goed) => boolean;
      band: (a: [number, number], b: [number, number]) => number;
      recept: (fabriekId: number, r: Deel | null) => void;
      kies: (fabriekId: number | null) => void;
      sloop: (x: number, y: number) => boolean;
      taken: () => [number, unknown][];
      scherm: (kol: number, rij: number) => { x: number; y: number };
    };
  }
}

type Modus = Bouwsel | 'sloop' | null;
const KNOPPEN: { id: Exclude<Modus, null>; naam: string; toets: string; uitleg: string }[] = [
  { id: 'fabricator', naam: 'FABRICATOR', toets: 'F', uitleg: 'MAKES PARTS. INSIDE THE RING. CLICK IT TO PICK A RECIPE' },
  { id: 'boor', naam: 'DRILL', toets: 'B', uitleg: 'CLICK NEXT TO A FIELD. THE MACHINE THROWS IT THERE' },
  { id: 'band', naam: 'BELT', toets: 'L', uitleg: 'DRAG FROM A DRILL OR FABRICATOR TO THE STOCK. R = TURN' },
  { id: 'paal', naam: 'POLE', toets: 'P', uitleg: 'CARRIES POWER. CABLES RUN FROM POLE TO POLE' },
  { id: 'stapel', naam: 'STOCKPILE', toets: 'O', uitleg: 'MORE STOCK FOR ONE GOOD, 2X2. R = OTHER GOOD. A BELT NEXT TO IT PULLS FROM IT' },
  { id: 'kist', naam: 'SMALL PILE', toets: 'K', uitleg: 'A SMALL STOCKPILE OF 1 TILE. R = OTHER GOOD. A BELT NEXT TO IT PULLS FROM IT' },
  { id: 'sloop', naam: 'DEMOLISH', toets: 'X', uitleg: 'CLICK OR DRAG. YOU GET THE BUILD COST BACK' },
];
const SW = 136, SH = 364; // bouwmenu in menu-eenheden
const RIJ = 24; // hoogte van een knop

export function maakBouwen(staat: () => SpelStaat, beeld: WereldBeeld): { werk(sec: number): void } {
  const canvas = document.body.querySelector('canvas') as HTMLCanvasElement; // het spel zelf (eerste canvas)
  let modus: Modus = null;
  let draai: Richting = 'O'; // richting van een losse bandtegel (R draait)
  let stapelGoed: Goed = 'schroot'; // voor welk goed een nieuwe stapel is (R wisselt)
  let muis: { kol: number; rij: number } | null = null;
  let sleep: { kol: number; rij: number } | null = null;
  let melding: Oordeel | null = null;
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

  const boren = new Map<number, { st: Stuk; vloog: boolean }>();
  const voorVoet = new Map<number, Stuk[]>(); // wat een boor of fabricator klaar heeft liggen
  const banden = new Map<number, { st: Stuk; last: Stuk | null }>();
  const vaste = new Map<string, Stuk>(); // stapels, palen, bronnen, fabricator
  const hopen: Stuk[] = [];
  let geestStuk: Stuk | null = null;
  let radHoek = 0;

  // schermpunt van een tegel, op de hoogte van de heuvels (Lieuwe, terrein.ts)
  const iso = (kol: number, rij: number) => naarScherm(kol, rij, hoogteOp(staat().kaart, kol, rij));
  const plof = (x: number, y: number) => {
    const p = iso(x, y);
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 220;
      deeltjes.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - 60, leeft: 0.6 + Math.random() * 0.9, kleur: [0x6a6258, 0x4a443d, 0x857b6e][i % 3], maat: PIXEL * (1 + Math.floor(Math.random() * 3)) });
    }
    beeld.schudden(9);
  };

  // ---- het bouwmenu (pixelart rechts, tekst scherp erbovenop) ----
  const bv = Object.assign(document.createElement('canvas'), { width: SW, height: SH });
  bv.id = 'bouwmenu';
  bv.setAttribute('aria-label', 'Build menu: what you can place, the parts it needs, and the selected fabricator');
  Object.assign(bv.style, { position: 'fixed', right: '0', top: '0', zIndex: '5', cursor: 'pointer' });
  document.body.appendChild(bv);
  const bvc = bv.getContext('2d')!;
  const laag = Object.assign(document.createElement('canvas'), { width: SW, height: SH });
  const bc = laag.getContext('2d')!;
  let bs = 2;
  const maat = () => {
    bs = Math.max(1, Math.min(3, Math.floor(Math.min((innerHeight * 0.92) / SH, (innerWidth * 0.24) / SW) * 2) / 2));
    const dpr = Math.min(2, devicePixelRatio || 1);
    bv.style.width = `${SW * bs}px`;
    bv.style.height = `${SH * bs}px`;
    bv.width = Math.round(SW * bs * dpr);
    bv.height = Math.round(SH * bs * dpr);
  };
  maat();
  window.addEventListener('resize', maat);
  const R = (x: number, y: number, w: number, h: number, k: string) => {
    bc.fillStyle = k;
    bc.fillRect(x, y, w, h);
  };
  let regels: Regel[] = [];
  const txt = (s: string, x: number, y: number, k: string, w?: number) => {
    regels.push({ s: s.toUpperCase(), x, y, k, sz: 1, w: w && s.length * 4 > w ? w : undefined });
    return x + Math.min(s.length * 4, w ?? Infinity);
  };
  // tekst over meerdere regels, hooguit `n` regels van `breed` tekens
  const zinnen = (tekst: string, breed: number, n: number) => {
    const uit = [''];
    for (const w of tekst.split(' ')) {
      if ((uit[uit.length - 1] + ' ' + w).trim().length > breed && uit.length < n) uit.push('');
      uit[uit.length - 1] = (uit[uit.length - 1] + ' ' + w).trim();
    }
    return uit;
  };
  interface Vak { x: number; y: number; w: number; h: number; doe: (() => void) | null; hulp: string }
  let vakken: Vak[] = [];
  const vak = (x: number, y: number, w: number, h: number, doe: Vak['doe'], hulp: string) => vakken.push({ x, y, w, h, doe, hulp });
  let gekozen: number | null = null; // aangeklikte fabricator
  let wijst = -1;

  const kostKleur = (s: SpelStaat, k: Parameters<typeof kanBetalen>[1]) => (kanBetalen(s.voorraad, k) ? KL.groen : KL.rood);
  function knopVlak(x: number, y: number, w: number, h: number, aan: boolean, hover: boolean): void {
    R(x, y, w, h, aan ? '#1d2a14' : hover ? '#1a1c1b' : '#121413');
    R(x, y, w, 1, aan ? KL.groen : '#060606');
    R(x, y + h - 1, w, 1, aan ? KL.groen : '#353837');
  }
  function tekenMenu(s: SpelStaat): void {
    const i = industrie(s);
    const G = getallen();
    regels = [];
    vakken = [];
    bc.clearRect(0, 0, SW, SH);
    R(0, 0, SW, SH, '#0b0c0c');
    R(0, 0, 1, SH, '#353837');
    R(0, SH - 1, SW, 1, '#353837');
    for (let y = 0; y < SH; y++) R(1, y, 2, 1, Math.floor(y / 3) % 2 ? '#0a0a0a' : '#5a4a12');
    txt('BUILD', 8, 5, KL.stencil);
    txt('NEEDS', 76, 5, KL.dim);
    let y = 14;
    for (const k of KNOPPEN) {
      const n = vakken.length;
      knopVlak(6, y, SW - 10, RIJ - 2, modus === k.id, wijst === n);
      txt(k.toets, 10, y + 4, KL.stencil);
      txt(k.naam, 18, y + 4, modus === k.id ? KL.groen : '#e8e4d4');
      if (k.id === 'sloop') txt('REFUNDS THE COST', 10, y + 13, KL.dim);
      else {
        const kost = G.bouw[k.id];
        txt(kostTekst(kost, true) + (k.id === 'band' ? ' / TILE' : ''), 10, y + 13, kostKleur(s, kost), SW - 20);
      }
      vak(6, y, SW - 10, RIJ - 2, () => kies(k.id), `${k.naam} (${k.toets}): ${k.uitleg}`);
      y += RIJ;
    }
    // onderdelen in de opslag
    y += 4;
    txt('PARTS IN STOCK', 8, y, KL.stencil);
    y += 9;
    for (const d of DELEN) {
      const w = Math.floor(s.voorraad[d] ?? 0), max = opslagMax(s, d);
      txt(naamVan(d), 10, y, KL.label);
      txt(`${w}/${max}`, 46, y, w >= max ? KL.amber : '#ffe08a');
      R(80, y + 2, 48, 3, '#050505');
      R(80, y + 2, Math.round((48 * Math.min(w, max)) / max), 3, d === 'plaat' ? '#a8a49a' : '#b07a3c');
      vak(6, y - 1, SW - 10, 8, null, `${naamVan(d)}: MADE IN A FABRICATOR (${kostTekst(G.recepten[d as Deel].in, true)} > ${G.recepten[d as Deel].uit})`);
      y += 9;
    }
    // de aangeklikte fabricator
    const f = i.fabrieken.find((x) => x.id === gekozen);
    const st = i.stapels.find((x) => x.id === gekozen);
    if (!f && !st) gekozen = null;
    y += 4;
    R(6, y - 2, SW - 10, 1, '#353837');
    if (st) {
      // aangeklikte stockpile: wat erin komt en welke prio
      txt('STOCKPILE', 8, y + 2, KL.cyaan);
      y += 11;
      txt(st.af ? 'BEING BUILT' : `TAKES ${naamVan(st.goed)}, +${stapelExtra(st)}`, 10, y, st.af ? KL.geel : KL.groen, SW - 20);
      y += 10;
      const bw = (SW - 14) / 2;
      GOEDEREN.forEach((g, n) => {
        const bx = 6 + (n % 2) * (bw + 4), by = y + Math.floor(n / 2) * 14;
        const m = vakken.length;
        knopVlak(bx, by, bw, 12, st.goed === g, wijst === m);
        txt(naamVan(g), bx + 4, by + 4, st.goed === g ? KL.groen : '#e8e4d4');
        vak(bx, by, bw, 12, () => stapelVoor(s, st, g), `THIS STOCKPILE TAKES ${naamVan(g)}`);
      });
      y += Math.ceil(GOEDEREN.length / 2) * 14 + 2;
      txt('PRIORITY', 10, y, KL.label);
      y += 8;
      const pw = (SW - 18) / 3;
      PRIOS.forEach((naam, n) => {
        const bx = 6 + n * (pw + 4), m = vakken.length;
        knopVlak(bx, y, pw, 12, st.prio === n, wijst === m);
        txt(naam, bx + 3, y + 4, st.prio === n ? KL.groen : '#e8e4d4', pw - 5);
        vak(bx, y, pw, 12, () => stapelPrio(s, st, n as 0 | 1 | 2), n === 2 ? 'HIGH: MICE BRING HERE FIRST AND IT FILLS FIRST' : n === 0 ? 'LOW: FILLS LAST' : 'NORMAL: FILLS AFTER THE MAIN STOCK');
      });
      y += 14;
    } else if (f) {
      txt('FABRICATOR', 8, y + 2, KL.cyaan);
      y += 11;
      const status = f.af ? 'BEING BUILT' : f.geblokt || `MAKING ${naamVan(f.recept!)}`;
      txt(status, 10, y, f.af ? KL.geel : f.geblokt ? KL.rood : KL.groen, SW - 20);
      y += 8;
      R(10, y, SW - 20, 4, '#050505');
      R(10, y, Math.round((SW - 20) * f.klok), 4, KL.cyaan);
      y += 7;
      txt(`OUTPUT ${f.buffer.length}/${G.fabricator.buffer}  MICE ${f.ploeg}/${G.fabricator.ploeg}`, 10, y, KL.label, SW - 20);
      y += 8;
      txt(f.af ? `NEEDS ${kostTekst(f.nodig, true)}` : `INPUT ${kostTekst(f.invoer, true).replace('FREE', 'NONE')}`, 10, y, KL.label, SW - 20);
      y += 10;
      for (const d of [...DELEN, null] as (Deel | null)[]) {
        const n = vakken.length;
        knopVlak(6, y, SW - 10, 12, f.recept === d, wijst === n);
        if (d) {
          const r = G.recepten[d];
          txt(naamVan(d), 10, y + 4, f.recept === d ? KL.groen : '#e8e4d4');
          txt(`${kostTekst(r.in, true)} > ${r.uit}`, 50, y + 4, kostKleur(s, r.in), SW - 58);
        } else txt('STOP', 10, y + 4, f.recept === null ? KL.groen : '#e8e4d4');
        vak(6, y, SW - 10, 12, () => kiesRecept(s, f, d), d ? `MAKE ${naamVan(d)}. OUTPUT GOES TO THE STOCK BY BELT OR BY MICE` : 'STOP THIS FABRICATOR');
        y += 14;
      }
    } else {
      txt('SELECTED', 8, y + 2, KL.dim);
      y += 11;
      for (const z of zinnen(i.fabrieken.length ? 'CLICK A FABRICATOR OR STOCKPILE TO SET IT UP' : 'BUILD A FABRICATOR (F) TO MAKE PARTS. CLICK A STOCKPILE TO SET IT UP', 30, 3)) {
        txt(z, 10, y, KL.dim);
        y += 8;
      }
    }
    // uitleg en meldingen onderaan
    const regel = melding ? melding.reden : wijst >= 0 && vakken[wijst] ? vakken[wijst].hulp : modus ? KNOPPEN.find((k) => k.id === modus)!.uitleg : 'PICK SOMETHING TO BUILD. RIGHT CLICK OR ESC STOPS';
    R(6, SH - 42, SW - 10, 1, '#353837');
    zinnen(regel, 31, 4).forEach((z, n) => txt(z, 8, SH - 37 + n * 8, melding ? (melding.ok ? KL.groen : KL.rood) : KL.cyaan));
    // naar het scherm: pixels opschalen, tekst scherp erover
    bvc.imageSmoothingEnabled = false;
    bvc.clearRect(0, 0, bv.width, bv.height);
    bvc.drawImage(laag, 0, 0, bv.width, bv.height);
    tekenRegels(bvc, regels, bv.width / SW, bv.height / SH);
  }
  const kies = (m: Modus) => {
    modus = modus === m ? null : m;
    melding = null;
    sleep = null;
  };
  const opMenu = (e: PointerEvent) => {
    const r = bv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * SW, y = ((e.clientY - r.top) / r.height) * SH;
    for (let n = vakken.length - 1; n >= 0; n--) {
      const v = vakken[n];
      if (x >= v.x && y >= v.y && x < v.x + v.w && y < v.y + v.h) return n;
    }
    return -1;
  };
  bv.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const n = opMenu(e);
    if (n >= 0 && e.button === 0) vakken[n].doe?.();
  });
  bv.addEventListener('pointermove', (e) => (wijst = opMenu(e)));
  bv.addEventListener('pointerleave', () => (wijst = -1));
  bv.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- invoer in de wereld ----
  const opTegel = (e: PointerEvent | MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    const p = beeld.wereld.toLocal({ x: e.clientX - r.left, y: e.clientY - r.top });
    return tegelOnder(staat().kaart, p.x, p.y);
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
      if (zet(s, m, kol, rij, stapelGoed) && !kanBetalen(s.voorraad, getallen().bouw[m])) modus = null;
      if (m === 'fabricator') {
        gekozen = industrie(s).fabrieken.at(-1)?.id ?? null;
        modus = null;
      }
    }
  }
  window.addEventListener('pointerdown', (e) => {
    if (e.target !== canvas || e.defaultPrevented) return;
    if (!modus) {
      // een fabricator aanklikken: dan kies je rechts wat hij maakt
      if (e.button !== 0) return;
      const tg = opTegel(e);
      const f = fabriekOp(staat(), tg.kol, tg.rij) ?? stapelOp(staat(), tg.kol, tg.rij);
      gekozen = f ? f.id : null;
      if (f) {
        e.stopPropagation();
        e.preventDefault();
      }
      return;
    }
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
    if (k && !e.shiftKey) kies(k.id);
    if (t === 'ESCAPE') {
      kies(null);
      gekozen = null;
    }
    if (t === 'R' && modus === 'band') draai = ({ O: 'Z', Z: 'W', W: 'N', N: 'O' } as const)[draai];
    if (t === 'R' && (modus === 'stapel' || modus === 'kist')) stapelGoed = GOEDEREN[(GOEDEREN.indexOf(stapelGoed) + 1) % GOEDEREN.length];
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
    recept: (id, r) => {
      const f = industrie(staat()).fabrieken.find((x) => x.id === id);
      if (f) kiesRecept(staat(), f, r);
    },
    kies: (id) => (gekozen = id),
    sloop: (x, y) => sloop(staat(), x, y),
    taken: () => [...werk(staat()).taken],
    scherm: (kol, rij) => {
      const p = beeld.wereld.toGlobal(iso(kol, rij));
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
  // balkje boven een bouwplek: cyaan = spullen gebracht, geel = gebouwd
  function voortgang(b: Blok, af: number, werk: number, nodig?: Voorraad, kost?: Voorraad): void {
    if (af <= 0) return;
    const c = midden(b);
    const p = iso(c.x, c.y);
    const w = 40;
    balken.rect(p.x - w / 2, p.y - 30, w, PIXEL * 2).fill(0x050505);
    const tot = Object.values(kost ?? {}).reduce((a: number, n) => a + (n ?? 0), 0);
    const rest = Object.values(nodig ?? {}).reduce((a: number, n) => a + (n ?? 0), 0);
    if (rest > 0) balken.rect(p.x - w / 2, p.y - 30, Math.round(w * (1 - rest / (tot || 1))), PIXEL * 2).fill(0x4ef2ff);
    else balken.rect(p.x - w / 2, p.y - 30, Math.round(w * (1 - af / werk)), PIXEL * 2).fill(0xffd23f);
  }

  function machineTop(s: SpelStaat) {
    const m = s.kaart.machine;
    const p = iso(m.x + m.breed / 2 - 0.5, m.y + m.diep / 2 - 0.5);
    return { x: p.x, y: p.y - 300 };
  }
  const paalTop = (x: number, y: number) => {
    const p = iso(x, y);
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

  // wat een maker klaar heeft en nog niet kwijt is: brokken of onderdelen voor zijn voet
  function lasten(b: Maker, w: number): void {
    let l = voorVoet.get(b.id);
    if (!l) voorVoet.set(b.id, (l = []));
    while (l.length < b.buffer.length) l.push(beeld.maak(`last-${b.buffer[l.length]}`, true));
    while (l.length > b.buffer.length) beeld.weg(l.pop()!);
    l.forEach((st, i) => {
      const naam = `last-${b.buffer[i]}`;
      if (st.naam !== naam) beeld.wissel(st, naam);
      zetDing(st, b.x + w - 0.2 - (i % 4) * 0.28, b.y + w - 0.1 - Math.floor(i / 4) * 0.22, (b.x + b.y + w + 1) * 10 + 5);
    });
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
      if (b.renners) {
        // looprad: de spaken draaien sneller naarmate hij meer levert
        radHoek += sec * b.levert * 1.5;
        // achter de muizen getekend, zodat je ze erin ziet rennen
        const rb = V.bronnen[b.id];
        vastAan(`bron-${b.id}`, `rad-${Math.floor(radHoek) % 3}`, rb, 2, b.mk > 0, 0, (rb.x + rb.y) * 10 - 5);
        const st = vaste.get(`bron-${b.id}`);
        if (st && st.naam !== `rad-${Math.floor(radHoek) % 3}`) beeld.wissel(st, `rad-${Math.floor(radHoek) % 3}`);
        continue;
      }
      const naam = b.id === 'houtbrander' ? 'houtbrander' : b.id === 'dynamo' ? 'dynamo' : '';
      if (naam) vastAan(`bron-${b.id}`, naam, V.bronnen[b.id], 2, b.mk > 0);
      if (b.levert > 0 && Math.random() < sec * (b.stand === 2 ? 14 : 4)) {
        // rook (en vonken als hij overladen is)
        const c = midden(V.bronnen[b.id]);
        const p = iso(c.x - 0.3, c.y - 0.3);
        deeltjes.push({ x: p.x + (Math.random() - 0.5) * 6, y: p.y - (b.id === 'houtbrander' ? 150 : 110), vx: (Math.random() - 0.5) * 20, vy: -60 - Math.random() * 40, leeft: 1.2, kleur: b.stand === 2 ? 0xff6a1a : 0x3a3530, maat: PIXEL * 2 });
      }
    }
    for (const f of ind.fabrieken) {
      vastAan(`fab-${f.id}`, 'pers', blok2(f), 2, true, f.af, (f.x + f.y + 2) * 10);
      voortgang(blok2(f), f.af, G.fabricator.werk, f.nodig, G.bouw.fabricator);
      if (!f.af && f.recept && !f.geblokt && Math.sin(t * 30) > 0) for (const d of vaste.get(`fab-${f.id}`)!.delen) d.y -= PIXEL;
      if (f.id === gekozen) balken.poly(ruitPad(f.x, f.y, 2, 2)).stroke({ width: PIXEL, color: 0x4ef2ff, alpha: 0.4 + 0.3 * Math.sin(t * 5) });
      lasten(f, 2);
    }

    // stapels en palen
    for (const p of ind.stapels) {
      vastAan(`stapel-${p.id}`, p.maat === 1 ? 'stapel-1' : 'stapel', blok2(p), p.maat, true, p.af, (p.x + p.y) * 10 - 5);
      if (p.id === gekozen) balken.poly(ruitPad(p.x, p.y, p.maat, p.maat)).stroke({ width: PIXEL, color: 0x4ef2ff, alpha: 0.4 + 0.3 * Math.sin(t * 5) });
      voortgang(blok2(p), p.af, p.maat === 1 ? G.stapel.klein.werk : G.stapel.werk, p.nodig, p.maat === 1 ? G.bouw.kist : G.bouw.stapel);
    }
    for (const p of ind.palen) {
      vastAan(`paal-${p.id}`, 'mast', { x: p.x, y: p.y, breed: 1, diep: 1 }, 1, true, p.af);
      voortgang({ x: p.x, y: p.y, breed: 1, diep: 1 }, p.af, G.paal.werk, p.nodig, G.bouw.paal);
    }
    for (const [k, st] of vaste) if (!gezien.has(k)) { beeld.weg(st); vaste.delete(k); }

    // boren: vliegen, landen, opgebouwd worden, trillen
    const ids = new Set(ind.boren.map((b) => b.id));
    for (const [id, b] of boren) if (!ids.has(id)) { beeld.weg(b.st); boren.delete(id); }
    for (const b of ind.boren) {
      let r = boren.get(b.id);
      if (!r) {
        r = { st: beeld.maak('boor'), vloog: b.vlieg > 0 };
        boren.set(b.id, r);
      }
      zetStuk(r.st, b.x, b.y, 2, 1);
      half(r.st, b.vlieg > 0 ? 0 : b.af);
      if (b.vlieg > 0) {
        // in een boog vanaf de machine naar zijn plek, en hij valt het laatste stuk
        const f = 1 - b.vlieg / G.boor.vliegSec;
        const doel = iso(b.x + 0.5, b.y + 0.5), van = machineTop(s);
        const x = van.x + (doel.x - van.x) * f, y = van.y + (doel.y - van.y) * f - Math.sin(f * Math.PI) * 240;
        for (const d of r.st.delen) {
          d.x += x - doel.x;
          d.y += y - doel.y;
        }
        r.st.delen[0].zIndex = 99999;
        if (Math.random() < 0.6) deeltjes.push({ x, y: y - 40, vx: (Math.random() - 0.5) * 30, vy: 20, leeft: 0.5, kleur: 0x2a2724, maat: PIXEL * 2 });
      } else {
        if (r.vloog) plof(b.x + 0.5, b.y + 0.5);
        voortgang(blok2(b), b.af, G.boor.werk, b.nodig, G.bouw.boor);
        if (b.graaft && Math.sin(t * 40 + b.id) > 0) for (const d of r.st.delen) d.y -= PIXEL;
        if (b.graaft && Math.random() < sec * 6) {
          const p = iso(b.x + 0.5 + (Math.random() - 0.5), b.y + 0.5 + (Math.random() - 0.5));
          deeltjes.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60, leeft: 0.5, kleur: 0x4a443d, maat: PIXEL });
        }
      }
      r.vloog = b.vlieg > 0;
      lasten(b, 2);
    }
    for (const [id, l] of voorVoet) if (!ind.boren.some((b) => b.id === id) && !ind.fabrieken.some((f) => f.id === id)) { l.forEach((x) => beeld.weg(x)); voorVoet.delete(id); }

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
    const berg = (g: Goed, bx: number, by: number, aantal: number) => {
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
    for (const [gi, g] of GOEDEREN.entries()) {
      // verdeeld op prio: stapels met HIGH eerst vol, dan het erf, dan de rest
      let rest = Math.ceil((s.voorraad[g] ?? 0) / G.hoop - 0.01);
      for (const p of stapelVolgorde(s, g)) {
        if (p === 'erf') {
          const opErf = Math.min(rest, Math.floor(G.opslagMax / G.hoop), 4);
          rest -= opErf;
          berg(g, V.erf.x + [0.05, 0.5, 0.95, 0.95, 0.05][gi], V.erf.y + [0.95, 0.5, 0.05, 0.95, 0.05][gi], opErf);
          continue;
        }
        const hier = Math.min(rest, Math.floor(stapelExtra(p) / G.hoop), p.maat === 1 ? 4 : LAGEN.length);
        rest -= hier;
        berg(g, p.x + (p.maat - 1) / 2, p.y + (p.maat - 1) / 2, hier);
      }
    }
    for (let i = n; i < hopen.length; i++) toon(hopen[i], false);

    // kabels: machine -> palen -> palen, en van de dichtstbijzijnde paal naar wat stroom krijgt
    kabels.clear();
    kabelGloed.clear();
    const m = midden(s.kaart.machine);
    const hub = (() => { const p = iso(m.x, m.y); return { x: p.x, y: p.y - 150 }; })();
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
      const doel = (() => { const p = iso(c.x, c.y); return { x: p.x, y: p.y - 40 }; })();
      if (Math.hypot(c.x - m.x, c.y - m.y) <= G.paal.bereik + 2) return kabel(hub, doel, id, krijgt > 0);
      let van = null as null | { x: number; y: number }, bd = Infinity;
      for (const p of palen) {
        const d = Math.hypot(p.x - c.x, p.y - c.y);
        if (net.has(p.id) && d <= G.paal.bereik && d < bd) [van, bd] = [paalTop(p.x, p.y), d];
      }
      if (van) kabel(van, doel, id, krijgt > 0);
    };
    for (const b of ind.boren) if (!b.vlieg) voed(blok2(b), b.id);
    for (const f of ind.fabrieken) voed(blok2(f), f.id);
    for (const b of e.bronnen) if (b.mk) {
      const c = midden(V.bronnen[b.id]);
      const p = iso(c.x, c.y);
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
    const a = iso(x - 0.5, y - 0.5), b = iso(x + w - 0.5, y - 0.5), c = iso(x + w - 0.5, y + h - 0.5), d = iso(x - 0.5, y + h - 0.5);
    return [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y];
  };
  function pijl(x: number, y: number, naar: Richting, kleur: number): void {
    const [dx, dy] = RICHTINGEN[naar];
    const p = iso(x + dx * 0.25, y + dy * 0.25), q = iso(x - dx * 0.2 + dy * 0.2, y - dy * 0.2 + dx * 0.2), r = iso(x - dx * 0.2 - dy * 0.2, y - dy * 0.2 - dx * 0.2);
    geest.poly([p.x, p.y - 4, q.x, q.y - 4, r.x, r.y - 4]).fill({ color: kleur, alpha: 0.9 });
  }
  const cirkel = (x: number, y: number, r: number, kleur: number) => {
    const pts: number[] = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const p = iso(x + Math.cos(a) * r, y + Math.sin(a) * r);
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
    if (modus === 'paal' || modus === 'boor' || modus === 'fabricator') {
      // waar is stroom: het bereik van de machine en van elke aangesloten paal
      const net = aangesloten(s);
      const m = midden(s.kaart.machine);
      cirkel(m.x, m.y, G.paal.bereik + 2, 0x9dff2e);
      for (const p of ind.palen) if (net.has(p.id)) cirkel(p.x, p.y, G.paal.bereik, 0x9dff2e);
    }
    if (!muis) return;
    const { kol, rij } = muis;
    if (modus === 'boor' || modus === 'stapel' || modus === 'kist' || modus === 'paal' || modus === 'fabricator') {
      const o = kanZetten(s, modus, kol, rij, stapelGoed);
      melding = o;
      const kleur = o.ok ? 0x9dff2e : 0xff2a3a;
      const naam = modus === 'paal' ? 'mast' : modus === 'fabricator' ? 'pers' : modus === 'kist' ? 'stapel-1' : modus;
      const w = modus === 'paal' || modus === 'kist' ? 1 : 2;
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
      const kost = G.bouw.band;
      const ok = kanBetalen(s.voorraad, kost, nieuw);
      melding = { ok, reden: `${nieuw} NEW TILES: ${kostTekst(kost, true).replace(/^(\d+)/, (n) => String(+n * nieuw))}${ok ? '' : '. NOT ENOUGH, MAKE MORE IN A FABRICATOR'}` };
    } else melding = { ok: true, reden: `DEMOLISH ${p.length} TILES` };
  }

  return {
    werk(sec) {
      t += sec;
      const s = staat();
      tekenWereld(s, sec);
      tekenGeest(s);
      canvas.style.cursor = modus ? 'crosshair' : '';
      tekenMenu(s);
    },
  };
}

