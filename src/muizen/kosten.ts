// Betalen uit de opslag. Klein hulpje voor bouwen en upgraden.
import type { Voorraad } from '../kern/types';

export function kanBetalen(v: Voorraad, kosten: Voorraad, keer = 1): boolean {
  return Object.entries(kosten).every(([g, n]) => (v[g] ?? 0) >= (n ?? 0) * keer);
}

export function betaal(v: Voorraad, kosten: Voorraad, keer = 1): boolean {
  if (!kanBetalen(v, kosten, keer)) return false;
  for (const [g, n] of Object.entries(kosten)) v[g] = (v[g] ?? 0) - (n ?? 0) * keer;
  return true;
}

export function terug(v: Voorraad, kosten: Voorraad, keer = 1): void {
  for (const [g, n] of Object.entries(kosten)) v[g] = (v[g] ?? 0) + (n ?? 0) * keer;
}

// "30S 10H" voor het paneel (S = schroot, H = hout, K = kristal)
export function kostTekst(kosten: Voorraad): string {
  return Object.entries(kosten)
    .filter(([, n]) => n)
    .map(([g, n]) => `${n}${g[0].toUpperCase()}`)
    .join(' ') || 'GRATIS';
}
