// Het stroomnet van de pack rats. Het draait om keuzes, niet om alles overeind houden:
// - Stroom komt van twee kanten. Het looprad hoort bij de machine: ratten rennen erin, geen brandstof. En generatoren:
//   gebouwen uit de economie van de wereld (economies/*.json) met een recept dat stroom levert ("power"), bijvoorbeeld
//   een brander die koolstof of biomassa stookt. Die zet je neer en voer je zoals elk ander gebouw (industrie.ts).
// - Het looprad heeft drie standen: LAAG, NORMAAL of OVERLADEN. Overladen geeft flink meer stroom, maar het rad wordt
//   heet en levert daarna een tijd minder (bij 100 hitte nog maar de helft, en dan springt het terug naar NORMAAL).
// - Verbruikers staan op volgorde: bij een tekort krijgen de bovensten eerst, de onderste valt uit.
// Puur regels, geen tekenen en geen Math.random. Getallen in src/data/ratten.ts (RATTEN_ENERGIE).
import { actieveEconomie, grondstoffenVan } from '../kern/economie';
import type { EenheidSoort, Goed, Trucje } from '../kern/types';
import type { SpelStaat } from '../kern/spel';
import { generatorStroom, industrieVraag } from './industrie';

// Een bron die bij de machine hoort (nu alleen het looprad). Generatoren zijn gebouwen en staan in industrie.ts.
export interface BronData {
  id: string;
  naam: string;
  kort: string;
  renners: [number, number, number]; // zoveel ratten nodig per stand voor volle stroom
  kleur: string;
  stroom: [number, number, number]; // kW per stand (laag, normaal, overladen)
}
export interface EnergieGetallen {
  bronnen: BronData[];
  overladen: { hitte: number; af: number; afKoeling: number; zwakTot: number };
  vraag: { machine: number; koeling: number; lampen: number };
  lampenSneller: number;
}

export const STANDEN = ['LOW', 'NORMAL', 'OVERCHARGE'] as const;

export interface Bron extends BronData {
  aan: boolean;
  stand: 0 | 1 | 2;
  hitte: number; // 0..100: van overladen; maakt de bron tijdelijk zwakker
  levert: number;
  toets: string;
  rennen: number; // ratten die er nu in rennen (zet werk.ts)
}
export type VerbruikerId = 'machine' | 'industrie' | 'lampen' | 'koeling';
export interface Verbruiker {
  id: VerbruikerId;
  naam: string;
  vraag: number;
  aan: boolean;
  krijgt: number; // 0..1: deel van de gevraagde stroom dat aankomt
  toets: string;
}
export interface LogRegel {
  tekst: string;
  kleur: 'amber' | 'rood' | 'groen' | 'cyaan';
}
export interface EnergieStaat {
  bronnen: Bron[];
  verbruikers: Verbruiker[]; // op volgorde van voorrang
  aanbod: number; // alles bij elkaar: looprad plus generatoren
  generatoren: number; // wat de generatoren nu samen leveren
  vraag: number;
  tekort: VerbruikerId | null; // wie als eerste te weinig kreeg
  hist: { a: number; v: number; h: number[] }[];
  histT: number;
  trend: Record<Goed, number>; // per grondstof: erbij of eraf per seconde
  trendT: number;
  vorige: Record<Goed, number>;
  log: LogRegel[];
  gemist: number;
}

const STATEN = new WeakMap<SpelStaat, EnergieStaat>();
let G: EnergieGetallen;

export function energie(s: SpelStaat): EnergieStaat {
  let e = STATEN.get(s);
  if (!e) {
    e = {
      bronnen: G.bronnen.map((b, i) => ({ ...b, aan: true, stand: 1, hitte: 0, levert: 0, rennen: 0, toets: i < 3 ? String(i + 1) : '' })),
      verbruikers: [
        { id: 'machine', naam: 'MACHINE', vraag: G.vraag.machine, aan: false, krijgt: 0, toets: '4' },
        { id: 'industrie', naam: 'INDUSTRY', vraag: 0, aan: true, krijgt: 0, toets: '5' },
        { id: 'lampen', naam: 'LAMPS', vraag: G.vraag.lampen, aan: false, krijgt: 0, toets: '6' },
        { id: 'koeling', naam: 'COOLING', vraag: G.vraag.koeling, aan: false, krijgt: 0, toets: '7' },
      ],
      aanbod: 0,
      generatoren: 0,
      vraag: 0,
      tekort: null,
      hist: [],
      histT: 0,
      trend: {},
      trendT: 0,
      vorige: {},
      log: [{ tekst: 'RATS ARE RUNNING IN THE WHEEL. CHOOSE WHAT GETS POWER', kleur: 'groen' }],
      gemist: s.gemist,
    };
    STATEN.set(s, e);
  }
  return e;
}

export function log(e: EnergieStaat, tekst: string, kleur: LogRegel['kleur'] = 'amber'): void {
  if (e.log[0]?.tekst === tekst) return;
  e.log.unshift({ tekst, kleur });
  if (e.log.length > 40) e.log.pop();
}

const rond = (n: number) => Math.round(n * 10) / 10;

// Wat een bron levert, met zijn hitte erbij.
export const zwakte = (b: Bron) => 1 - (1 - G.overladen.zwakTot) * (b.hitte / 100);
export const stroomVan = (b: Bron, stand: number = b.stand) => rond(b.stroom[stand] * (stand === 2 ? 1 : zwakte(b)));
export const verbruiker = (s: SpelStaat, id: VerbruikerId) => energie(s).verbruikers.find((c) => c.id === id)!;

export function stapEnergie(s: SpelStaat, sec: number, muis: EenheidSoort | undefined, graafSec: number): void {
  const e = energie(s);
  const v = s.voorraad;
  const koeling = verbruiker(s, 'koeling');

  let aanbod = 0;
  for (const b of e.bronnen) {
    // looprad: geen brandstof, wel ratten. Te weinig renners = minder stroom.
    b.levert = b.aan ? rond(stroomVan(b) * Math.min(1, b.rennen / b.renners[b.stand])) : 0;
    // hitte: alleen van overladen. Daarna koelt hij af, sneller met koeling.
    if (b.levert > 0 && b.stand === 2) {
      b.hitte = Math.min(100, b.hitte + G.overladen.hitte * sec);
      if (b.hitte >= 100) {
        b.stand = 1;
        log(e, `${b.naam} TOO HOT: BACK TO NORMAL, WEAKER FOR A WHILE`, 'amber');
      }
    } else b.hitte = Math.max(0, b.hitte - (koeling.krijgt > 0 ? G.overladen.afKoeling * koeling.krijgt + G.overladen.af : G.overladen.af) * sec);
    aanbod += b.levert;
  }
  // generatoren: elk gebouw dat nu een recept met stroom draait
  e.generatoren = rond(generatorStroom(s));
  aanbod = rond(aanbod + e.generatoren);

  // verbruikers op volgorde: wie boven staat krijgt eerst
  verbruiker(s, 'industrie').vraag = industrieVraag(s);
  let rest = aanbod;
  let vraag = 0;
  e.tekort = null;
  for (const c of e.verbruikers) {
    if (!c.aan || c.vraag <= 0) {
      c.krijgt = c.aan ? 1 : 0;
      continue;
    }
    vraag += c.vraag;
    const krijgt = Math.min(1, Math.max(0, rest / c.vraag));
    c.krijgt = krijgt > 0.999 ? 1 : krijgt;
    if (c.krijgt < 1 && !e.tekort) e.tekort = c.id;
    rest = Math.max(0, rest - c.vraag);
  }
  e.aanbod = aanbod;
  e.vraag = rond(vraag);

  // De machine laadt niet op: hij moet gewoon genoeg stroom krijgen op het moment van de stream.
  const m = s.machine;
  const was = m.energie >= m.maxEnergie;
  m.energie = Math.floor(verbruiker(s, 'machine').krijgt * m.maxEnergie);
  if (!was && m.energie >= m.maxEnergie) log(e, 'MACHINE AT FULL POWER. READY FOR THE STREAM', 'groen');
  if (was && m.energie < m.maxEnergie) log(e, 'MACHINE IS NOT GETTING ENOUGH POWER', 'rood');
  if (s.gemist !== e.gemist) {
    e.gemist = s.gemist;
    log(e, 'STREAM MISSED! THE MACHINE WAS NOT AT FULL POWER', 'rood');
  }
  if (muis?.werk) muis.werk.mijnSec = graafSec / (1 + G.lampenSneller * verbruiker(s, 'lampen').krijgt);

  // trend en geschiedenis voor het paneel
  e.trendT += sec;
  if (e.trendT >= 1) {
    for (const g of grondstoffenVan(actieveEconomie())) {
      e.trend[g] = ((v[g] ?? 0) - (e.vorige[g] ?? v[g] ?? 0)) / e.trendT;
      e.vorige[g] = v[g] ?? 0;
    }
    e.trendT = 0;
  }
  e.histT += sec;
  if (e.histT >= 0.2) {
    e.histT = 0;
    e.hist.push({ a: aanbod, v: vraag, h: e.bronnen.map((b) => b.hitte) });
    if (e.hist.length > 132) e.hist.shift();
  }
}

// ---- bediening (vanuit het paneel of toetsen) ----
export function zetBron(s: SpelStaat, b: Bron): void {
  b.aan = !b.aan;
  log(energie(s), `${b.naam} ${b.aan ? 'ON' : 'OFF'}`);
}
export function draaiKnop(s: SpelStaat, b: Bron): void {
  b.stand = ((b.stand + 1) % 3) as 0 | 1 | 2;
  log(energie(s), `${b.naam} ${STANDEN[b.stand]}: ${stroomVan(b)} KW`, b.stand === 2 ? 'amber' : 'groen');
}
export function zetVerbruiker(s: SpelStaat, c: Verbruiker): void {
  c.aan = !c.aan;
  log(energie(s), `${c.naam} ${c.aan ? 'ON' : 'OFF'}`);
}
// Een verbruiker een plek omhoog in de voorrang.
export function omhoog(s: SpelStaat, c: Verbruiker): void {
  const e = energie(s);
  const i = e.verbruikers.indexOf(c);
  if (i <= 0) return;
  [e.verbruikers[i - 1], e.verbruikers[i]] = [e.verbruikers[i], e.verbruikers[i - 1]];
  log(e, `PRIORITY: ${c.naam} BEFORE ${e.verbruikers[i].naam}`, 'cyaan');
}

// Het trucje: elke tik het stroomnet bijwerken.
export function energieTrucje(getallen: EnergieGetallen, eenheden: EenheidSoort[]): Trucje {
  G = getallen;
  const muis = eenheden.find((x) => x.soort === 'muis');
  const graafSec = muis?.werk?.mijnSec ?? 1;
  return { naam: 'Stroomnet', opTik: (s, sec) => stapEnergie(s, sec, muis, graafSec) };
}
