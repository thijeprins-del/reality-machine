// Industrie van de muizen: boren die je naast grondstoffen gooit, lompe lopende banden, en een opslag die vol kan raken.
// Puur regels, geen tekenen en geen Math.random. Getallen in src/data/muizen.ts (MUIZEN_INDUSTRIE).
//
// - Een boor (2x2) graaft uit de grondstoffen die rond zijn voet liggen en zet brokken op een band die eraan grenst.
// - Een band schuift één brok per tegel door. Loopt hij de opslag of een stapelplaats in, dan komt het in de voorraad.
// - Boren en banden vragen stroom (verbruiker INDUSTRIE in het stroomnet). Tekort = alles trager.
// - De opslag houdt per grondstof een maximum; stapelplaatsen (binnen de ring) maken het meer. Vol = de band staat stil.
// - Bij de stream wordt alles buiten de ring ingepakt: je krijgt de bouwkosten terug en gooit het in de nieuwe wereld opnieuw.
import { binnenBlok, binnenRing, type Blok } from '../kern/kaart';
import type { SpelStaat } from '../kern/spel';
import type { Band, Goed, Grondstof, Richting, Trucje, Voorraad } from '../kern/types';
import { energie, log } from './energie';
import { betaal, kanBetalen, kostTekst, terug } from './kosten';

export interface IndustrieGetallen {
  boor: { kosten: Voorraad; kW: number; sec: number; buffer: number; bereik: number; vliegSec: number };
  band: { kosten: Voorraad; kW: number; tegelsPerSec: number };
  stapel: { kosten: Voorraad; extra: number };
  opslagMax: number;
  hoop: number;
}

export interface Boor {
  id: number;
  x: number; // tegel linksachter van de 2x2 voet
  y: number;
  vlieg: number; // seconden nog in de lucht (gegooid door de machine); 0 = staat
  klok: number;
  buffer: Grondstof[];
  graaft: boolean; // was hij deze tik aan het graven (voor het beeld)
  uitvoer: number; // welke band hij het laatst bediende
}
export interface Stapel {
  x: number;
  y: number;
}
export interface IndustrieStaat {
  boren: Boor[];
  banden: Map<number, Band>; // sleutel = tegel(x, y)
  stapels: Stapel[];
  volGemeld: Partial<Record<Grondstof, boolean>>;
  volgendeId: number;
}

export const RICHTINGEN: Record<Richting, [number, number]> = { O: [1, 0], W: [-1, 0], Z: [0, 1], N: [0, -1] };
export const GRONDSTOFFEN: Grondstof[] = ['schroot', 'hout', 'kristal'];
export const tegel = (x: number, y: number) => y * 1000 + x;

let G: IndustrieGetallen;
const STATEN = new WeakMap<SpelStaat, IndustrieStaat>();

export function getallen(): IndustrieGetallen {
  return G;
}

export function industrie(s: SpelStaat): IndustrieStaat {
  let i = STATEN.get(s);
  if (!i) {
    i = { boren: [], banden: new Map(), stapels: [], volGemeld: {}, volgendeId: 1 };
    STATEN.set(s, i);
  }
  return i;
}

// Het erf naast de opslag: daar liggen de hopen van de basisopslag.
export function erf(s: SpelStaat): Blok {
  const o = s.kaart.opslag;
  return { x: o.x + o.breed, y: o.y, breed: 2, diep: 2 };
}
export const stapelBlok = (p: Stapel): Blok => ({ x: p.x, y: p.y, breed: 2, diep: 2 });
export const boorBlok = (b: Boor): Blok => ({ x: b.x, y: b.y, breed: 2, diep: 2 });

export function opslagMax(s: SpelStaat): number {
  return G.opslagMax + industrie(s).stapels.length * G.stapel.extra;
}

// Hoeveel kW de industrie vraagt (de verbruiker INDUSTRIE in het stroomnet).
export function industrieVraag(s: SpelStaat): number {
  const i = industrie(s);
  const kw = i.boren.length * G.boor.kW + i.banden.size * G.band.kW;
  return Math.round(kw * 10) / 10;
}
const krijgt = (s: SpelStaat) => energie(s).verbruikers.find((c) => c.id === 'industrie')?.krijgt ?? 0;

// ---- wat staat waar ----
function inOpslag(s: SpelStaat, x: number, y: number): boolean {
  return binnenBlok(s.kaart.opslag, x, y) || binnenBlok(erf(s), x, y) || industrie(s).stapels.some((p) => binnenBlok(stapelBlok(p), x, y));
}
export function boorOp(s: SpelStaat, x: number, y: number): Boor | undefined {
  return industrie(s).boren.find((b) => binnenBlok(boorBlok(b), x, y));
}
// Vaste dingen op een tegel (geen band): machine, opslag, erf, stapelplaats, boor.
function bezet(s: SpelStaat, x: number, y: number): boolean {
  const k = s.kaart;
  if (x < 1 || y < 1 || x >= k.breed - 1 || y >= k.diep - 1) return true;
  return binnenBlok(k.machine, x, y) || inOpslag(s, x, y) || !!boorOp(s, x, y);
}
const grondstofOp = (s: SpelStaat, x: number, y: number) => s.kaart.afzettingen.some((a) => a.x === x && a.y === y && a.rest > 0);

// Grondstoffen die een boor op (x, y) kan halen: de tegels rond zijn voet.
export function bereikVan(s: SpelStaat, x: number, y: number) {
  const r = G.boor.bereik;
  return s.kaart.afzettingen.filter((a) => a.rest > 0 && a.x >= x - r && a.x <= x + 1 + r && a.y >= y - r && a.y <= y + 1 + r);
}

export interface Oordeel {
  ok: boolean;
  reden: string;
}

export function kanBoor(s: SpelStaat, x: number, y: number): Oordeel {
  if (s.onderweg > 0) return { ok: false, reden: 'WACHT TOT DE LANDING' };
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    if (bezet(s, x + dx, y + dy)) return { ok: false, reden: 'HIER STAAT AL IETS' };
    if (grondstofOp(s, x + dx, y + dy)) return { ok: false, reden: 'NAAST HET VELD, NIET EROP' };
    if (industrie(s).banden.has(tegel(x + dx, y + dy))) return { ok: false, reden: 'HIER LIGT EEN BAND' };
  }
  if (!bereikVan(s, x, y).length) return { ok: false, reden: 'GEEN GRONDSTOF BINNEN BEREIK' };
  if (!kanBetalen(s.voorraad, G.boor.kosten)) return { ok: false, reden: `BOOR KOST ${kostTekst(G.boor.kosten)}` };
  return { ok: true, reden: `BOOR ${kostTekst(G.boor.kosten)}: ${G.boor.kW} KW` };
}

export function bouwBoor(s: SpelStaat, x: number, y: number): boolean {
  const o = kanBoor(s, x, y);
  const e = energie(s);
  if (!o.ok) {
    log(e, o.reden, 'rood');
    return false;
  }
  betaal(s.voorraad, G.boor.kosten);
  const i = industrie(s);
  i.boren.push({ id: i.volgendeId++, x, y, vlieg: G.boor.vliegSec, klok: 0, buffer: [], graaft: false, uitvoer: 0 });
  log(e, 'BOOR GEGOOID! LEG EEN BAND NAAR DE OPSLAG (L)', 'groen');
  return true;
}

export function kanStapel(s: SpelStaat, x: number, y: number): Oordeel {
  if (s.onderweg > 0) return { ok: false, reden: 'WACHT TOT DE LANDING' };
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    if (bezet(s, x + dx, y + dy) || industrie(s).banden.has(tegel(x + dx, y + dy))) return { ok: false, reden: 'HIER STAAT AL IETS' };
    if (!binnenRing(s.kaart, x + dx, y + dy)) return { ok: false, reden: 'ALLEEN BINNEN DE RING' };
  }
  if (!kanBetalen(s.voorraad, G.stapel.kosten)) return { ok: false, reden: `STAPELPLAATS KOST ${kostTekst(G.stapel.kosten)}` };
  return { ok: true, reden: `STAPELPLAATS ${kostTekst(G.stapel.kosten)}: +${G.stapel.extra} PER GRONDSTOF` };
}

export function bouwStapel(s: SpelStaat, x: number, y: number): boolean {
  const o = kanStapel(s, x, y);
  const e = energie(s);
  if (!o.ok) {
    log(e, o.reden, 'rood');
    return false;
  }
  betaal(s.voorraad, G.stapel.kosten);
  industrie(s).stapels.push({ x, y });
  industrie(s).volGemeld = {};
  log(e, `STAPELPLAATS KLAAR: OPSLAG ${opslagMax(s)} PER GRONDSTOF`, 'groen');
  return true;
}

// Een band leggen langs een pad. Bestaande banden draaien gratis mee; nieuwe kosten schroot.
export function kanBandOp(s: SpelStaat, x: number, y: number): boolean {
  return !bezet(s, x, y) && !grondstofOp(s, x, y);
}
export function legBand(s: SpelStaat, pad: { x: number; y: number; naar: Richting }[]): number {
  const i = industrie(s);
  const e = energie(s);
  let nieuw = 0;
  for (const p of pad) {
    if (!kanBandOp(s, p.x, p.y)) continue;
    const oud = i.banden.get(tegel(p.x, p.y));
    if (oud) {
      oud.naar = p.naar;
      continue;
    }
    if (!betaal(s.voorraad, G.band.kosten)) {
      log(e, `SCHROOT OP: BAND KOST ${kostTekst(G.band.kosten)} PER TEGEL`, 'rood');
      break;
    }
    i.banden.set(tegel(p.x, p.y), { x: p.x, y: p.y, naar: p.naar, voortgang: 0 });
    nieuw++;
  }
  // Sluit aan: een band die doodloopt naast het begin van dit stuk, draait er vanzelf naartoe.
  const eerste = pad[0];
  if (eerste && i.banden.has(tegel(eerste.x, eerste.y)))
    for (const [r, [dx, dy]] of Object.entries(RICHTINGEN) as [Richting, [number, number]][]) {
      const buur = i.banden.get(tegel(eerste.x - dx, eerste.y - dy));
      if (!buur || pad.some((p) => p.x === buur.x && p.y === buur.y)) continue;
      const [vx, vy] = RICHTINGEN[buur.naar];
      const doel = [buur.x + vx, buur.y + vy];
      if (!i.banden.has(tegel(doel[0], doel[1])) && !inOpslag(s, doel[0], doel[1])) buur.naar = r;
    }
  if (nieuw) log(e, `${nieuw} TEGELS BAND GELEGD`, 'groen');
  return nieuw;
}

// Slopen: alles terug in de opslag.
export function sloop(s: SpelStaat, x: number, y: number): boolean {
  const i = industrie(s);
  const e = energie(s);
  const band = i.banden.get(tegel(x, y));
  if (band) {
    if (band.goed) s.voorraad[band.goed] = (s.voorraad[band.goed] ?? 0) + 1;
    terug(s.voorraad, G.band.kosten);
    i.banden.delete(tegel(x, y));
    return true;
  }
  const b = boorOp(s, x, y);
  if (b) {
    for (const g of b.buffer) s.voorraad[g] = (s.voorraad[g] ?? 0) + 1;
    terug(s.voorraad, G.boor.kosten);
    i.boren.splice(i.boren.indexOf(b), 1);
    log(e, 'BOOR AFGEBROKEN', 'amber');
    return true;
  }
  const p = i.stapels.find((q) => binnenBlok(stapelBlok(q), x, y));
  if (p) {
    terug(s.voorraad, G.stapel.kosten);
    i.stapels.splice(i.stapels.indexOf(p), 1);
    log(e, 'STAPELPLAATS AFGEBROKEN', 'amber');
    return true;
  }
  return false;
}

// ---- elke tik ----
function stapIndustrie(s: SpelStaat, sec: number): void {
  const i = industrie(s);
  if (s.onderweg > 0) return; // in het niets staat alles stil
  const kracht = krijgt(s);
  const max = opslagMax(s);
  const v = s.voorraad;

  // opslag vol: wat er meer is valt eraf (de muizen gooien het op de grond)
  for (const g of GRONDSTOFFEN) {
    if ((v[g] ?? 0) > max) v[g] = max;
    const vol = (v[g] ?? 0) >= max;
    if (vol && !i.volGemeld[g]) log(energie(s), `OPSLAG VOL: ${g.toUpperCase()} ${max}. BOUW EEN STAPELPLAATS (O)`, 'rood');
    i.volGemeld[g] = vol;
  }

  // boren
  for (const b of i.boren) {
    b.graaft = false;
    if (b.vlieg > 0) {
      b.vlieg = Math.max(0, b.vlieg - sec);
      continue;
    }
    if (b.buffer.length < G.boor.buffer && kracht > 0) {
      const bron = bereikVan(s, b.x, b.y);
      if (bron.length) {
        b.graaft = true;
        b.klok += sec * kracht;
        if (b.klok >= G.boor.sec) {
          b.klok -= G.boor.sec;
          const a = bron[b.id % bron.length];
          a.rest -= 1;
          b.buffer.push(a.goed);
        }
      }
    }
    if (b.buffer.length) zetOpBand(i, b);
  }

  // banden: van voor naar achter, zodat een volle rij in één tik doorschuift
  const snel = G.band.tegelsPerSec * kracht * sec;
  if (snel <= 0) return;
  const volgorde = [...i.banden.values()].filter((t) => t.goed).sort((a, b) => afstandTotEind(i, a) - afstandTotEind(i, b));
  for (const t of volgorde) {
    t.voortgang += snel;
    if (t.voortgang < 1) continue;
    const [dx, dy] = RICHTINGEN[t.naar];
    const nx = t.x + dx, ny = t.y + dy;
    const volgende = i.banden.get(tegel(nx, ny));
    if (volgende) {
      if (!volgende.goed) {
        volgende.goed = t.goed;
        volgende.voortgang = Math.min(0.5, t.voortgang - 1);
        t.goed = undefined;
        t.voortgang = 0;
      } else t.voortgang = 1;
    } else if (inOpslag(s, nx, ny) && (v[t.goed!] ?? 0) < max) {
      v[t.goed!] = (v[t.goed!] ?? 0) + 1;
      t.goed = undefined;
      t.voortgang = 0;
    } else t.voortgang = 1; // loopt dood of de opslag is vol: hij staat stil
  }
}

// Hoe ver een band nog loopt tot hij ophoudt (tot 60 tegels), om de volgorde te bepalen.
const eindCache = new WeakMap<Band, { n: number; t: number }>();
let tik = 0;
function afstandTotEind(i: IndustrieStaat, t: Band): number {
  const c = eindCache.get(t);
  if (c && c.t === tik) return c.n;
  let n = 0, x = t.x, y = t.y, naar = t.naar;
  while (n < 60) {
    const [dx, dy] = RICHTINGEN[naar];
    const v = i.banden.get(tegel(x + dx, y + dy));
    if (!v) break;
    x = v.x;
    y = v.y;
    naar = v.naar;
    n++;
  }
  eindCache.set(t, { n, t: tik });
  return n;
}

// Een boor zet een brok op een lege band die tegen zijn voet ligt en er niet naartoe wijst.
function zetOpBand(i: IndustrieStaat, b: Boor): void {
  const rand: [number, number][] = [];
  for (let d = 0; d < 2; d++) rand.push([b.x + d, b.y - 1], [b.x + 2, b.y + d], [b.x + 1 - d, b.y + 2], [b.x - 1, b.y + 1 - d]);
  for (let n = 0; n < rand.length; n++) {
    const k = (b.uitvoer + n) % rand.length;
    const t = i.banden.get(tegel(rand[k][0], rand[k][1]));
    if (!t || t.goed) continue;
    const [dx, dy] = RICHTINGEN[t.naar];
    if (binnenBlok(boorBlok(b), t.x + dx, t.y + dy)) continue;
    t.goed = b.buffer.shift() as Goed;
    t.voortgang = 0;
    b.uitvoer = k + 1;
    return;
  }
}

// De stream: alles buiten de ring blijft achter, dus inpakken en terug in de opslag.
function opStream(s: SpelStaat): void {
  const i = industrie(s);
  const k = s.kaart;
  let boren = 0, banden = 0;
  i.boren = i.boren.filter((b) => {
    if (binnenRing(k, b.x + 0.5, b.y + 0.5)) return true;
    for (const g of b.buffer) s.voorraad[g] = (s.voorraad[g] ?? 0) + 1;
    terug(s.voorraad, G.boor.kosten);
    boren++;
    return false;
  });
  for (const [sleutel, t] of i.banden) {
    if (binnenRing(k, t.x, t.y)) continue;
    if (t.goed) s.voorraad[t.goed] = (s.voorraad[t.goed] ?? 0) + 1;
    terug(s.voorraad, G.band.kosten);
    i.banden.delete(sleutel);
    banden++;
  }
  if (boren || banden) log(energie(s), `INGEPAKT: ${boren} BOREN, ${banden} BAND. GOOI ZE OPNIEUW`, 'cyaan');
}

export function industrieTrucje(getallen: IndustrieGetallen): Trucje {
  G = getallen;
  return {
    naam: 'Industrie',
    opTik: (s, sec) => {
      tik++;
      stapIndustrie(s, sec);
    },
    opStream,
  };
}
