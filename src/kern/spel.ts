import { DIMENSIE_DUUR_SEC } from '../data/dimensies';
import { maakKaart, type Kaart } from './kaart';
import type { Factie, FactieId, Machine, Voorraad } from './types';
import { maakWerkers, stapWerkers, type Werker } from './werkers';

// Spelregels zonder tekenen. Toeval voor regels altijd via de seed (`toeval`), nooit Math.random.
export interface SpelStaat {
  seed: number;
  toeval: number; // stand van de toevalsstroom (zie toeval.ts)
  tijd: number; // seconden in de huidige dimensie
  dimensie: number; // hoeveelste dimensie
  factie: FactieId;
  kaart: Kaart;
  machine: Machine;
  voorraad: Voorraad; // wat er in de opslag ligt
  werkers: Werker[];
}

export function nieuwSpel(seed: number, f: Factie): SpelStaat {
  const s = { toeval: seed >>> 0 };
  const kaart = maakKaart(s);
  const werkers: Werker[] = [];
  for (const [soort, aantal] of Object.entries(f.startEenheden)) {
    const nieuw = maakWerkers(soort, aantal ?? 0, kaart, s);
    for (const w of nieuw) w.id = werkers.length + w.id;
    werkers.push(...nieuw);
  }
  return {
    seed,
    toeval: s.toeval,
    tijd: 0,
    dimensie: 1,
    factie: f.id,
    kaart,
    machine: { ...f.startMachine },
    voorraad: { ...f.startVoorraad },
    werkers,
  };
}

export function stap(s: SpelStaat, f: Factie, sec: number): void {
  stapWerkers(s, f.eenheden, sec);
  f.trucje.opTik?.(s, sec);
  s.tijd += sec;
  while (s.tijd >= DIMENSIE_DUUR_SEC) {
    s.tijd -= DIMENSIE_DUUR_SEC;
    stream(s, f);
  }
}

export function stream(s: SpelStaat, f?: Factie): void {
  s.dimensie += 1;
  s.tijd = 0;
  f?.trucje.opStream?.(s);
}

export function restTijd(s: SpelStaat): number {
  return Math.max(0, DIMENSIE_DUUR_SEC - s.tijd);
}

export function seedUitAdres(): number {
  const p = new URLSearchParams(location.search).get('seed');
  const n = p === null ? NaN : Number(p);
  return Number.isFinite(n) ? n : Date.now() % 1_000_000;
}
