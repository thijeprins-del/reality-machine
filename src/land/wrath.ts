// Wrath en de overvallen van het land. Alleen regels, geen tekenwerk. Toeval via de seed (volgende() uit kern/toeval).
import {
  HEEL_HERSTEL_PER_SEC, OVERVAL_AFSTAND, OVERVAL_BEREIK, OVERVAL_HP, OVERVAL_SCHADE, OVERVAL_SNELHEID, VERDEDIG_SCHADE,
  VERDEDIG_STRAAL, WRATH_KALMEER_PER_SEC, WRATH_MAX, WRATH_PER_GOED, WRATH_PER_OVERVALLER_WEG, WRATH_RUST_NA, WRATH_STADIA, WRATH_VLOER,
  type WrathStadium,
} from '../data/wrath';
import { escalatie } from '../data/run';
import { vrijOp } from '../kern/routes';
import type { SpelStaat } from '../kern/spel';
import { volgende } from '../kern/toeval';
import { genereerDimensie, type GerolDimensie } from './genereer';
import { ARCHETYPES } from './archetypes';

export interface Overvaller {
  id: number;
  soort: string; // spritenaam
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  kijkt: 1 | -1;
  snelheid: number;
  schade: number;
}

export interface LandStaat {
  dim: GerolDimensie; // de gerolde dimensie waar je nu in staat
  wrath: number; // 0..100
  vloer: number; // zo ver kalmeert het land
  rest: number; // totaal wat er nog in de afzettingen lag bij de vorige meting
  rust: number; // seconden sinds er voor het laatst iets genomen is
  raidIn: number; // seconden tot de volgende overval
  raiders: Overvaller[];
  volgendId: number;
  heelRust: number; // seconden sinds een overvaller de machine voor het laatst raakte
  klok: number; // seconden in deze dimensie (voor de meting)
}

export const stadiumNummer = (wrath: number): number => {
  let n = 0;
  WRATH_STADIA.forEach((s, i) => { if (wrath >= s.vanaf) n = i; });
  return n;
};
export const stadium = (wrath: number): WrathStadium => WRATH_STADIA[stadiumNummer(wrath)];

const totaalRest = (s: SpelStaat): number => s.kaart.afzettingen.reduce((a, b) => a + Math.max(0, b.rest), 0);

// De landing: de dimensie zet het beginpunt van Wrath (of de URL, voor de eerste landing).
export function nieuwLand(s: SpelStaat, dim: GerolDimensie, wrath = dim.beginWrath): LandStaat {
  const w = Math.max(0, Math.min(WRATH_MAX, wrath));
  const st = stadium(w);
  return {
    dim, wrath: w, vloer: w * WRATH_VLOER, rest: totaalRest(s), rust: 0,
    raidIn: st.raid ? Math.min(st.raid.elke, escalatie(dim.nummer).eerste) : escalatie(dim.nummer).eerste, raiders: [], volgendId: 1, heelRust: 99, klok: 0,
  };
}

export function geefWrath(s: SpelStaat, n: number): void {
  const l = s.land;
  l.wrath = Math.max(0, Math.min(WRATH_MAX, n));
  l.vloer = Math.min(l.vloer, l.wrath);
}

// Welke sprites horen bij de bewoners van dit type (worldtypes/archetypes/*.json, "enemy"); wie er geen heeft leent de stam.
export const overvallerSprites = (a: GerolDimensie['archetype']): string[] => (ARCHETYPES[a].vijand ?? ARCHETYPES.steentijd.vijand!).overvallers;
const aanvalVan = (a: GerolDimensie['archetype']) => ARCHETYPES[a].vijand?.aanval;

// Een overval: `aantal` overvallers uit een hoek van de kaart, op lopend land, een eind buiten de ring.
export function overval(s: SpelStaat, aantal: number): void {
  const l = s.land, k = s.kaart, stijl = aanvalVan(l.dim.archetype);
  const hoek0 = volgende(s) * Math.PI * 2;
  const sprites = overvallerSprites(l.dim.archetype);
  for (let i = 0; i < aantal; i++) {
    let x = k.ring.x, y = k.ring.y;
    for (let poging = 0; poging < 40; poging++) {
      const hoek = hoek0 + (volgende(s) - 0.5) * 0.9;
      const af = k.ring.r + OVERVAL_AFSTAND - poging * 0.4;
      const px = k.ring.x + Math.cos(hoek) * af, py = k.ring.y + Math.sin(hoek) * af;
      if (px > 1 && py > 1 && px < k.breed - 1 && py < k.diep - 1 && vrijOp(k.lopen, px, py)) { x = px; y = py; break; }
    }
    const maxHp = OVERVAL_HP * l.dim.sterkte * (stijl?.hp ?? 1);
    l.raiders.push({ id: l.volgendId++, soort: sprites[l.volgendId % sprites.length], x, y, hp: maxHp, maxHp, kijkt: 1, snelheid: OVERVAL_SNELHEID * (stijl?.snelheid ?? 1), schade: OVERVAL_SCHADE * (stijl?.schade ?? 1) });
  }
}

export function stapLand(s: SpelStaat, sec: number): void {
  const l = s.land, k = s.kaart, m = s.machine;
  l.klok += sec;

  // hebzucht: wat er sinds de vorige tik uit de afzettingen is gehaald
  const nu = totaalRest(s);
  const genomen = Math.max(0, l.rest - nu);
  l.rest = nu;
  if (genomen > 0) {
    l.wrath = Math.min(WRATH_MAX, l.wrath + genomen * WRATH_PER_GOED * l.dim.sterkte);
    l.rust = 0;
  } else l.rust += sec;
  if (l.rust > WRATH_RUST_NA) l.wrath = Math.max(l.vloer, l.wrath - WRATH_KALMEER_PER_SEC * sec);

  // overvallen volgens het stadium
  const stijl = aanvalVan(l.dim.archetype);
  const druk = escalatie(l.dim.nummer).druk;
  const raid = l.wrath >= (stijl?.stilTot ?? 0) ? stadium(l.wrath).raid : null;
  if (raid) {
    l.raidIn -= sec;
    if (l.raidIn <= 0) {
      overval(s, stijl?.vast ?? Math.max(1, Math.round(raid.aantal * (stijl?.aantal ?? 1) * druk * Math.sqrt(l.dim.sterkte))));
      l.raidIn = (raid.elke * (stijl?.elke ?? 1)) / Math.sqrt(druk);
    }
  } else l.raidIn = Math.max(l.raidIn, escalatie(l.dim.nummer).eerste);

  // overvallers lopen naar de machine; muizen vlakbij slaan terug
  const mx = k.machine.x + k.machine.breed / 2 - 0.5, my = k.machine.y + k.machine.diep / 2 - 0.5;
  let raakt = false;
  for (const o of l.raiders) {
    const dx = mx - o.x, dy = my - o.y, d = Math.hypot(dx, dy);
    if (d > OVERVAL_BEREIK) {
      const st = Math.min(d - OVERVAL_BEREIK, o.snelheid * sec);
      const nx = o.x + (dx / d) * st, ny = o.y + (dy / d) * st;
      if (vrijOp(k.lopen, nx, ny)) { o.x = nx; o.y = ny; } else if (vrijOp(k.lopen, o.x + (dx / d) * st, o.y)) o.x += (dx / d) * st; else if (vrijOp(k.lopen, o.x, o.y + (dy / d) * st)) o.y += (dy / d) * st;
      if (Math.abs(dx - dy) > 0.01) o.kijkt = dx - dy > 0 ? 1 : -1;
    } else {
      m.heelheid = Math.max(0, m.heelheid - o.schade * sec);
      raakt = true;
    }
    let muizen = 0;
    for (const w of s.werkers) if (Math.hypot(w.x - o.x, w.y - o.y) <= VERDEDIG_STRAAL) muizen++;
    o.hp -= muizen * VERDEDIG_SCHADE * sec;
  }
  const voor = l.raiders.length;
  l.raiders = l.raiders.filter((o) => o.hp > 0);
  if (l.raiders.length < voor) l.wrath = Math.max(l.vloer, l.wrath - (voor - l.raiders.length) * WRATH_PER_OVERVALLER_WEG);

  // de machine herstelt rustig zodra niemand hem raakt
  l.heelRust = raakt ? 0 : l.heelRust + sec;
  if (l.heelRust > 5 && m.heelheid < m.maxHeelheid) m.heelheid = Math.min(m.maxHeelheid, m.heelheid + HEEL_HERSTEL_PER_SEC * sec);
}

// Dimensie n van deze seed, met eventueel een afgedwongen type (alleen de eerste dimensie via de URL).
export function rolDimensie(seed: number, nummer: number, type?: GerolDimensie['archetype']): GerolDimensie {
  return genereerDimensie(seed, nummer, type ? { archetype: type } : {});
}

// ?type= : het id (steentijd), de naam in beeld (stone age) of een kort Engels woord (stone, bugs, giants).
export function typeUitTekst(t: string | null): GerolDimensie['archetype'] | undefined {
  if (!t) return undefined;
  const sleutel = t.toLowerCase().replace(/[^a-z]/g, '');
  const alles = Object.entries(ARCHETYPES) as [GerolDimensie['archetype'], (typeof ARCHETYPES)[GerolDimensie['archetype']]][];
  for (const [id, info] of alles) {
    const naam = info.naam.toLowerCase().replace(/[^a-z]/g, '');
    if (sleutel === id || sleutel === naam || (sleutel.length >= 4 && (naam.startsWith(sleutel) || id.startsWith(sleutel)))) return id;
  }
  return undefined;
}
