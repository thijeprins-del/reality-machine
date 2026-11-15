// Bouwen in de wereld: de muis in bouwmodus en alles van de industrie tekenen (het menu zelf staat in bouwmenu.ts): stroombronnen, gebouwen (winningsgebouwen
// gooit de machine naar hun plek), banden met lading, palen met kabels, bouwplekken en hopen.
// De knoppen komen uit de economie van de wereld (economies/*.json). Een gebouw of goed zonder eigen plaatje krijgt een
// bestaand plaatje in zijn kleur. Regels staan in industrie.ts en werk.ts; dit bestand tekent alleen en vertaalt klikken.
import { Graphics } from 'pixi.js';
import { naarScherm } from '../kern/iso';
import { klein } from '../kern/scherm';
import type { Blok } from '../kern/kaart';
import type { SpelStaat } from '../kern/spel';
import { hoogteOp, tegelOnder } from '../kern/terrein';
import { actieveEconomie, goed, type BouwSoort } from '../kern/economie';
import type { Goed, Richting, Voorraad } from '../kern/types';
import { PIXEL, type Stuk, type WereldBeeld } from '../kern/wereldbeeld';
import { energie, verbruiker } from './energie';
import {
  aangesloten, bereikVan, blokVan, bouwSoorten, gebouwOp, getallen, goederen, industrie, kanBandOp, kanZetten, kiesRecept, legBand,
  magazijnen, makers, midden, palen as allePalen, poorten, poortenVan, RICHTINGEN, sloop, soortVan, tegel, vast, zet,
  type Gebouw, type Oordeel, type Poort,
} from './industrie';
import { maakBouwmenu, knoppen } from './bouwmenu';
import { kanBetalen, kostTekst } from './kosten';
import { werk } from './werk';

declare global {
  interface Window {
    RATTEN: {
      industrie: () => ReturnType<typeof industrie>;
      zoekBoorplek: (goed: string) => [number, number] | null;
      zet: (soort: string, x: number, y: number) => boolean; // soort = id van een gebouw in de economie van deze wereld
      band: (a: [number, number], b: [number, number]) => number;
      recept: (gebouwId: number, r: string | null) => void;
      kies: (gebouwId: number | null) => void;
      sloop: (x: number, y: number) => boolean;
      taken: () => [number, unknown][];
      scherm: (kol: number, rij: number) => { x: number; y: number };
    };
  }
}

// Wat je aan het neerzetten bent: de id van een gebouw uit de economie van deze wereld, of 'sloop'.
type Modus = string | null;
const hex = (k: string) => parseInt(k.slice(1), 16);

export function maakBouwen(staat: () => SpelStaat, beeld: WereldBeeld): { werk(sec: number): void; zicht(aan: boolean): void } {
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
  const balken = new Graphics(); // voortgang van bouwplekken
  const stof = new Graphics();
  beeld.wereld.addChildAt(kabels, beeld.wereld.getChildIndex(beeld.dingen) + 1);
  beeld.scherp.addChild(kabelGloed);
  for (const g of [stof, geest, balken]) beeld.wereld.addChildAt(g, beeld.wereld.getChildIndex(beeld.dingen) + 1);
  const deeltjes: { x: number; y: number; vx: number; vy: number; leeft: number; kleur: number; maat: number }[] = [];

  const boren = new Map<number, { st: Stuk; vloog: boolean }>();
  const voorVoet = new Map<number, Stuk[]>(); // wat een boor of fabricator klaar heeft liggen
  const banden = new Map<number, { st: Stuk; last: Stuk | null }>();
  const vaste = new Map<string, Stuk>(); // bronnen en gebouwen
  const hopen: Stuk[] = [];
  let geestStuk: Stuk | null = null;
  let radHoek = 0;

  // Het plaatje van een gebouw of goed. Is het er (nog) niet, dan een bestaand plaatje in de kleur uit het bestand.
  const modusSoort = (): BouwSoort | undefined => (modus && modus !== 'sloop' ? actieveEconomie().gebouwen.get(modus) : undefined);
  const sleept = () => modus === 'sloop' || modusSoort()?.aard === 'belt'; // band leggen en slopen doe je door te slepen
  const spriteVoor = (soort: BouwSoort): { naam: string; tint: number } => {
    if (soort.sprite && beeld.heeft(soort.sprite)) return { naam: soort.sprite, tint: 0xffffff };
    const naam = soort.aard === 'belt' ? 'band-leeg' : soort.aard === 'pole' ? 'mast' : soort.size === 1 ? 'stapel-1' : soort.onDeposit ? 'boor' : soort.aard === 'sink' ? 'stapel' : 'pers';
    return { naam, tint: hex(soort.color) };
  };
  const stukVoor = (g: Goed, vorm: 'last' | 'hoop'): { naam: string; tint: number } => {
    // eerst zijn eigen plaatje; anders dat van zijn id (drijfhout is hout) of het schroot, in zijn eigen kleur
    const eigen = `${vorm}-${goed(g).sprite ?? g}`;
    if (beeld.heeft(eigen)) return { naam: eigen, tint: 0xffffff };
    return { naam: beeld.heeft(`${vorm}-${g}`) ? `${vorm}-${g}` : `${vorm}-schroot`, tint: hex(goed(g).color) };
  };
  const zetNaam = (st: Stuk, p: { naam: string; tint: number }) => {
    if (st.naam !== p.naam) beeld.wissel(st, p.naam);
    st.delen[0].tint = p.tint;
  };

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

  // ---- het bouwmenu (bouwmenu.ts): kaarten met plaatje, naam en kosten, en alles over het gekozen gebouw ----
  let gekozen: number | null = null; // aangeklikt gebouw
  const kies = (m: Modus) => {
    modus = modus === m ? null : m;
    melding = null;
    sleep = null;
  };
  const menu = maakBouwmenu({ staat, modus: () => modus, kies, gekozen: () => gekozen, melding: () => melding });
  menu.zicht(!klein()); // op een telefoon dicht tot je op BUILD tikt

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
    const soort = modusSoort();
    if (soort?.aard === 'belt') legBand(s, pad({ kol, rij }, eind ?? { kol, rij }));
    else if (modus === 'sloop') for (const p of pad({ kol, rij }, eind ?? { kol, rij })) sloop(s, p.x, p.y);
    else if (soort) {
      const g = zet(s, soort, kol, rij);
      if (g && !kanBetalen(s.voorraad, soort.cost)) modus = null;
      if (g && soort.aard === 'prod' && !g.recept && !soort.onDeposit) {
        gekozen = g.id; // meer recepten: meteen kiezen
        modus = null;
      }
    }
  }
  window.addEventListener('pointerdown', (e) => {
    if (e.target !== canvas || e.defaultPrevented) return;
    if (!modus) {
      // een gebouw aanklikken: dan stel je het rechts in
      if (e.button !== 0) return;
      const tg = opTegel(e);
      const f = gebouwOp(staat(), tg.kol, tg.rij);
      gekozen = f ? f.id : null;
      if (f) {
        e.stopPropagation();
        e.preventDefault();
      }
      return;
    }
    if (e.button === 1) return; // middelste knop: gewoon kijken
    if (!e.isPrimary) return; // tweede vinger: knijpen om te zoomen
    if (e.pointerType === 'touch' && !sleept()) {
      // aanraken: neerzetten bij loslaten, zodat slepen nog kijken is
      tikBouw = { x: e.clientX, y: e.clientY, id: e.pointerId };
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    if (e.button === 2) return kies(null);
    const tg = opTegel(e);
    if (sleept()) sleep = tg;
    else doe(staat(), tg.kol, tg.rij);
  }, { capture: true });
  window.addEventListener('pointermove', (e) => {
    if (e.target !== canvas && !sleep) {
      muis = null;
      return;
    }
    muis = opTegel(e);
  });
  let tikBouw: { x: number; y: number; id: number } | null = null;
  window.addEventListener('pointerup', (e) => {
    if (!tikBouw || tikBouw.id !== e.pointerId) return;
    const t0 = tikBouw;
    tikBouw = null;
    if (!modus || Math.hypot(e.clientX - t0.x, e.clientY - t0.y) > 10) return;
    e.preventDefault(); // gebruikt: geen tik voor de muizen (de kern ziet het loslaten nog wel, anders blijft de vinger 'hangen')
    const tg = opTegel(e);
    doe(staat(), tg.kol, tg.rij);
  }, { capture: true });
  window.addEventListener('pointerup', (e) => {
    if (!sleep || e.button !== 0) return;
    const a = sleep;
    sleep = null;
    doe(staat(), a.kol, a.rij, opTegel(e));
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const t = e.key.toUpperCase();
    const k = t.length === 1 ? knoppen().find((x) => x.toets === t) : undefined;
    if (k && !e.shiftKey && !e.ctrlKey && !e.metaKey) kies(k.id);
    if (t === 'ESCAPE') {
      kies(null);
      gekozen = null;
    }
    if (t === 'R' && modusSoort()?.aard === 'belt') draai = ({ O: 'Z', Z: 'W', W: 'N', N: 'O' } as const)[draai];
  });

  // Testhaak voor de console en de rooktest
  window.RATTEN = {
    industrie: () => industrie(staat()),
    zoekBoorplek: (goedId) => {
      const s = staat();
      const soort = bouwSoorten().find((b) => b.onDeposit && b.depRes.includes(goedId));
      if (!soort) return null;
      for (const a of s.kaart.afzettingen.filter((a) => a.goed === goedId && a.rest > 0))
        for (const [dx, dy] of [[-2, 0], [1, 0], [0, -2], [0, 1], [-2, -2], [1, 1]])
          if (kanZetten(s, soort, a.x + dx, a.y + dy).ok) return [a.x + dx, a.y + dy];
      return null;
    },
    zet: (soort, x, y) => !!zet(staat(), soort, x, y),
    band: (a, b) => legBand(staat(), pad({ kol: a[0], rij: a[1] }, { kol: b[0], rij: b[1] })),
    recept: (id, rec) => {
      const g = industrie(staat()).gebouwen.find((x) => x.id === id);
      if (g) kiesRecept(staat(), g, rec);
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

  // wat een gebouw klaar heeft en nog niet kwijt is: brokken of onderdelen voor zijn voet
  function lasten(b: Gebouw, w: number): void {
    let l = voorVoet.get(b.id);
    if (!l) voorVoet.set(b.id, (l = []));
    while (l.length < b.buffer.length) l.push(beeld.maak(stukVoor(b.buffer[l.length], 'last').naam, true));
    while (l.length > b.buffer.length) beeld.weg(l.pop()!);
    l.forEach((st, i) => {
      zetNaam(st, stukVoor(b.buffer[i], 'last'));
      zetDing(st, b.x + w - 0.2 - (i % 4) * 0.28, b.y + w - 0.1 - Math.floor(i / 4) * 0.22, (b.x + b.y + w + 1) * 10 + 5);
    });
  }
  // De aansluitpunten van een gebouw: een pijl op de tegel waar een band hoort, in de kleur van het goed dat erdoor gaat
  // (wit = nog geen recept gekozen, of alles). Ingangen liggen links en wijzen het gebouw in, uitgangen rechts en wijzen weg.
  // `fel` = met een rand om de tegel erbij: voor het gekozen gebouw, en voor alles als je een band legt.
  function tekenPoorten(laag: Graphics, lijst: Poort[], fel: boolean): void {
    for (const p of lijst) {
      const kleur = p.goed ? hex(goed(p.goed).color) : 0xe8e4d4;
      const [dx, dy] = RICHTINGEN[p.richting];
      const punt = iso(p.x + dx * 0.32, p.y + dy * 0.32), l = iso(p.x - dx * 0.22 + dy * 0.3, p.y - dy * 0.22 + dx * 0.3), r = iso(p.x - dx * 0.22 - dy * 0.3, p.y - dy * 0.22 - dx * 0.3);
      if (fel) laag.poly(ruitPad(p.x, p.y)).fill({ color: kleur, alpha: 0.12 }).stroke({ width: PIXEL, color: kleur, alpha: 0.6 });
      laag.poly([punt.x, punt.y, l.x, l.y, r.x, r.y]).fill({ color: kleur, alpha: fel ? 1 : 0.7 }).stroke({ width: PIXEL / 2, color: 0x050505, alpha: fel ? 0.9 : 0.6 });
      // een ingang heeft een streep achter de pijl (er gaat iets in), een uitgang niet
      if (p.in) {
        const s1 = iso(p.x - dx * 0.38 + dy * 0.3, p.y - dy * 0.38 + dx * 0.3), s2 = iso(p.x - dx * 0.38 - dy * 0.3, p.y - dy * 0.38 - dx * 0.3);
        laag.poly([s1.x, s1.y, s2.x, s2.y], false).stroke({ width: PIXEL, color: kleur, alpha: fel ? 1 : 0.7 });
      }
    }
  }

  function tekenWereld(s: SpelStaat, sec: number): void {
    const ind = industrie(s);
    const G = getallen();
    const V = vast(s);
    const e = energie(s);
    const krijgt = verbruiker(s, 'industrie').krijgt;
    balken.clear();
    // de aansluitpunten van elk productiegebouw, altijd in beeld
    const legtBand = modusSoort()?.aard === 'belt';
    for (const g of makers(ind)) if (!g.vlieg) tekenPoorten(balken, poorten(g), legtBand || g.id === gekozen);
    const gezien = new Set<string>();
    const vastAan = (k: string, ...r: Parameters<typeof vastStuk> extends [string, ...infer T] ? T : never) => {
      gezien.add(k);
      vastStuk(k, ...r);
    };

    // het looprad: de spaken draaien sneller naarmate het meer levert
    for (const b of e.bronnen) {
      radHoek += sec * b.levert * 1.5;
      // achter de ratten getekend, zodat je ze erin ziet rennen
      const rb = V.bronnen[b.id];
      vastAan(`bron-${b.id}`, `rad-${Math.floor(radHoek) % 3}`, rb, 2, true, 0, (rb.x + rb.y) * 10 - 5);
      const st = vaste.get(`bron-${b.id}`);
      if (st && st.naam !== `rad-${Math.floor(radHoek) % 3}`) beeld.wissel(st, `rad-${Math.floor(radHoek) % 3}`);
    }
    // gebouwen (winningsgebouwen vliegen eerst: die staan hieronder)
    for (const g of ind.gebouwen) {
      const soort = soortVan(g), blok = blokVan(g);
      if (soort.onDeposit) continue;
      vastAan(`g-${g.id}`, spriteVoor(soort).naam, blok, soort.size, true, g.af, soort.aard === 'sink' ? (g.x + g.y) * 10 - 5 : undefined);
      const st = vaste.get(`g-${g.id}`)!;
      st.delen[0].tint = spriteVoor(soort).tint;
      voortgang(blok, g.af, soort.work, g.nodig, soort.cost);
      if (soort.generator && !g.af && g.betaald && !g.geblokt && Math.random() < sec * 5) {
        const c = midden(blok), p = iso(c.x - 0.3, c.y - 0.3);
        deeltjes.push({ x: p.x + (Math.random() - 0.5) * 6, y: p.y - 120, vx: (Math.random() - 0.5) * 20, vy: -60 - Math.random() * 40, leeft: 1.2, kleur: 0x3a3530, maat: PIXEL * 2 });
      }
      if (soort.aard === 'prod') {
        if (!g.af && g.recept && !g.geblokt && !soort.generator && Math.sin(t * 30) > 0) for (const d of st.delen) d.y -= PIXEL;
        lasten(g, soort.size);
      }
      if (g.id === gekozen) {
        balken.poly(ruitPad(g.x, g.y, soort.size, soort.size)).stroke({ width: PIXEL, color: 0x4ef2ff, alpha: 0.4 + 0.3 * Math.sin(t * 5) });
      }
    }
    for (const [k, st] of vaste) if (!gezien.has(k)) { beeld.weg(st); vaste.delete(k); }

    // winningsgebouwen: vliegen, landen, opgebouwd worden, trillen
    const winners = makers(ind).filter((b) => soortVan(b).onDeposit);
    const ids = new Set(winners.map((b) => b.id));
    for (const [id, b] of boren) if (!ids.has(id)) { beeld.weg(b.st); boren.delete(id); }
    for (const b of winners) {
      const soort = soortVan(b), w = soort.size;
      let r = boren.get(b.id);
      if (!r) {
        r = { st: beeld.maak(spriteVoor(soort).naam), vloog: b.vlieg > 0 };
        boren.set(b.id, r);
      }
      zetStuk(r.st, b.x, b.y, w, 1);
      half(r.st, b.vlieg > 0 ? 0 : b.af);
      r.st.delen[0].tint = spriteVoor(soort).tint;
      if (b.vlieg > 0) {
        // in een boog vanaf de machine naar zijn plek, en hij valt het laatste stuk
        const f = 1 - b.vlieg / G.vliegSec;
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
        voortgang(blokVan(b), b.af, soort.work, b.nodig, soort.cost);
        if (b.graaft && Math.sin(t * 40 + b.id) > 0) for (const d of r.st.delen) d.y -= PIXEL;
        if (b.graaft && Math.random() < sec * 6) {
          const p = iso(b.x + 0.5 + (Math.random() - 0.5), b.y + 0.5 + (Math.random() - 0.5));
          deeltjes.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60, leeft: 0.5, kleur: 0x4a443d, maat: PIXEL });
        }
        if (b.id === gekozen) balken.poly(ruitPad(b.x, b.y, w, w)).stroke({ width: PIXEL, color: 0x4ef2ff, alpha: 0.4 + 0.3 * Math.sin(t * 5) });
      }
      r.vloog = b.vlieg > 0;
      lasten(b, w);
    }
    const metVoet = new Set(makers(ind).map((b) => b.id));
    for (const [id, l] of voorVoet) if (!metVoet.has(id)) { l.forEach((x) => beeld.weg(x)); voorVoet.delete(id); }

    // banden en wat erop ligt
    for (const [k, r] of banden) if (!ind.banden.has(k)) { beeld.weg(r.st); if (r.last) beeld.weg(r.last); banden.delete(k); }
    for (const [k, b] of ind.banden) {
      let r = banden.get(k);
      if (!r) {
        r = { st: beeld.maak(spriteVoor(soortVan(b)).naam), last: null };
        banden.set(k, r);
      }
      const kol = b.naar === 'O' || b.naar === 'W';
      zetStuk(r.st, b.x, b.y, 1, kol ? 1 : -1, (b.x + b.y) * 10 - 5);
      half(r.st, b.af);
      r.st.delen[0].tint = spriteVoor(soortVan(b)).tint;
      if (b.goed) {
        const p = stukVoor(b.goed, 'last');
        if (!r.last) r.last = beeld.maak(p.naam, true);
        zetNaam(r.last, p);
        toon(r.last, true);
        const [dx, dy] = RICHTINGEN[b.naar];
        const f = Math.min(1, b.voortgang) - 0.5;
        zetDing(r.last, b.x + dx * f, b.y + dy * f, (b.x + b.y) * 10 + 2);
        for (const d of r.last.delen) d.y -= 4 * PIXEL;
      } else if (r.last) toon(r.last, false);
    }

    // De opslag in beeld: een klein bergje per goed op het erf, de rest op de magazijnen (om de beurt gevuld).
    // Een berg groeit laag voor laag (4 onderop, dan 3, 2 en 1). Elke hoop is G.hoop stuks.
    const LAGEN: [number, number, number][] = [
      [-0.22, -0.22, 0], [0.22, -0.22, 0], [-0.22, 0.22, 0], [0.22, 0.22, 0],
      [0, -0.2, 1], [-0.2, 0.1, 1], [0.15, 0.15, 1], [-0.05, -0.05, 2], [0.12, 0.08, 2], [0.03, 0.03, 3],
    ];
    let n = 0;
    const berg = (g: Goed, bx: number, by: number, aantal: number, vanaf = 0) => {
      for (let j = 0; j < aantal; j++) {
        const [dx, dy, laag] = LAGEN[vanaf + j];
        const p = stukVoor(g, 'hoop');
        let st = hopen[n];
        if (!st) st = hopen[n] = beeld.maak(p.naam, true);
        zetNaam(st, p);
        toon(st, true);
        zetDing(st, bx + dx, by + dy, Math.floor(bx + by) * 10 + 4 + laag);
        for (const d of st.delen) d.y -= laag * 5 * PIXEL;
        n++;
      }
    };
    const plekken = magazijnen(ind).filter((p) => !p.af).map((p) => {
      const m = soortVan(p).size;
      return { x: p.x + (m - 1) / 2, y: p.y + (m - 1) / 2, max: m === 1 ? 4 : LAGEN.length };
    });
    let pi = 0, opPlek = 0;
    const inVoorraad = [...new Set([...goederen(), ...Object.keys(s.voorraad)])].filter((g) => (s.voorraad[g] ?? 0) > 0);
    for (const [gi, g] of inVoorraad.entries()) {
      let rest = Math.ceil((s.voorraad[g] ?? 0) / G.hoop - 0.01);
      if (gi < 5) {
        const opErf = Math.min(rest, 4);
        rest -= opErf;
        berg(g, V.erf.x + [0.05, 0.5, 0.95, 0.95, 0.05][gi], V.erf.y + [0.95, 0.5, 0.05, 0.95, 0.05][gi], opErf);
      }
      while (rest > 0 && pi < plekken.length) {
        const p = plekken[pi], hier = Math.min(rest, p.max - opPlek);
        berg(g, p.x, p.y, hier, opPlek);
        rest -= hier;
        opPlek += hier;
        if (opPlek >= p.max) {
          pi++;
          opPlek = 0;
        }
      }
    }
    for (let i = n; i < hopen.length; i++) toon(hopen[i], false);

    // kabels: machine -> palen -> palen, en van de dichtstbijzijnde paal naar wat stroom krijgt
    kabels.clear();
    kabelGloed.clear();
    const m = midden(s.kaart.machine);
    const hub = (() => { const p = iso(m.x, m.y); return { x: p.x, y: p.y - 150 }; })();
    const net = aangesloten(s);
    const palen = allePalen(ind).filter((p) => !p.af);
    // boom: elke aangesloten paal hangt aan de dichtstbijzijnde die dichter bij de machine staat
    for (const p of palen) {
      const pt = paalTop(p.x, p.y), link = soortVan(p).link;
      if (!net.has(p.id)) {
        if (Math.sin(t * 6) > 0) kabelGloed.rect(pt.x - PIXEL, pt.y - 16, PIXEL * 2, PIXEL * 2).fill(0xff2a3a);
        continue;
      }
      const dm = Math.hypot(p.x - m.x, p.y - m.y);
      let van = dm <= link ? hub : null, best = dm <= link ? dm : Infinity;
      for (const q of palen) {
        if (q === p || !net.has(q.id)) continue;
        const dq = Math.hypot(q.x - m.x, q.y - m.y), d = Math.hypot(q.x - p.x, q.y - p.y);
        if (dq < dm && d <= link && d < best) [van, best] = [paalTop(q.x, q.y), d];
      }
      if (van) kabel(van, pt, p.id, krijgt > 0);
    }
    const voed = (b: Blok, id: number) => {
      const c = midden(b);
      const doel = (() => { const p = iso(c.x, c.y); return { x: p.x, y: p.y - 40 }; })();
      if (Math.hypot(c.x - m.x, c.y - m.y) <= G.machineBereik) return kabel(hub, doel, id, krijgt > 0);
      let van = null as null | { x: number; y: number }, bd = Infinity;
      for (const p of palen) {
        const d = Math.hypot(p.x - c.x, p.y - c.y);
        if (net.has(p.id) && d <= soortVan(p).reach && d < bd) [van, bd] = [paalTop(p.x, p.y), d];
      }
      if (van) kabel(van, doel, id, krijgt > 0);
    };
    for (const b of makers(ind)) if (!b.vlieg && soortVan(b).kW > 0) voed(blokVan(b), b.id);
    for (const b of e.bronnen) {
      const c = midden(V.bronnen[b.id]);
      const p = iso(c.x, c.y);
      kabel({ x: p.x, y: p.y - 60 }, hub, 900 + b.id.length, b.levert > 0);
    }
    // generatoren: een kabel naar de machine, met stroompulsjes als ze stoken
    for (const g of makers(ind)) if (soortVan(g).generator && !g.af) {
      const c = midden(blokVan(g)), p = iso(c.x, c.y);
      kabel({ x: p.x, y: p.y - 60 }, hub, 700 + g.id, g.betaald && !g.geblokt);
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
    const soort = modusSoort();
    const band = soort?.aard === 'belt';
    if (band || modus === 'sloop') for (const b of ind.banden.values()) pijl(b.x, b.y, b.naar, 0xffd23f);
    if (soort && (soort.aard === 'pole' || soort.kW > 0) && !band) {
      // waar is stroom: het bereik van de machine en van elke aangesloten paal
      const net = aangesloten(s);
      const m = midden(s.kaart.machine);
      cirkel(m.x, m.y, G.machineBereik, 0x9dff2e);
      for (const p of allePalen(ind)) if (net.has(p.id)) cirkel(p.x, p.y, soortVan(p).reach, 0x9dff2e);
    }
    if (!muis) return;
    const { kol, rij } = muis;
    if (soort && !band) {
      const o = kanZetten(s, soort, kol, rij);
      melding = o;
      const kleur = o.ok ? 0x9dff2e : 0xff2a3a;
      const naam = spriteVoor(soort).naam, w = soort.size;
      if (!geestStuk || geestStuk.naam !== naam) {
        if (geestStuk) beeld.weg(geestStuk);
        geestStuk = beeld.maak(naam);
      }
      toon(geestStuk, true);
      zetStuk(geestStuk, kol, rij, w, 1, 99998);
      geestStuk.delen.forEach((d) => (d.alpha = 0.55));
      geestStuk.delen[0].tint = kleur;
      geest.poly(ruitPad(kol, rij, w, w)).fill({ color: kleur, alpha: 0.18 }).stroke({ width: PIXEL, color: kleur, alpha: 0.8 });
      if (soort.onDeposit) {
        geest.poly(ruitPad(kol - soort.range, rij - soort.range, w + 2 * soort.range, w + 2 * soort.range)).stroke({ width: PIXEL, color: kleur, alpha: 0.45 });
        for (const a of bereikVan(s, soort, kol, rij)) geest.poly(ruitPad(a.x, a.y)).fill({ color: hex(goed(a.goed).color), alpha: 0.3 });
      }
      if (soort.aard === 'pole') cirkel(kol, rij, soort.reach, kleur);
      tekenPoorten(geest, poortenVan(soort, soort.recipes.length === 1 ? actieveEconomie().recepten.get(soort.recipes[0]) : undefined, kol, rij), true);
      return;
    }
    const p = pad(sleep ?? muis, muis);
    const nieuw = p.filter((q) => kanBandOp(s, q.x, q.y) && !ind.banden.has(tegel(q.x, q.y))).length;
    for (const q of p) {
      const kan = modus === 'sloop' || kanBandOp(s, q.x, q.y);
      const kleur = modus === 'sloop' ? 0xff9a1f : kan ? 0x9dff2e : 0xff2a3a;
      geest.poly(ruitPad(q.x, q.y)).fill({ color: kleur, alpha: 0.2 }).stroke({ width: PIXEL, color: kleur, alpha: 0.7 });
      if (band && kan) pijl(q.x, q.y, q.naar, kleur);
    }
    if (band && soort) {
      const ok = kanBetalen(s.voorraad, soort.cost, nieuw);
      melding = { ok, reden: `${nieuw} NEW TILES: ${kostTekst(Object.fromEntries(Object.entries(soort.cost).map(([g, k]) => [g, (k ?? 0) * nieuw])), true)}${ok ? '' : '. NOT ENOUGH IN STOCK YET'}` };
    } else melding = { ok: true, reden: `DEMOLISH ${p.length} TILES` };
  }

  return {
    zicht(aan) {
      menu.zicht(aan);
    },
    werk(sec) {
      t += sec;
      const s = staat();
      if (modus && modus !== 'sloop' && !modusSoort()) modus = null; // andere wereld, andere gebouwen
      tekenWereld(s, sec);
      tekenGeest(s);
      canvas.style.cursor = modus ? 'crosshair' : '';
      menu.werk(sec);
    },
  };
}

