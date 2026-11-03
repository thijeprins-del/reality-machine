// Energiebeheer van de muizen (alleen muizen, de otters hebben iets anders).
// Het draait om keuzes, niet om alles overeind houden:
// - Bronnen verbranden grondstof uit de opslag. Stand LAAG, NORMAAL of OVERLADEN.
// - Overladen geeft flink meer stroom, maar de bron wordt heet. Een hete bron levert daarna een tijd minder
//   (bij 100 hitte nog maar de helft, en dan springt hij terug naar NORMAAL). Niets gaat stuk.
// - Verbruikers staan op volgorde: bij een tekort krijgen de bovensten eerst, de onderste valt uit.
// Puur regels, geen tekenen en geen Math.random. Getallen in src/data/muizen.ts (MUIZEN_ENERGIE).
import type { EenheidSoort, Grondstof, Trucje, Voorraad } from '../kern/types';
import type { SpelStaat } from '../kern/spel';
import { industrieVraag } from './industrie';
import { betaal, kostTekst } from './kosten';

export interface BronData {
  id: string;
  naam: string;
  kort: string;
  brandstof: Grondstof;
  kleur: string;
  stroom: [number, number, number]; // kW per stand (laag, normaal, overladen)
  verbruik: [number, number, number]; // grondstof per seconde per stand
  mk: number; // waarmee je begint: 0 = nog niet gebouwd, 1..3
  bouw: Voorraad[]; // bouw[i] = kosten om naar MK i+1 te gaan
  loot?: boolean; // alleen uit loot
}
export interface EnergieGetallen {
  bronnen: BronData[];
  mkMaal: { stroom: number[]; verbruik: number[] };
  overladen: { hitte: number; af: number; afKoeling: number; zwakTot: number };
  vraag: { machine: number; koeling: number; lampen: number };
  lampenSneller: number;
}

export const STANDEN = ['LAAG', 'NORMAAL', 'OVERLADEN'] as const;

export interface Bron extends BronData {
  aan: boolean;
  stand: 0 | 1 | 2;
  hitte: number; // 0..100: van overladen; maakt de bron tijdelijk zwakker
  levert: number;
  toets: string;
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
  aanbod: number;
  vraag: number;
  tekort: VerbruikerId | null; // wie als eerste te weinig kreeg
  hist: { a: number; v: number; h: number[] }[];
  histT: number;
  trend: Record<Grondstof, number>;
  trendT: number;
  vorige: Record<Grondstof, number>;
  log: LogRegel[];
  gemist: number;
}

const STATEN = new WeakMap<SpelStaat, EnergieStaat>();
let G: EnergieGetallen;

export function energie(s: SpelStaat): EnergieStaat {
  let e = STATEN.get(s);
  if (!e) {
    const v = s.voorraad;
    e = {
      bronnen: G.bronnen.map((b, i) => ({ ...b, aan: b.mk > 0, stand: 1, hitte: 0, levert: 0, toets: String(i + 1) })),
      verbruikers: [
        { id: 'machine', naam: 'MACHINE', vraag: G.vraag.machine, aan: false, krijgt: 0, toets: '4' },
        { id: 'industrie', naam: 'INDUSTRIE', vraag: 0, aan: true, krijgt: 0, toets: '5' },
        { id: 'lampen', naam: 'LAMPEN', vraag: G.vraag.lampen, aan: false, krijgt: 0, toets: '6' },
        { id: 'koeling', naam: 'KOELING', vraag: G.vraag.koeling, aan: false, krijgt: 0, toets: '7' },
      ],
      aanbod: 0,
      vraag: 0,
      tekort: null,
      hist: [],
      histT: 0,
      trend: { schroot: 0, hout: 0, kristal: 0 },
      trendT: 0,
      vorige: { schroot: v.schroot ?? 0, hout: v.hout ?? 0, kristal: v.kristal ?? 0 },
      log: [{ tekst: 'ZET DE HOUTBRANDER AAN (1)', kleur: 'groen' }],
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

const GRONDSTOFFEN: Grondstof[] = ['schroot', 'hout', 'kristal'];
const rond = (n: number) => Math.round(n * 10) / 10;
export const MAX_MK = 3;

// Wat een bron levert en stookt, met zijn MK en zijn hitte erbij.
export const zwakte = (b: Bron) => 1 - (1 - G.overladen.zwakTot) * (b.hitte / 100);
export const stroomVan = (b: Bron, stand: number = b.stand) => (b.mk ? rond(b.stroom[stand] * G.mkMaal.stroom[b.mk - 1] * (stand === 2 ? 1 : zwakte(b))) : 0);
export const verbruikVan = (b: Bron, stand: number = b.stand) => (b.mk ? b.verbruik[stand] * G.mkMaal.verbruik[b.mk - 1] : 0);
export const verbruiker = (s: SpelStaat, id: VerbruikerId) => energie(s).verbruikers.find((c) => c.id === id)!;

export function stapEnergie(s: SpelStaat, sec: number, muis: EenheidSoort | undefined, graafSec: number): void {
  const e = energie(s);
  const v = s.voorraad;
  const koeling = verbruiker(s, 'koeling');

  let aanbod = 0;
  for (const b of e.bronnen) {
    b.levert = 0;
    if (b.aan && b.mk) {
      const kost = verbruikVan(b) * sec;
      if ((v[b.brandstof] ?? 0) >= kost) {
        v[b.brandstof] = (v[b.brandstof] ?? 0) - kost;
        b.levert = stroomVan(b);
      } else {
        b.aan = false;
        log(e, `${b.brandstof.toUpperCase()} OP: ${b.naam} VALT STIL`, 'rood');
      }
    }
    // hitte: alleen van overladen. Daarna koelt hij af, sneller met koeling.
    if (b.levert > 0 && b.stand === 2) {
      b.hitte = Math.min(100, b.hitte + G.overladen.hitte * sec);
      if (b.hitte >= 100) {
        b.stand = 1;
        log(e, `${b.naam} TE HEET: TERUG NAAR NORMAAL, EVEN ZWAKKER`, 'amber');
      }
    } else b.hitte = Math.max(0, b.hitte - (koeling.krijgt > 0 ? G.overladen.afKoeling * koeling.krijgt + G.overladen.af : G.overladen.af) * sec);
    aanbod += b.levert;
  }
  aanbod = rond(aanbod);

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
  if (!was && m.energie >= m.maxEnergie) log(e, 'MACHINE OP VOLLE STROOM. KLAAR VOOR DE STREAM', 'groen');
  if (was && m.energie < m.maxEnergie) log(e, 'MACHINE KRIJGT TE WEINIG STROOM', 'rood');
  if (s.gemist !== e.gemist) {
    e.gemist = s.gemist;
    log(e, 'STREAM GEMIST! MACHINE HAD GEEN VOLLE STROOM', 'rood');
  }
  if (muis?.werk) muis.werk.mijnSec = graafSec / (1 + G.lampenSneller * verbruiker(s, 'lampen').krijgt);

  // trend en geschiedenis voor het paneel
  e.trendT += sec;
  if (e.trendT >= 1) {
    for (const g of GRONDSTOFFEN) {
      e.trend[g] = ((v[g] ?? 0) - e.vorige[g]) / e.trendT;
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
  const e = energie(s);
  if (!b.mk) return log(e, b.loot ? `${b.naam}: ALLEEN UIT LOOT` : `${b.naam} IS NOG NIET GEBOUWD. KLIK +`, 'rood');
  if (!b.aan && (s.voorraad[b.brandstof] ?? 0) < 0.5) return log(e, `GEEN ${b.brandstof.toUpperCase()} IN DE OPSLAG`, 'rood');
  b.aan = !b.aan;
  log(e, `${b.naam} ${b.aan ? 'AAN' : 'UIT'}`);
}
export function draaiKnop(s: SpelStaat, b: Bron): void {
  if (!b.mk) return log(energie(s), `${b.naam} IS NOG NIET GEBOUWD`, 'rood');
  b.stand = ((b.stand + 1) % 3) as 0 | 1 | 2;
  log(energie(s), `${b.naam} ${STANDEN[b.stand]}: ${stroomVan(b)} KW`, b.stand === 2 ? 'amber' : 'groen');
}
// Bouwen (MK 0 -> 1) of upgraden (MK 1 -> 2 -> 3): meer stroom, maar ook meer brandstof.
export const upgradeKosten = (b: Bron): Voorraad | null => (b.mk < MAX_MK && !b.loot ? b.bouw[b.mk] : null);
export function upgradeBron(s: SpelStaat, b: Bron): void {
  const e = energie(s);
  if (b.loot && !b.mk) return log(e, `${b.naam}: ALLEEN UIT LOOT`, 'rood');
  const k = upgradeKosten(b);
  if (!k) return log(e, `${b.naam} IS AL MK${MAX_MK}`);
  if (!betaal(s.voorraad, k)) return log(e, `${b.naam} MK${b.mk + 1} KOST ${kostTekst(k)}`, 'rood');
  b.mk++;
  log(e, b.mk === 1 ? `${b.naam} GEBOUWD! HENDEL OM AAN TE ZETTEN` : `${b.naam} NU MK${b.mk}: ${stroomVan(b, 1)} KW NORMAAL`, 'groen');
}
export function zetVerbruiker(s: SpelStaat, c: Verbruiker): void {
  c.aan = !c.aan;
  log(energie(s), `${c.naam} ${c.aan ? 'AAN' : 'UIT'}`);
}
// Een verbruiker een plek omhoog in de voorrang.
export function omhoog(s: SpelStaat, c: Verbruiker): void {
  const e = energie(s);
  const i = e.verbruikers.indexOf(c);
  if (i <= 0) return;
  [e.verbruikers[i - 1], e.verbruikers[i]] = [e.verbruikers[i], e.verbruikers[i - 1]];
  log(e, `VOORRANG: ${c.naam} VOOR ${e.verbruikers[i].naam}`, 'cyaan');
}

// Het trucje van de muizen: elke tik het stroomnet bijwerken.
export function energieTrucje(getallen: EnergieGetallen, eenheden: EenheidSoort[]): Trucje {
  G = getallen;
  const muis = eenheden.find((x) => x.soort === 'muis');
  const graafSec = muis?.werk?.mijnSec ?? 1;
  return { naam: 'Stroomnet', opTik: (s, sec) => stapEnergie(s, sec, muis, graafSec) };
}
