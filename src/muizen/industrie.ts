// Industrie van de muizen: fabricators die onderdelen maken (platen, balken), en wat je daarmee neerzet: boren (die de
// machine naast grondstoffen gooit), lompe lopende banden, palen met kabels en een stapel per grondstof.
// Puur regels, geen tekenen en geen Math.random. Getallen in src/data/muizen.ts (MUIZEN_INDUSTRIE).
//
// - Bouwen kost onderdelen; muizen halen ze uit de opslag en brengen ze naar de bouwplek, pas dan bouwen ze.
//   Een fabricator krijgt zijn grondstof ook gebracht (muizen of een band die erin loopt).
// - Onderdelen Die maak je in een fabricator (zelf ook te bouwen): klik erop en kies een
//   recept. Hij vraagt grondstof, stroom en muizen; wat eruit komt gaat op een band of muizen brengen het naar de opslag.
// - Neerzetten maakt een bouwplek; muizen bouwen het af (werk.ts). Pas dan doet het iets.
// - Boren en de fabricator draaien alleen op stroom: binnen bereik van de machine of van een aangesloten paal.
// - Een boor graaft uit de tegels rond zijn voet. Zijn brokken gaan op een band die tegen zijn voet ligt,
//   of muizen halen ze op en sjouwen ze weg.
// - De opslag houdt per grondstof een klein beetje; een stapel voor die grondstof houdt veel meer.
// - Bij de stream wordt alles buiten de ring ingepakt: de bouwkosten komen terug.
import { binnenBlok, binnenRing, type Blok } from '../kern/kaart';
import type { SpelStaat } from '../kern/spel';
import type { Band, Goed, Grondstof, Richting, Trucje, Voorraad } from '../kern/types';
import { energie, log, verbruiker } from './energie';
import { betaal, kanBetalen, kostTekst, naamVan, terug } from './kosten';

export type Bouwsel = 'fabricator' | 'boor' | 'band' | 'paal' | 'stapel' | 'kist'; // kist = kleine stapel van 1 tegel
export const BOUWSELS: Bouwsel[] = ['fabricator', 'boor', 'band', 'paal', 'stapel', 'kist'];
export type Deel = 'plaat' | 'balk';
export const DELEN: Deel[] = ['plaat', 'balk'];

export interface IndustrieGetallen {
  boor: { kW: number; sec: number; buffer: number; bereik: number; vliegSec: number; werk: number };
  band: { kW: number; tegelsPerSec: number; werk: number };
  paal: { link: number; bereik: number; werk: number };
  stapel: { extra: number; werk: number; klein: { extra: number; werk: number } };
  fabricator: { kW: number; ploeg: number; buffer: number; werk: number };
  bouw: Record<Bouwsel, Voorraad>;
  recepten: Record<Deel, { in: Voorraad; uit: number; sec: number }>;
  opslagMax: number;
  hoop: number;
  ploegBouw: number;
}

interface Ding {
  id: number;
  x: number; // tegel linksachter
  y: number;
  af: number; // werk dat nog moet (muis-seconden); 0 = klaar
  nodig: Voorraad; // bouwspullen die muizen nog moeten brengen; pas als dit leeg is kan er gebouwd worden
}
// Iets met een uitgang: boor en fabricator. Wat erin ligt gaat op een band tegen de voet, of muizen halen het.
export interface Maker extends Ding {
  buffer: Goed[];
  uitvoer: number;
}
export interface Boor extends Maker {
  vlieg: number; // seconden nog in de lucht (gegooid door de machine); 0 = staat
  klok: number;
  graaft: boolean;
}
export interface Fabriek extends Maker {
  recept: Deel | null;
  invoer: Voorraad; // gebrachte grondstof (door muizen of over een band)
  klok: number; // 0..1 van het huidige stuk
  betaald: boolean;
  ploeg: number; // muizen die er nu werken (zet werk.ts)
  geblokt: string; // waarom hij stilstaat ('' = draait)
}
export type Paal = Ding;
export interface Stapel extends Ding {
  goed: Goed; // wat erin komt (instelbaar: klik erop)
  maat: 1 | 2; // 1 tegel of 2x2
  prio: 0 | 1 | 2; // LOW, NORMAL, HIGH: muizen brengen eerst naar een hoge prio, en daar vult hij zich eerst
}
export interface MBand extends Band {
  af: number;
  nodig: Voorraad;
}
// Is alles gebracht? En wat is er al gebracht (voor slopen en inpakken)?
export const leeg = (v: Voorraad) => !Object.values(v).some((n) => (n ?? 0) > 0);
export function gebracht(d: Bouwsel, nodig: Voorraad): Voorraad {
  const uit: Voorraad = {};
  for (const [g, n] of Object.entries(G.bouw[d])) uit[g] = (n ?? 0) - (nodig[g] ?? 0);
  return uit;
}
// Hoeveel invoer een fabricator wil hebben liggen: genoeg voor een paar keer.
export const invoerMax = (f: Fabriek, g: Goed) => (f.recept ? (G.recepten[f.recept].in[g] ?? 0) * 3 : 0);
export interface IndustrieStaat {
  boren: Boor[];
  fabrieken: Fabriek[];
  palen: Paal[];
  stapels: Stapel[];
  banden: Map<number, MBand>; // sleutel = tegel(x, y)
  volGemeld: Partial<Record<Goed, boolean>>;
  volgendeId: number;
  net: { tik: number; palen: Set<number> };
}

export const RICHTINGEN: Record<Richting, [number, number]> = { O: [1, 0], W: [-1, 0], Z: [0, 1], N: [0, -1] };
export const GRONDSTOFFEN: Grondstof[] = ['schroot', 'hout', 'kristal'];
export const GOEDEREN: Goed[] = [...GRONDSTOFFEN, ...DELEN];
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
      fabrieken: [],
      palen: [{ id: 1, x: m.x - 1, y: m.y + m.diep + 1, af: 0, nodig: {} }], // de mini-paal waarmee je begint
      stapels: [],
      banden: new Map(),
      volGemeld: {},
      volgendeId: 2,
      net: { tik: -1, palen: new Set() },
    };
    STATEN.set(s, i);
  }
  return i;
}

// ---- vaste plekken rond de machine ----
export function vast(s: SpelStaat): { erf: Blok; bronnen: Record<string, Blok> } {
  const m = s.kaart.machine, o = s.kaart.opslag;
  return {
    erf: { x: o.x + o.breed, y: o.y, breed: 2, diep: 2 },
    bronnen: {
      rad: { x: m.x - 3, y: m.y + 1, breed: 2, diep: 2 },
      dynamo: { x: m.x - 3, y: m.y - 2, breed: 2, diep: 2 },
      houtbrander: { x: m.x + 1, y: m.y - 3, breed: 2, diep: 2 },
      reactor: { x: m.x + 4, y: m.y - 3, breed: 2, diep: 2 },
    },
  };
}
// Het blok van een ding: 2x2, behalve een kleine stapel (maat 1).
const blok2 = (d: Ding): Blok => {
  const m = (d as Partial<Stapel>).maat ?? 2;
  return { x: d.x, y: d.y, breed: m, diep: m };
};
export const stapelExtra = (p: Stapel) => (p.maat === 1 ? G.stapel.klein.extra : G.stapel.extra);
export const boorBlok = blok2;
export const stapelBlok = blok2;
const midden = (b: Blok) => ({ x: b.x + b.breed / 2 - 0.5, y: b.y + b.diep / 2 - 0.5 });

export function opslagMax(s: SpelStaat, g: Goed): number {
  return G.opslagMax + industrie(s).stapels.filter((p) => p.goed === g && !p.af).reduce((n, p) => n + stapelExtra(p), 0);
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
  kw += i.fabrieken.filter((f) => !f.af && f.recept && gevoed(s, blok2(f))).length * G.fabricator.kW;
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
export const stapelOp = (s: SpelStaat, x: number, y: number) => industrie(s).stapels.find((p) => binnenBlok(blok2(p), x, y));
export const fabriekOp = (s: SpelStaat, x: number, y: number) => industrie(s).fabrieken.find((f) => binnenBlok(blok2(f), x, y));

function bezet(s: SpelStaat, x: number, y: number): boolean {
  const k = s.kaart;
  if (x < 1 || y < 1 || x >= k.breed - 1 || y >= k.diep - 1) return true;
  const v = vast(s);
  return binnenBlok(k.machine, x, y) || binnenBlok(k.opslag, x, y) || binnenBlok(v.erf, x, y) || !!fabriekOp(s, x, y) ||
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
// Neerzetten kan altijd; muizen brengen de spullen zodra ze in de opslag liggen.
const kostOk = (s: SpelStaat, d: Bouwsel): Oordeel | null =>
  kanBetalen(s.voorraad, G.bouw[d]) ? null : { ok: true, reden: `NOT IN STOCK YET: ${kostTekst(G.bouw[d], true)}. MICE BRING IT LATER` };

export function kanZetten(s: SpelStaat, d: Bouwsel, x: number, y: number, goed?: Goed): Oordeel {
  const i = industrie(s);
  if (s.onderweg > 0) return { ok: false, reden: 'WAIT FOR THE LANDING' };
  if (d === 'boor') {
    if (!vrijVoorBlok(s, x, y, 2)) return { ok: false, reden: 'NOT HERE: NEXT TO THE FIELD, NOT ON IT' };
    if (!bereikVan(s, x, y).length) return { ok: false, reden: 'NO RESOURCES IN RANGE' };
    return kostOk(s, d) ?? { ok: true, reden: gevoed(s, blok2({ id: 0, x, y, af: 0, nodig: {} })) ? `DRILL HERE. ${G.boor.kW} KW` : 'DRILL HERE. NO POWER YET: PLACE A POLE' };
  }
  if (d === 'stapel' || d === 'kist' || d === 'fabricator') {
    const w = d === 'kist' ? 1 : 2;
    if (!vrijVoorBlok(s, x, y, w)) return { ok: false, reden: 'SOMETHING IS IN THE WAY' };
    for (let dy = 0; dy < w; dy++) for (let dx = 0; dx < w; dx++) if (!binnenRing(s.kaart, x + dx, y + dy)) return { ok: false, reden: 'ONLY INSIDE THE RING' };
    if (d !== 'fabricator') return kostOk(s, d) ?? { ok: true, reden: `STOCKPILE FOR ${naamVan(goed ?? 'schroot')}: +${d === 'kist' ? G.stapel.klein.extra : G.stapel.extra}. R = OTHER GOODS. CLICK IT LATER TO CHANGE` };
    return kostOk(s, d) ?? { ok: true, reden: gevoed(s, blok2({ id: 0, x, y, af: 0, nodig: {} })) ? `FABRICATOR HERE. ${G.fabricator.kW} KW` : 'FABRICATOR HERE. NO POWER YET: PLACE A POLE' };
  }
  if (d === 'paal') {
    if (!vrijVoorBlok(s, x, y, 1)) return { ok: false, reden: 'SOMETHING IS IN THE WAY' };
    const m = midden(s.kaart.machine);
    const net = aangesloten(s);
    const hangt = Math.hypot(x - m.x, y - m.y) <= G.paal.link || i.palen.some((p) => net.has(p.id) && Math.hypot(p.x - x, p.y - y) <= G.paal.link);
    return kostOk(s, d) ?? { ok: true, reden: hangt ? 'POLE HERE: CONNECTED TO THE GRID' : `POLE HERE, BUT TOO FAR: AT MOST ${G.paal.link} TILES BETWEEN POLES` };
  }
  return { ok: kanBandOp(s, x, y), reden: '' };
}

export function zet(s: SpelStaat, d: Bouwsel, x: number, y: number, goed: Goed = 'schroot'): boolean {
  const o = kanZetten(s, d, x, y, goed);
  const e = energie(s);
  if (!o.ok) {
    log(e, o.reden, 'rood');
    return false;
  }
  const i = industrie(s);
  const id = i.volgendeId++;
  const nodig = { ...G.bouw[d] };
  if (d === 'boor') {
    i.boren.push({ id, x, y, af: G.boor.werk, nodig, vlieg: G.boor.vliegSec, klok: 0, buffer: [], graaft: false, uitvoer: 0 });
    log(e, `DRILL THROWN! MICE BRING ${kostTekst(nodig, true)} AND BUILD IT`, 'groen');
  } else if (d === 'fabricator') {
    i.fabrieken.push({ id, x, y, af: G.fabricator.werk, nodig, buffer: [], uitvoer: 0, recept: null, invoer: {}, klok: 0, betaald: false, ploeg: 0, geblokt: '' });
    log(e, 'FABRICATOR SITE PLACED. CLICK IT TO PICK A RECIPE', 'groen');
  } else if (d === 'stapel' || d === 'kist') {
    const klein = d === 'kist';
    i.stapels.push({ id, x, y, af: klein ? G.stapel.klein.werk : G.stapel.werk, nodig, goed, maat: klein ? 1 : 2, prio: 1 });
    log(e, `STOCKPILE FOR ${naamVan(goed)} PLACED`, 'groen');
  } else if (d === 'paal') {
    i.palen.push({ id, x, y, af: G.paal.werk, nodig });
    log(e, 'POLE PLACED', 'groen');
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
    i.banden.set(tegel(p.x, p.y), { x: p.x, y: p.y, naar: p.naar, voortgang: 0, af: G.band.werk, nodig: { ...G.bouw.band } });
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
  if (nieuw) log(e, `${nieuw} BELT TILES PLACED. MICE ARE LAYING THEM`, 'groen');
  return nieuw;
}

// Slopen: je krijgt de bouwkosten terug (wat erin zat gaat naar de opslag).
export function sloop(s: SpelStaat, x: number, y: number): boolean {
  const i = industrie(s);
  const v = s.voorraad;
  const band = i.banden.get(tegel(x, y));
  if (band) {
    if (band.goed) v[band.goed] = (v[band.goed] ?? 0) + 1;
    i.banden.delete(tegel(x, y));
    terug(v, gebracht('band', band.nodig));
    return true;
  }
  const lijsten: [Bouwsel, Ding[]][] = [['boor', i.boren], ['fabricator', i.fabrieken], ['stapel', i.stapels]];
  for (const [d, lijst] of lijsten) {
    const t = lijst.find((b) => binnenBlok(blok2(b), x, y));
    if (!t) continue;
    for (const g of (t as Maker).buffer ?? []) v[g] = (v[g] ?? 0) + 1;
    const f = t as Fabriek;
    if (d === 'fabricator') {
      if (f.betaald && f.recept) terug(v, G.recepten[f.recept].in);
      terug(v, f.invoer);
    }
    lijst.splice(lijst.indexOf(t), 1);
    terug(v, gebracht(d === 'stapel' && (t as Stapel).maat === 1 ? 'kist' : d, t.nodig));
    return true;
  }
  const q = paalOp(s, x, y);
  if (q) {
    i.palen.splice(i.palen.indexOf(q), 1);
    terug(v, gebracht('paal', q.nodig));
    return true;
  }
  return false;
}

// ---- stapels instellen ----
export const PRIOS = ['LOW', 'NORMAL', 'HIGH'] as const;
export function stapelVoor(s: SpelStaat, p: Stapel, g: Goed): void {
  if (p.goed === g) return;
  const oud = p.goed;
  p.goed = g;
  const max = opslagMax(s, oud);
  if ((s.voorraad[oud] ?? 0) > max) log(energie(s), `NO ROOM: ${Math.ceil((s.voorraad[oud] ?? 0) - max)} ${naamVan(oud)} IS LOST`, 'rood');
  log(energie(s), `STOCKPILE NOW TAKES ${naamVan(g)}`, 'cyaan');
}
export function stapelPrio(s: SpelStaat, p: Stapel, prio: 0 | 1 | 2): void {
  p.prio = prio;
  log(energie(s), `STOCKPILE FOR ${naamVan(p.goed)}: ${PRIOS[prio]} PRIORITY`, 'cyaan');
}
// Volgorde waarin de voorraad van een goed over de plekken verdeeld wordt: hoge prio eerst, dan het erf, dan de rest.
export function stapelVolgorde(s: SpelStaat, g: Goed): (Stapel | 'erf')[] {
  const st = industrie(s).stapels.filter((p) => p.goed === g && !p.af).sort((a, b) => b.prio - a.prio);
  return [...st.filter((p) => p.prio === 2), 'erf', ...st.filter((p) => p.prio < 2)];
}

// ---- fabricators ----
export function kiesRecept(s: SpelStaat, f: Fabriek, r: Deel | null): void {
  if (f.recept === r) return;
  if (f.betaald && f.recept) terug(s.voorraad, G.recepten[f.recept].in);
  // wat er lag en het nieuwe recept niet gebruikt, gaat terug naar de opslag
  for (const [g, n] of Object.entries(f.invoer)) if (!r || !G.recepten[r].in[g]) {
    s.voorraad[g] = (s.voorraad[g] ?? 0) + (n ?? 0);
    delete f.invoer[g];
  }
  f.recept = r;
  f.betaald = false;
  f.klok = 0;
  log(energie(s), r ? `FABRICATOR MAKES ${naamVan(r)} (${kostTekst(G.recepten[r].in, true)})` : 'FABRICATOR STOPPED', 'cyaan');
}
function stapFabrieken(s: SpelStaat, sec: number): void {
  const i = industrie(s);
  const k = kracht(s);
  for (const f of i.fabrieken) {
    if (f.af) continue;
    if (f.buffer.length) zetOpBand(i, f);
    if (!f.recept) {
      f.geblokt = 'PICK A RECIPE';
      continue;
    }
    const r = G.recepten[f.recept];
    if ((s.voorraad[f.recept] ?? 0) >= opslagMax(s, f.recept) && !f.betaald) {
      f.geblokt = 'STOCK FULL';
      continue;
    }
    if (f.buffer.length + r.uit > G.fabricator.buffer) {
      f.geblokt = 'OUTPUT FULL';
      continue;
    }
    if (!f.betaald) {
      if (!betaal(f.invoer, r.in)) {
        f.geblokt = `WAITING FOR ${kostTekst(r.in, true)}`;
        continue;
      }
      f.betaald = true;
    }
    if (!gevoed(s, blok2(f)) || k <= 0) {
      f.geblokt = 'NO POWER';
      continue;
    }
    if (!f.ploeg) {
      f.geblokt = 'WAITING FOR MICE';
      continue;
    }
    f.geblokt = '';
    f.klok += (sec * k * Math.min(1, f.ploeg / G.fabricator.ploeg)) / r.sec;
    if (f.klok >= 1) {
      f.klok = 0;
      f.betaald = false;
      for (let n = 0; n < r.uit; n++) f.buffer.push(f.recept);
    }
  }
}

// ---- elke tik ----
function stapIndustrie(s: SpelStaat, sec: number): void {
  const i = industrie(s);
  if (s.onderweg > 0) return; // in het niets staat alles stil
  const v = s.voorraad;

  // opslag vol: wat er meer is valt eraf
  for (const g of GOEDEREN) {
    const max = opslagMax(s, g);
    if ((v[g] ?? 0) > max) v[g] = max;
    const vol = (v[g] ?? 0) >= max;
    if (vol && !i.volGemeld[g]) log(energie(s), `STOCK FULL: ${naamVan(g)} ${max}${GRONDSTOFFEN.includes(g as Grondstof) ? `. BUILD A STOCKPILE FOR ${naamVan(g)}` : ''}`, 'rood');
    i.volGemeld[g] = vol;
  }

  stapFabrieken(s, sec);
  uitStapels(s);

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
  let fab: Fabriek | undefined;
  for (const t of volgorde) {
    t.voortgang += snel;
    if (t.voortgang < 1) continue;
    const [dx, dy] = RICHTINGEN[t.naar];
    const nx = t.x + dx, ny = t.y + dy;
    const volgende = i.banden.get(tegel(nx, ny));
    const g = t.goed as Goed;
    if (volgende && !volgende.af) {
      if (!volgende.goed) {
        volgende.goed = g;
        volgende.voortgang = Math.min(0.5, t.voortgang - 1);
        t.goed = undefined;
        t.voortgang = 0;
      } else t.voortgang = 1;
    } else if (!volgende && (fab = fabriekOp(s, nx, ny)) && !fab.af && (fab.invoer[g] ?? 0) < invoerMax(fab, g)) {
      fab.invoer[g] = (fab.invoer[g] ?? 0) + 1; // de band loopt de fabricator in
      t.goed = undefined;
      t.voortgang = 0;
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
export function heeftBand(i: IndustrieStaat, b: Maker): boolean {
  return randVan(b).some(([x, y]) => {
    const t = i.banden.get(tegel(x, y));
    return !!t && !t.af;
  });
}
// De tegels rondom een blok (voor banden die ertegenaan liggen), met de klok mee.
const randVan = (b: Ding): [number, number][] => {
  const r: [number, number][] = [];
  const m = blok2(b).breed;
  for (let d = 0; d < m; d++) r.push([b.x + d, b.y - 1], [b.x + m, b.y + d], [b.x + m - 1 - d, b.y + m], [b.x - 1, b.y + m - 1 - d]);
  return r;
};
// Een band naast een stapel trekt er goed uit (als hij er niet in loopt). Zo haal je voorraad weer op een band.
function uitStapels(s: SpelStaat): void {
  const i = industrie(s);
  const v = s.voorraad;
  for (const p of i.stapels) {
    if (p.af) continue;
    for (const [x, y] of randVan(p)) {
      if ((v[p.goed] ?? 0) < 1) break;
      const t = i.banden.get(tegel(x, y));
      if (!t || t.goed || t.af) continue;
      const [dx, dy] = RICHTINGEN[t.naar];
      if (binnenBlok(blok2(p), t.x + dx, t.y + dy) || inOpslag(s, t.x + dx, t.y + dy)) continue; // die loopt erin
      t.goed = p.goed;
      t.voortgang = 0;
      v[p.goed] = (v[p.goed] ?? 0) - 1;
    }
  }
}
function zetOpBand(i: IndustrieStaat, b: Maker): void {
  const rand = randVan(b);
  for (let n = 0; n < rand.length; n++) {
    const k = (b.uitvoer + n) % rand.length;
    const t = i.banden.get(tegel(rand[k][0], rand[k][1]));
    if (!t || t.goed || t.af) continue;
    const [dx, dy] = RICHTINGEN[t.naar];
    if (binnenBlok(blok2(b), t.x + dx, t.y + dy)) continue;
    t.goed = b.buffer.shift();
    t.voortgang = 0;
    b.uitvoer = k + 1;
    return;
  }
}

// De stream: alles buiten de ring blijft achter, dus inpakken. De bouwkosten komen terug.
function opStream(s: SpelStaat): void {
  const i = industrie(s);
  const k = s.kaart;
  const v = s.voorraad;
  let n = 0;
  i.boren = i.boren.filter((b) => {
    if (binnenRing(k, b.x + 0.5, b.y + 0.5)) return true;
    for (const g of b.buffer) v[g] = (v[g] ?? 0) + 1;
    terug(v, gebracht('boor', b.nodig));
    n++;
    return false;
  });
  i.palen = i.palen.filter((p) => {
    if (binnenRing(k, p.x, p.y)) return true;
    terug(v, gebracht('paal', p.nodig));
    n++;
    return false;
  });
  for (const [sleutel, t] of i.banden) {
    if (binnenRing(k, t.x, t.y)) continue;
    if (t.goed) v[t.goed] = (v[t.goed] ?? 0) + 1;
    i.banden.delete(sleutel);
    terug(v, gebracht('band', t.nodig));
    n++;
  }
  if (n) log(energie(s), `PACKED UP ${n} THINGS OUTSIDE THE RING. COSTS REFUNDED`, 'cyaan');
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
