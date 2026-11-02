import { DIMENSIE_DUUR_SEC, SPRONG_SEC } from '../data/dimensies';
import { binnenRing, maakKaart, type Kaart } from './kaart';
import { hash01 } from './toeval';
import type { Factie, FactieId, Machine, Voorraad } from './types';
import { maakWerkers, stapWerkers, type Werker } from './werkers';

// Spelregels zonder tekenen. Toeval voor regels altijd via de seed (`toeval`), nooit Math.random.
export interface SpelStaat {
  seed: number;
  toeval: number; // stand van de toevalsstroom (zie toeval.ts)
  tijd: number; // seconden in de huidige dimensie
  dimensie: number; // hoeveelste dimensie
  onderweg: number; // seconden nog in het niets tussen twee dimensies (0 = geland)
  gemist: number; // zo vaak kwam de stream terwijl de machine geen volle stroom had
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
    gemist: 0,
    onderweg: SPRONG_SEC, // het spel begint in het niets en landt dan in de eerste wereld
    factie: f.id,
    kaart,
    machine: { ...f.startMachine },
    voorraad: { ...f.startVoorraad },
    werkers,
  };
}

export function stap(s: SpelStaat, f: Factie, sec: number): void {
  if (s.onderweg > 0) {
    // in het niets: niemand loopt, de klok staat stil, alleen het trucje (stroomnet) draait
    s.onderweg = Math.max(0, s.onderweg - sec);
    f.trucje.opTik?.(s, sec);
    return;
  }
  stapWerkers(s, f.eenheden, sec);
  f.trucje.opTik?.(s, sec);
  s.tijd += sec;
  while (s.tijd >= DIMENSIE_DUUR_SEC) {
    s.tijd -= DIMENSIE_DUUR_SEC;
    // Alleen met volle stroom op dat moment springt de schijf mee. Anders mis je hem en blijf je hier
    // (voorlopig vergevingsgezind: volgens het ontwerp verlies je dan).
    if (s.machine.energie >= s.machine.maxEnergie) stream(s, f);
    else s.gemist += 1;
  }
}

// De stream: alles binnen de gele ring springt naar de volgende dimensie. Daar liggen nieuwe grondstoffen.
export function stream(s: SpelStaat, f?: Factie): void {
  s.dimensie += 1;
  s.tijd = 0;
  s.onderweg = SPRONG_SEC;
  verhuis(s);
  f?.trucje.opStream?.(s);
}

function verhuis(s: SpelStaat): void {
  s.kaart = maakKaart(s); // zelfde machine en opslag, nieuwe velden
  const r = s.kaart.ring;
  for (const w of s.werkers) {
    // wat ze droegen gaat mee de opslag in; opdrachten in de oude wereld vervallen
    if (w.lading) s.voorraad[w.lading.goed] = (s.voorraad[w.lading.goed] ?? 0) + w.lading.n;
    w.lading = null;
    w.bron = -1;
    w.via = null;
    w.taak = 'rust';
    w.klok = 0;
    if (!binnenRing(s.kaart, w.x, w.y)) {
      // wie buiten de ring stond, wordt mee naar binnen getrokken (nu nog vergevingsgezind)
      const hoek = Math.atan2(w.y - r.y, w.x - r.x);
      const af = r.r - 1 - hash01(w.id) * 1.5;
      w.x = r.x + Math.cos(hoek) * af;
      w.y = r.y + Math.sin(hoek) * af;
    }
    w.doelX = w.x;
    w.doelY = w.y;
  }
}

export function restTijd(s: SpelStaat): number {
  return Math.max(0, DIMENSIE_DUUR_SEC - s.tijd);
}

export function seedUitAdres(): number {
  const p = new URLSearchParams(location.search).get('seed');
  const n = p === null ? NaN : Number(p);
  return Number.isFinite(n) ? n : Date.now() % 1_000_000;
}
