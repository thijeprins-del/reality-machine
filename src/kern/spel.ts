import { DIMENSIE_DUUR_SEC } from '../data/dimensies';

// Spelregels zonder tekenen. Toeval voor regels altijd via de seed, nooit Math.random.
export interface SpelStaat {
  seed: number;
  tijd: number; // seconden in de huidige dimensie
  dimensie: number; // hoeveelste dimensie
}

export function nieuwSpel(seed: number): SpelStaat {
  return { seed, tijd: 0, dimensie: 1 };
}

export function stap(s: SpelStaat, sec: number): void {
  s.tijd += sec;
  while (s.tijd >= DIMENSIE_DUUR_SEC) {
    s.tijd -= DIMENSIE_DUUR_SEC;
    stream(s);
  }
}

export function stream(s: SpelStaat): void {
  s.dimensie += 1;
  s.tijd = 0;
}

export function restTijd(s: SpelStaat): number {
  return Math.max(0, DIMENSIE_DUUR_SEC - s.tijd);
}

export function seedUitAdres(): number {
  const p = new URLSearchParams(location.search).get('seed');
  const n = p === null ? NaN : Number(p);
  return Number.isFinite(n) ? n : Date.now() % 1_000_000;
}
