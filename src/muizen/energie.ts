// Energiebeheer van de muizen (alleen muizen, de otters hebben iets anders).
// Bronnen verbranden grondstof uit de opslag en leveren stroom; verbruikers krijgen die stroom.
// Te weinig stroom: de zekering slaat door. Te veel: de rest wordt hitte. Op 100 hitte valt iets uit tot het is afgekoeld.
// Puur regels, geen tekenen en geen Math.random. Getallen in src/data/muizen.ts (MUIZEN_ENERGIE).
import type { EenheidSoort, Grondstof, Trucje } from '../kern/types';
import type { SpelStaat } from '../kern/spel';

export interface BronData {
  id: string;
  naam: string;
  brandstof: Grondstof;
  kleur: string;
  stroom: [number, number, number]; // kW per stand (laag, midden, hoog)
  verbruik: [number, number, number]; // grondstof per seconde per stand
  warmte: [number, number, number]; // hitte per seconde per stand
}
export interface EnergieGetallen {
  bronnen: BronData[];
  vraag: { machine: number; koeling: number; lampen: number }; // kW
  machineLaadtPerSec: number; // energie per seconde bij volle stroom
  koeling: number; // hitte per seconde eraf bij volle stroom
  lampenSneller: number; // 0.6 = muizen graven 60% sneller bij volle stroom
  zekeringSec: number; // zo lang houdt de zekering een tekort vol
  storingTot: number; // na storing pas weer bruikbaar onder deze hitte
}

export interface Bron extends BronData {
  aan: boolean;
  stand: 0 | 1 | 2;
  hitte: number;
  storing: boolean;
  levert: number;
  toets: string;
}
export type VerbruikerId = 'machine' | 'koeling' | 'lampen';
export interface Verbruiker {
  id: VerbruikerId;
  naam: string;
  vraag: number;
  aan: boolean;
  hitte: number;
  storing: boolean;
  krijgt: number; // 0..1: deel van de gevraagde stroom dat aankomt
  toets: string;
}
export interface LogRegel {
  tekst: string;
  kleur: 'amber' | 'rood' | 'groen' | 'cyaan';
}
export interface EnergieStaat {
  bronnen: Bron[];
  verbruikers: Verbruiker[];
  aanbod: number;
  vraag: number;
  zekering: { heel: boolean; spanning: number };
  nood: number; // seconden tot de noodstop weer kan
  hist: { a: number; v: number; h: number[] }[];
  histT: number;
  trend: Record<Grondstof, number>;
  trendT: number;
  vorige: Record<Grondstof, number>;
  log: LogRegel[];
}

const STATEN = new WeakMap<SpelStaat, EnergieStaat>();
let G: EnergieGetallen;

export function energie(s: SpelStaat): EnergieStaat {
  let e = STATEN.get(s);
  if (!e) {
    const v = s.voorraad;
    e = {
      bronnen: G.bronnen.map((b, i) => ({ ...b, aan: false, stand: 1, hitte: 0, storing: false, levert: 0, toets: String(i + 1) })),
      verbruikers: [
        { id: 'machine', naam: 'MACHINE', vraag: G.vraag.machine, aan: false, hitte: 0, storing: false, krijgt: 0, toets: '4' },
        { id: 'koeling', naam: 'KOELING', vraag: G.vraag.koeling, aan: false, hitte: 0, storing: false, krijgt: 0, toets: '5' },
        { id: 'lampen', naam: 'LAMPEN', vraag: G.vraag.lampen, aan: false, hitte: 0, storing: false, krijgt: 0, toets: '6' },
      ],
      aanbod: 0,
      vraag: 0,
      zekering: { heel: true, spanning: 0 },
      nood: 0,
      hist: [],
      histT: 0,
      trend: { schroot: 0, hout: 0, kristal: 0 },
      trendT: 0,
      vorige: { schroot: v.schroot ?? 0, hout: v.hout ?? 0, kristal: v.kristal ?? 0 },
      log: [{ tekst: 'STROOMNET KLAAR. ZET EEN BRON AAN', kleur: 'groen' }],
    };
    STATEN.set(s, e);
  }
  return e;
}

export function log(e: EnergieStaat, tekst: string, kleur: LogRegel['kleur'] = 'amber'): void {
  e.log.unshift({ tekst, kleur });
  if (e.log.length > 40) e.log.pop();
}

const GRONDSTOFFEN: Grondstof[] = ['schroot', 'hout', 'kristal'];

export function stapEnergie(s: SpelStaat, sec: number, muis: EenheidSoort | undefined, graafSec: number): void {
  const e = energie(s);
  const v = s.voorraad;

  let aanbod = 0;
  for (const b of e.bronnen) {
    b.levert = 0;
    if (b.aan && !b.storing) {
      const kost = b.verbruik[b.stand] * sec;
      if ((v[b.brandstof] ?? 0) >= kost) {
        v[b.brandstof] = (v[b.brandstof] ?? 0) - kost;
        b.levert = b.stroom[b.stand];
      } else {
        b.aan = false;
        log(e, `${b.brandstof.toUpperCase()} OP: ${b.naam} VALT STIL`, 'rood');
      }
    }
    aanbod += b.levert;
  }
  let vraag = 0;
  for (const c of e.verbruikers) if (c.aan && !c.storing) vraag += c.vraag;
  const net = e.zekering.heel;
  const ratio = vraag > 0 ? Math.min(1, aanbod / vraag) : 1;
  e.aanbod = aanbod;
  e.vraag = vraag;
  for (const c of e.verbruikers) c.krijgt = c.aan && !c.storing && net ? ratio : 0;

  // zekering
  if (net && aanbod < vraag - 0.01) {
    e.zekering.spanning += sec * (1 + (1 - ratio) * 2);
    if (e.zekering.spanning >= G.zekeringSec) {
      e.zekering.heel = false;
      e.zekering.spanning = G.zekeringSec;
      log(e, 'ZEKERING DOORGESLAGEN! KLIK RESET (Z)', 'rood');
    }
  } else e.zekering.spanning = Math.max(0, e.zekering.spanning - sec * 1.5);

  // hitte: ongebruikte stroom wordt hitte, koeling haalt het weg
  const over = Math.max(0, aanbod - (net ? Math.min(aanbod, vraag) : 0));
  const actief = e.bronnen.filter((b) => b.levert > 0).length || 1;
  const [machine, koeling, lampen] = e.verbruikers;
  const koel = koeling.krijgt * G.koeling + (e.nood > 7 ? 30 : 0);
  for (const b of e.bronnen) {
    let d = b.levert > 0 ? b.warmte[b.stand] + (over * 0.35) / actief - 1 : -6;
    d -= koel;
    b.hitte = Math.min(100, Math.max(0, b.hitte + d * sec));
    if (b.hitte >= 100 && !b.storing) {
      b.storing = true;
      log(e, `${b.naam} OVERVERHIT: STORING`, 'rood');
    }
    if (b.storing && b.hitte < G.storingTot) {
      b.storing = false;
      log(e, `${b.naam} AFGEKOELD`, 'groen');
    }
  }
  for (const c of [machine, lampen]) {
    let d = c.krijgt > 0 ? (c.id === 'machine' ? 1.7 : 1.2) * c.krijgt - 0.8 : -5;
    d -= koel;
    c.hitte = Math.min(100, Math.max(0, c.hitte + d * sec));
    if (c.hitte >= 100 && !c.storing) {
      c.storing = true;
      log(e, `${c.naam} OVERVERHIT: STORING`, 'rood');
    }
    if (c.storing && c.hitte < G.storingTot) {
      c.storing = false;
      log(e, `${c.naam} AFGEKOELD`, 'groen');
    }
  }

  // wat de verbruikers doen
  const m = s.machine;
  if (machine.krijgt > 0 && m.energie < m.maxEnergie) {
    m.energie = Math.min(m.maxEnergie, m.energie + machine.krijgt * G.machineLaadtPerSec * sec);
    if (m.energie >= m.maxEnergie) log(e, 'MACHINE VOL. KLAAR VOOR DE STREAM', 'groen');
  }
  if (muis?.werk) muis.werk.mijnSec = graafSec / (1 + G.lampenSneller * lampen.krijgt);
  e.nood = Math.max(0, e.nood - sec);

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
  if (b.storing) return log(e, `${b.naam} IN STORING. EERST AFKOELEN`, 'rood');
  if (!b.aan && (s.voorraad[b.brandstof] ?? 0) < 0.5) return log(e, `GEEN ${b.brandstof.toUpperCase()} IN DE OPSLAG`, 'rood');
  b.aan = !b.aan;
  log(e, `${b.naam} ${b.aan ? 'AAN' : 'UIT'}`);
}
export function draaiKnop(s: SpelStaat, b: Bron): void {
  b.stand = ((b.stand + 1) % 3) as 0 | 1 | 2;
  log(energie(s), `${b.naam} STAND ${['LAAG', 'MIDDEN', 'HOOG'][b.stand]}: ${b.stroom[b.stand]} KW`);
}
export function zetVerbruiker(s: SpelStaat, c: Verbruiker): void {
  const e = energie(s);
  if (c.storing) return log(e, `${c.naam} IN STORING. EERST AFKOELEN`, 'rood');
  c.aan = !c.aan;
  log(e, `${c.naam} ${c.aan ? 'AAN' : 'UIT'}`);
}
export function resetZekering(s: SpelStaat): void {
  const e = energie(s);
  if (e.zekering.heel) return log(e, 'ZEKERING IS HEEL');
  e.zekering.heel = true;
  e.zekering.spanning = 0;
  log(e, 'ZEKERING VERVANGEN', 'groen');
}
export function noodstop(s: SpelStaat): void {
  const e = energie(s);
  if (e.nood > 0) return log(e, 'NOODSTOP LAADT NOG OP', 'rood');
  for (const x of [...e.bronnen, ...e.verbruikers]) {
    x.aan = false;
    x.hitte = Math.max(0, x.hitte - 40);
  }
  e.nood = 10;
  log(e, 'NOODSTOP! ALLES UIT, STOOM AFGEBLAZEN', 'rood');
}

// Het trucje van de muizen: elke tik het stroomnet bijwerken.
export function energieTrucje(getallen: EnergieGetallen, eenheden: EenheidSoort[]): Trucje {
  G = getallen;
  const muis = eenheden.find((x) => x.soort === 'muis');
  const graafSec = muis?.werk?.mijnSec ?? 1;
  return { naam: 'Stroomnet', opTik: (s, sec) => stapEnergie(s, sec, muis, graafSec) };
}
