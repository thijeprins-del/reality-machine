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

// Namen in beeld (het spel is in het Engels; de code blijft Nederlands).
export const NAAM: Record<string, string> = { schroot: 'SCRAP', hout: 'WOOD', kristal: 'CRYSTAL', plaat: 'PLATE', balk: 'BEAM' };
export const naamVan = (g: string) => NAAM[g] ?? g.toUpperCase();

// "30S 10W" voor kleine plekken op het paneel; voluit: "30 SCRAP, 10 WOOD"
export function kostTekst(kosten: Voorraad, voluit = false): string {
  return Object.entries(kosten)
    .filter(([, n]) => n)
    .map(([g, n]) => (voluit ? `${n} ${naamVan(g)}` : `${n}${naamVan(g)[0]}`))
    .join(voluit ? ', ' : ' ') || 'FREE';
}
