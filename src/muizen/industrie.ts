// Industrie van de muizen: een fabricator die onderdelen maakt, en wat je daarmee neerzet: boren (die de machine
// naast grondstoffen gooit), lompe lopende banden, palen met kabels en een stapel per grondstof.
// Puur regels, geen tekenen en geen Math.random. Getallen in src/data/muizen.ts (MUIZEN_INDUSTRIE).
//
// - Alles moet eerst gemaakt worden in de fabricator (kost grondstof, stroom en muizen die er werken).
// - Neerzetten maakt een bouwplek; muizen bouwen het af (werk.ts). Pas dan doet het iets.
// - Boren en de fabricator draaien alleen op stroom: binnen bereik van de machine of van een aangesloten paal.
// - Een boor graaft uit de tegels rond zijn voet. Zijn brokken gaan op een band die tegen zijn voet ligt,
//   of muizen halen ze op en sjouwen ze weg.
// - De opslag houdt per grondstof een klein beetje; een stapel voor die grondstof houdt veel meer.
// - Bij de stream wordt alles buiten de ring ingepakt: de onderdelen komen terug, je zet ze in de nieuwe wereld opnieuw neer.
import { binnenBlok, binnenRing, type Blok } from '../kern/kaart';
import type { SpelStaat } from '../kern/spel';
import type { Band, Goed, Grondstof, Richting, Trucje, Voorraad } from '../kern/types';
import { energie, log, verbruiker } from './energie';
import { betaal, kanBetalen, kostTekst } from './kosten';

export type Onderdeel = 'boor' | 'band' | 'paal' | 'stapel';
export const ONDERDELEN: Onderdeel[] = ['boor', 'band', 'paal', 'stapel'];

export interface IndustrieGetallen {
  boor: { kW: number; sec: number; buffer: number; bereik: number; vliegSec: number; werk: number };
  band: { kW: number; tegelsPerSec: number; werk: number };
  paal: { link: number; bereik: number; werk: number };
  stapel: { extra: number; werk: number };
  fabricator: { kW: number; ploeg: number };
  maak: Record<Onderdeel, { kosten: Voorraad; sec: number; aantal: number }>;
  start: Record<Onderdeel, number>;
  opslagMax: number;
  hoop: number;
  ploegBouw: number;
}

interface Ding {
  id: number;
  x: number; // tegel linksachter
  y: number;
  af: number; // werk dat nog moet (muis-seconden); 0 = klaar
}
export interface Boor extends Ding {
  vlieg: number; // seconden nog in de lucht (gegooid door de machine); 0 = staat
  klok: number;
  buffer: Grondstof[];
  graaft: boolean;
  uitvoer: number;
}
export type Paal = Ding;
export interface Stapel extends Ding {
  goed: Grondstof;
}
export interface MBand extends Band {
  af: number;
}
export interface Fabricator {
  rij: Onderdeel[]; // wat er gemaakt moet worden, eerste is bezig
  klok: number; // 0..1 van het huidige
  betaald: boolean;
  ploeg: number; // muizen die er nu werken (zet werk.ts)
  geblokt: string; // waarom hij stilstaat ('' = draait)
}
export interface IndustrieStaat {
  boren: Boor[];
  palen: Paal[];
  stapels: Stapel[];
  banden: Map<number, MBand>; // sleutel = tegel(x, y)
  fabricator: Fabricator;
  delen: Record<Onderdeel, number>; // gemaakte onderdelen die klaarliggen
  volGemeld: Partial<Record<Grondstof, boolean>>;
  volgendeId: number;
  net: { tik: number; palen: Set<number> };
}

export const RICHTINGEN: Record<Richting, [number, number]> = { O: [1, 0], W: [-1, 0], Z: [0, 1], N: [0, -1] };
export const GRONDSTOFFEN: Grondstof[] = ['schroot', 'hout', 'kristal'];
export const tegel = (x: number, y: number) => y * 1000 + x;

let G: IndustrieGetallen;
let tik = 0;
const STATEN = new WeakMap<SpelStaat, IndustrieStaat>();
export const getallen = () => G;

export function industrie(s: SpelStaat): IndustrieStaat {
  let i = STATEN.get(s);
  if (!i) {
    const m = s.kaart.machine;
    i = {
      boren: [],
      palen: [{ id: 1, x: m.x - 1, y: m.y + m.diep + 1, af: 0 }], // de mini-paal waarmee je begint
      stapels: [],
      banden: new Map(),
      fabricator: { rij: [], klok: 0, betaald: false, ploeg: 0, geblokt: '' },
      delen: { ...G.start },
      volGemeld: {},
      volgendeId: 2,
      net: { tik: -1, palen: new Set() },
    };
    STATEN.set(s, i);
  }
  return i;
}

// ---- vaste plekken rond de machine ----
export function vast(s: SpelStaat): { erf: Blok; fabricator: Blok; bronnen: Record<string, Blok> } {
  const m = s.kaart.machine, o = s.kaart.opslag;
  return {
    erf: { x: o.x + o.breed, y: o.y, breed: 2, diep: 2 },
    fabricator: { x: m.x + 1, y: m.y + m.diep + 1, breed: 2, diep: 2 },
    bronnen: {
      houtbrander: { x: m.x - 3, y: m.y + 1, breed: 2, diep: 2 },
      dynamo: { x: m.x - 3, y: m.y - 2, breed: 2, diep: 2 },
      reactor: { x: m.x + 1, y: m.y - 3, breed: 2, diep: 2 },
    },
  };
}
const blok2 = (d: Ding): Blok => ({ x: d.x, y: d.y, breed: 2, diep: 2 });
export const boorBlok = blok2;
export const stapelBlok = blok2;
const midden = (b: Blok) => ({ x: b.x + b.breed / 2 - 0.5, y: b.y + b.diep / 2 - 0.5 });

export function opslagMax(s: SpelStaat, g: Grondstof): number {
  return G.opslagMax + industrie(s).stapels.filter((p) => p.goed === g && !p.af).length * G.stapel.extra;
}

// ---- het stroomnet van palen ----
// De machine is de wortel. Een paal hangt eraan als hij binnen `link` van de machine of van een aangesloten paal staat.
export function aangesloten(s: SpelStaat): Set<number> {
  const i = industrie(s);
  if (i.net.tik === tik) return i.net.palen;
  const m = midden(s.kaart.machine);
  const klaar = i.palen.filter((p) => !p.af);
  const in_ = new Set<number>();
  const rij = klaar.filter((p) => Math.hypot(p.x - m.x, p.y - m.y) <= G.paal.link);
  rij.forEach((p) => in_.add(p.id));
  while (rij.length) {
    const p = rij.pop()!;
    for (const q of klaar)
      if (!in_.has(q.id) && Math.hypot(p.x - q.x, p.y - q.y) <= G.paal.link) {
        in_.add(q.id);
        rij.push(q);
      }
  }
  i.net = { tik, palen: in_ };
  return in_;
}
// Krijgt dit blok stroom? Binnen `bereik` van de machine of van een aangesloten paal.
export function gevoed(s: SpelStaat, b: Blok): boolean {
  const c = midden(b);
  const m = midden(s.kaart.machine);
  if (Math.hypot(c.x - m.x, c.y - m.y) <= G.paal.bereik + 2) return true;
  const net = aangesloten(s);
  return industrie(s).palen.some((p) => net.has(p.id) && Math.hypot(p.x - c.x, p.y - c.y) <= G.paal.bereik);
}

// Hoeveel kW de industrie vraagt: wat klaar is en stroom kan krijgen.
export function industrieVraag(s: SpelStaat): number {
  const i = industrie(s);
  let kw = [...i.banden.values()].filter((b) => !b.af).length * G.band.kW;
  kw += i.boren.filter((b) => !b.af && !b.vlieg && gevoed(s, blok2(b))).length * G.boor.kW;
  if (i.fabricator.rij.length && gevoed(s, vast(s).fabricator)) kw += G.fabricator.kW;
  return Math.round(kw * 10) / 10;
}
const kracht = (s: SpelStaat) => verbruiker(s, 'industrie').krijgt;

// ---- wat staat waar ----
export function inOpslag(s: SpelStaat, x: number, y: number, goed?: Goed): boolean {
  if (binnenBlok(s.kaart.opslag, x, y) || binnenBlok(vast(s).erf, x, y)) return true;
  return industrie(s).stapels.some((p) => !p.af && (!goed || p.goed === goed) && binnenBlok(blok2(p), x, y));
}
export const boorOp = (s: SpelStaat, x: number, y: number) => industrie(s).boren.find((b) => binnenBlok(blok2(b), x, y));
const paalOp = (s: SpelStaat, x: number, y: number) => industrie(s).palen.find((p) => p.x === x && p.y === y);
const stapelOp = (s: SpelStaat, x: number, y: number) => industrie(s).stapels.find((p) => binnenBlok(blok2(p), x, y));

function bezet(s: SpelStaat, x: number, y: number): boolean {
  const k = s.kaart;
  if (x < 1 || y < 1 || x >= k.breed - 1 || y >= k.diep - 1) return true;
  const v = vast(s);
  return binnenBlok(k.machine, x, y) || binnenBlok(k.opslag, x, y) || binnenBlok(v.erf, x, y) || binnenBlok(v.fabricator, x, y) ||
    Object.values(v.bronnen).some((b) => binnenBlok(b, x, y)) || !!boorOp(s, x, y) || !!paalOp(s, x, y) || !!stapelOp(s, x, y);
}
const grondstofOp = (s: SpelStaat, x: number, y: number) => s.kaart.afzettingen.some((a) => a.x === x && a.y === y && a.rest > 0);
const vrijVoorBlok = (s: SpelStaat, x: number, y: number, w: number) => {
  for (let dy = 0; dy < w; dy++)
    for (let dx = 0; dx < w; dx++)
      if (bezet(s, x + dx, y + dy) || grondstofOp(s, x + dx, y + dy) || industrie(s).banden.has(tegel(x + dx, y + dy))) return false;
  return true;
};

export function bereikVan(s: SpelStaat, x: number, y: number) {
  const r = G.boor.bereik;
  return s.kaart.afzettingen.filter((a) => a.rest > 0 && a.x >= x - r && a.x <= x + 1 + r && a.y >= y - r && a.y <= y + 1 + r);
}

export interface Oordeel {
  ok: boolean;
  reden: string;
}
const geenDeel = (d: Onderdeel): Oordeel => ({ ok: false, reden: `GEEN ${d.toUpperCase()} KLAAR. MAAK ER EEN IN DE FABRICATOR` });

export function kanZetten(s: SpelStaat, d: Onderdeel, x: number, y: number, goed?: Grondstof): Oordeel {
  const i = industrie(s);
  if (s.onderweg > 0) return { ok: false, reden: 'WACHT TOT DE LANDING' };
  if (d === 'boor') {
    if (!vrijVoorBlok(s, x, y, 2)) return { ok: false, reden: 'HIER KAN HIJ NIET: NAAST HET VELD, NIET EROP' };
    if (!bereikVan(s, x, y).length) return { ok: false, reden: 'GEEN GRONDSTOF BINNEN BEREIK' };
    if (!i.delen.boor) return geenDeel('boor');
    return { ok: true, reden: gevoed(s, blok2({ id: 0, x, y, af: 0 })) ? `BOOR HIER. ${G.boor.kW} KW` : 'BOOR HIER. LET OP: GEEN STROOM, ZET EEN PAAL' };
  }
  if (d === 'stapel') {
    if (!vrijVoorBlok(s, x, y, 2)) return { ok: false, reden: 'HIER STAAT AL IETS' };
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (!binnenRing(s.kaart, x + dx, y + dy)) return { ok: false, reden: 'ALLEEN BINNEN DE RING' };
    if (!i.delen.stapel) return geenDeel('stapel');
    return { ok: true, reden: `STAPEL VOOR ${goed?.toUpperCase()}: +${G.stapel.extra}. R = ANDERE GRONDSTOF` };
  }
  if (d === 'paal') {
    if (!vrijVoorBlok(s, x, y, 1)) return { ok: false, reden: 'HIER STAAT AL IETS' };
    if (!i.delen.paal) return geenDeel('paal');
    const m = midden(s.kaart.machine);
    const net = aangesloten(s);
    const hangt = Math.hypot(x - m.x, y - m.y) <= G.paal.link || i.palen.some((p) => net.has(p.id) && Math.hypot(p.x - x, p.y - y) <= G.paal.link);
    return { ok: true, reden: hangt ? 'PAAL HIER: HANGT AAN HET NET' : `PAAL HIER, MAAR TE VER: HOOGUIT ${G.paal.link} TEGELS TUSSEN PALEN` };
  }
  return { ok: kanBandOp(s, x, y), reden: '' };
}

export function zet(s: SpelStaat, d: Onderdeel, x: number, y: number, goed: Grondstof = 'schroot'): boolean {
  const o = kanZetten(s, d, x, y, goed);
  const e = energie(s);
  if (!o.ok) {
    log(e, o.reden, 'rood');
    return false;
  }
  const i = industrie(s);
  i.delen[d]--;
  const id = i.volgendeId++;
  if (d === 'boor') {
    i.boren.push({ id, x, y, af: G.boor.werk, vlieg: G.boor.vliegSec, klok: 0, buffer: [], graaft: false, uitvoer: 0 });
    log(e, 'BOOR GEGOOID! MUIZEN BOUWEN HEM OP', 'groen');
  } else if (d === 'stapel') {
    i.stapels.push({ id, x, y, af: G.stapel.werk, goed });
    log(e, `STAPEL VOOR ${goed.toUpperCase()} UITGEZET`, 'groen');
  } else if (d === 'paal') {
    i.palen.push({ id, x, y, af: G.paal.werk });
    log(e, 'PAAL UITGEZET', 'groen');
  }
  return true;
}

// Een band leggen langs een pad. Bestaande banden draaien gratis mee; elke nieuwe tegel kost een gemaakt stuk band.
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
    if (i.delen.band <= 0) {
      log(e, 'BANDEN OP: MAAK ER MEER IN DE FABRICATOR', 'rood');
      break;
    }
    i.delen.band--;
    i.banden.set(tegel(p.x, p.y), { x: p.x, y: p.y, naar: p.naar, voortgang: 0, af: G.band.werk });
    nieuw++;
  }
  // Sluit aan: een band die doodloopt naast het begin van dit stuk, draait er vanzelf naartoe.
  const eerste = pad[0];
  if (eerste && i.banden.has(tegel(eerste.x, eerste.y)))
    for (const [r, [dx, dy]] of Object.entries(RICHTINGEN) as [Richting, [number, number]][]) {
      const buur = i.banden.get(tegel(eerste.x - dx, eerste.y - dy));
      if (!buur || pad.some((p) => p.x === buur.x && p.y === buur.y)) continue;
      const [vx, vy] = RICHTINGEN[buur.naar];
      if (!i.banden.has(tegel(buur.x + vx, buur.y + vy)) && !inOpslag(s, buur.x + vx, buur.y + vy)) buur.naar = r;
    }
  if (nieuw) log(e, `${nieuw} TEGELS BAND UITGEZET. MUIZEN LEGGEN ZE`, 'groen');
  return nieuw;
}

// Slopen: het onderdeel komt terug (wat erin zat gaat naar de opslag).
export function sloop(s: SpelStaat, x: number, y: number): boolean {
  const i = industrie(s);
  const band = i.banden.get(tegel(x, y));
  if (band) {
    if (band.goed) s.voorraad[band.goed] = (s.voorraad[band.goed] ?? 0) + 1;
    i.banden.delete(tegel(x, y));
    i.delen.band++;
    return true;
  }
  const b = boorOp(s, x, y);
  if (b) {
    for (const g of b.buffer) s.voorraad[g] = (s.voorraad[g] ?? 0) + 1;
    i.boren.splice(i.boren.indexOf(b), 1);
    i.delen.boor++;
    return true;
  }
  const p = stapelOp(s, x, y);
  if (p) {
    i.stapels.splice(i.stapels.indexOf(p), 1);
    i.delen.stapel++;
    return true;
  }
  const q = paalOp(s, x, y);
  if (q) {
    i.palen.splice(i.palen.indexOf(q), 1);
    i.delen.paal++;
    return true;
  }
  return false;
}

// ---- de fabricator ----
export function maak(s: SpelStaat, d: Onderdeel): void {
  const f = industrie(s).fabricator;
  if (f.rij.length >= 8) return log(energie(s), 'FABRICATOR: WACHTRIJ VOL (8)', 'rood');
  f.rij.push(d);
  log(energie(s), `FABRICATOR: ${d.toUpperCase()} IN DE RIJ (${kostTekst(G.maak[d].kosten)})`, 'cyaan');
}
export function schrap(s: SpelStaat): void {
  const f = industrie(s).fabricator;
  const d = f.rij.pop();
  if (!d) return;
  if (f.rij.length === 0 && f.betaald) {
    for (const [g, n] of Object.entries(G.maak[d].kosten)) s.voorraad[g] = (s.voorraad[g] ?? 0) + (n ?? 0);
    f.betaald = false;
    f.klok = 0;
  }
}
function stapFabricator(s: SpelStaat, sec: number): void {
  const i = industrie(s);
  const f = i.fabricator;
  const d = f.rij[0];
  if (!d) return void (f.geblokt = '');
  const r = G.maak[d];
  if (!f.betaald) {
    if (!kanBetalen(s.voorraad, r.kosten)) return void (f.geblokt = `WACHT OP ${kostTekst(r.kosten)}`);
    betaal(s.voorraad, r.kosten);
    f.betaald = true;
  }
  if (!gevoed(s, vast(s).fabricator) || kracht(s) <= 0) return void (f.geblokt = 'GEEN STROOM');
  if (!f.ploeg) return void (f.geblokt = 'WACHT OP MUIZEN');
  f.geblokt = '';
  f.klok += (sec * kracht(s) * Math.min(1, f.ploeg / G.fabricator.ploeg)) / r.sec;
  if (f.klok >= 1) {
    f.klok = 0;
    f.betaald = false;
    f.rij.shift();
    i.delen[d] += r.aantal;
    log(energie(s), `FABRICATOR: ${r.aantal > 1 ? `${r.aantal}X ` : ''}${d.toUpperCase()} KLAAR`, 'groen');
  }
}

// ---- elke tik ----
function stapIndustrie(s: SpelStaat, sec: number): void {
  const i = industrie(s);
  if (s.onderweg > 0) return; // in het niets staat alles stil
  const v = s.voorraad;

  // opslag vol: wat er meer is valt eraf
  for (const g of GRONDSTOFFEN) {
    const max = opslagMax(s, g);
    if ((v[g] ?? 0) > max) v[g] = max;
    const vol = (v[g] ?? 0) >= max;
    if (vol && !i.volGemeld[g]) log(energie(s), `OPSLAG VOL: ${g.toUpperCase()} ${max}. ZET EEN STAPEL VOOR ${g.toUpperCase()}`, 'rood');
    i.volGemeld[g] = vol;
  }

  stapFabricator(s, sec);

  // boren
  const k = kracht(s);
  for (const b of i.boren) {
    b.graaft = false;
    if (b.vlieg > 0) {
      b.vlieg = Math.max(0, b.vlieg - sec);
      continue;
    }
    if (b.af > 0) continue;
    if (b.buffer.length < G.boor.buffer && k > 0 && gevoed(s, blok2(b))) {
      const bron = bereikVan(s, b.x, b.y);
      if (bron.length) {
        b.graaft = true;
        b.klok += sec * k;
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
  const snel = G.band.tegelsPerSec * k * sec;
  if (snel <= 0) return;
  const volgorde = [...i.banden.values()].filter((t) => t.goed && !t.af).sort((a, b) => afstandTotEind(i, a) - afstandTotEind(i, b));
  for (const t of volgorde) {
    t.voortgang += snel;
    if (t.voortgang < 1) continue;
    const [dx, dy] = RICHTINGEN[t.naar];
    const nx = t.x + dx, ny = t.y + dy;
    const volgende = i.banden.get(tegel(nx, ny));
    const g = t.goed as Grondstof;
    if (volgende && !volgende.af) {
      if (!volgende.goed) {
        volgende.goed = g;
        volgende.voortgang = Math.min(0.5, t.voortgang - 1);
        t.goed = undefined;
        t.voortgang = 0;
      } else t.voortgang = 1;
    } else if (!volgende && inOpslag(s, nx, ny, g) && (v[g] ?? 0) < opslagMax(s, g)) {
      v[g] = (v[g] ?? 0) + 1;
      t.goed = undefined;
      t.voortgang = 0;
    } else t.voortgang = 1; // loopt dood of de opslag is vol: hij staat stil
  }
}

const eindCache = new WeakMap<Band, { n: number; t: number }>();
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

// Ligt er een band tegen de voet van deze boor? Dan hoeven muizen niet te sjouwen.
export function boorHeeftBand(i: IndustrieStaat, b: Boor): boolean {
  return randVan(b).some(([x, y]) => {
    const t = i.banden.get(tegel(x, y));
    return !!t && !t.af;
  });
}
const randVan = (b: Boor): [number, number][] => {
  const r: [number, number][] = [];
  for (let d = 0; d < 2; d++) r.push([b.x + d, b.y - 1], [b.x + 2, b.y + d], [b.x + 1 - d, b.y + 2], [b.x - 1, b.y + 1 - d]);
  return r;
};
function zetOpBand(i: IndustrieStaat, b: Boor): void {
  const rand = randVan(b);
  for (let n = 0; n < rand.length; n++) {
    const k = (b.uitvoer + n) % rand.length;
    const t = i.banden.get(tegel(rand[k][0], rand[k][1]));
    if (!t || t.goed || t.af) continue;
    const [dx, dy] = RICHTINGEN[t.naar];
    if (binnenBlok(blok2(b), t.x + dx, t.y + dy)) continue;
    t.goed = b.buffer.shift() as Goed;
    t.voortgang = 0;
    b.uitvoer = k + 1;
    return;
  }
}

// De stream: alles buiten de ring blijft achter, dus inpakken. De onderdelen komen terug.
function opStream(s: SpelStaat): void {
  const i = industrie(s);
  const k = s.kaart;
  let n = 0;
  i.boren = i.boren.filter((b) => {
    if (binnenRing(k, b.x + 0.5, b.y + 0.5)) return true;
    for (const g of b.buffer) s.voorraad[g] = (s.voorraad[g] ?? 0) + 1;
    i.delen.boor++;
    n++;
    return false;
  });
  i.palen = i.palen.filter((p) => {
    if (binnenRing(k, p.x, p.y)) return true;
    i.delen.paal++;
    n++;
    return false;
  });
  for (const [sleutel, t] of i.banden) {
    if (binnenRing(k, t.x, t.y)) continue;
    if (t.goed) s.voorraad[t.goed] = (s.voorraad[t.goed] ?? 0) + 1;
    i.banden.delete(sleutel);
    i.delen.band++;
    n++;
  }
  if (n) log(energie(s), `INGEPAKT: ${n} ONDERDELEN. ZET ZE OPNIEUW NEER`, 'cyaan');
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

// voor werk.ts en het beeld
export { blok2, midden };
