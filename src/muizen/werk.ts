// Muizen werken zelf. Een muis die niets te doen heeft zoekt werk, in deze volgorde:
//   1. bouwen: bouwplekken afmaken (boor, band, paal, stapel)
//   2. fabriceren: in de fabricator werken als er iets in de rij staat
//   3. sjouwen: een boor zonder band leeghalen en de brokken naar de stapel brengen
//   4. graven: zelf grondstof halen uit het dichtstbijzijnde veld waar nog plek voor is in de opslag
// Je kunt muizen nog steeds verplaatsen of naar een veld sturen; daarna zoeken ze werk vanaf waar ze staan.
// Het lopen, graven en sjouwen naar de opslag doet de kern (werkers.ts); dit trucje kiest alleen het werk.
import type { SpelStaat } from '../kern/spel';
import type { EenheidSoort, Grondstof, Trucje } from '../kern/types';
import { stuur, type Werker } from '../kern/werkers';
import { hash01 } from '../kern/toeval';
import {
  blok2, boorHeeftBand, getallen, gevoed, GRONDSTOFFEN, industrie, midden, opslagMax, vast, type Boor,
} from './industrie';

export type Klus = 'bouw' | 'fab' | 'haal' | 'breng' | 'graaf';
interface Taak {
  klus: Klus;
  doel: number | string; // id van het ding of tegelsleutel van de band
  x: number;
  y: number;
}
interface WerkStaat {
  taken: Map<number, Taak>;
  klok: number;
  telling: Record<Klus | 'vrij', number>;
}
const STATEN = new WeakMap<SpelStaat, WerkStaat>();
let DRAAGT = 2;

export function werk(s: SpelStaat): WerkStaat {
  let w = STATEN.get(s);
  if (!w) {
    w = { taken: new Map(), klok: 0, telling: { bouw: 0, fab: 0, haal: 0, breng: 0, graaf: 0, vrij: 0 } };
    STATEN.set(s, w);
  }
  return w;
}

const daar = (w: Werker, t: Taak) => w.taak === 'rust' && Math.hypot(w.x - t.x, w.y - t.y) < 0.35;

// Een plekje langs de rand van een blok, voor elke muis een eigen.
function randPlek(b: { x: number; y: number; breed: number; diep: number }, id: number): { x: number; y: number } {
  const h = hash01(id * 7 + 3), z = Math.floor(hash01(id * 13 + 1) * 4);
  const l = b.x - 0.8, t = b.y - 0.8, r = b.x + b.breed - 0.2, o = b.y + b.diep - 0.2;
  return [{ x: l + (r - l) * h, y: o }, { x: r, y: t + (o - t) * h }, { x: l + (r - l) * h, y: t }, { x: l, y: t + (o - t) * h }][z];
}

// Waar breng je een grondstof heen? De dichtstbijzijnde stapel voor die grondstof, anders de opslag.
function brengPlek(s: SpelStaat, g: Grondstof, w: Werker): { x: number; y: number } {
  const st = industrie(s).stapels.filter((p) => p.goed === g && !p.af);
  let beste = midden(s.kaart.opslag), af = Infinity;
  for (const p of st) {
    const c = midden(blok2(p));
    const d = Math.hypot(c.x - w.x, c.y - w.y);
    if (d < af) [beste, af] = [c, d];
  }
  return { x: beste.x + (hash01(w.id) - 0.5) * 1.4, y: beste.y + (hash01(w.id + 9) - 0.5) * 1.4 };
}

function stapWerk(s: SpelStaat, sec: number): void {
  if (s.onderweg > 0) return;
  const W = werk(s);
  const i = industrie(s);
  const G = getallen();
  const v = s.voorraad;

  // eerst: wie is waar mee bezig, en het werk zelf
  const bouwplek = new Map<number | string, { af: number }>();
  for (const b of i.boren) if (b.af && !b.vlieg) bouwplek.set(b.id, b);
  for (const p of [...i.palen, ...i.stapels]) if (p.af) bouwplek.set(p.id, p);
  for (const [k, t] of i.banden) if (t.af) bouwplek.set(`b${k}`, t);
  const aantal = new Map<number | string, number>();
  let ploeg = 0;
  for (const w of s.werkers) {
    const t = W.taken.get(w.id);
    if (!t) continue;
    // de speler heeft hem ergens anders heen gestuurd: dan is dit werk niet meer van hem
    if (w.taak === 'lopen' && Math.hypot(w.doelX - t.x, w.doelY - t.y) > 0.5) {
      W.taken.delete(w.id);
      continue;
    }
    if (t.klus === 'graaf') {
      // brengt zijn lading naar de stapel van die grondstof als die er is
      if (w.taak === 'naarOpslag' && w.lading && !(t.doel === 'om')) {
        const p = brengPlek(s, w.lading.goed, w);
        w.doelX = p.x;
        w.doelY = p.y;
        w.via = null;
        t.doel = 'om';
      } else if (w.taak === 'naarBron') t.doel = '';
      if (w.taak === 'rust' && !w.lading) W.taken.delete(w.id);
      continue;
    }
    if (t.klus === 'bouw') {
      const plek = bouwplek.get(t.doel);
      if (!plek) {
        W.taken.delete(w.id);
        continue;
      }
      aantal.set(t.doel, (aantal.get(t.doel) ?? 0) + 1);
      if (daar(w, t)) plek.af = Math.max(0, plek.af - sec);
    } else if (t.klus === 'fab') {
      if (!i.fabricator.rij.length) {
        W.taken.delete(w.id);
        continue;
      }
      aantal.set('fab', (aantal.get('fab') ?? 0) + 1);
      if (daar(w, t)) ploeg++;
    } else if (t.klus === 'haal') {
      const b = i.boren.find((x) => x.id === t.doel);
      if (!b) {
        W.taken.delete(w.id);
        continue;
      }
      aantal.set(t.doel, (aantal.get(t.doel) ?? 0) + 1);
      if (daar(w, t)) {
        if (!b.buffer.length) {
          W.taken.delete(w.id);
          continue;
        }
        // pak wat hij dragen kan van één soort
        const g = b.buffer[0];
        let n = 0;
        while (n < DRAAGT && b.buffer[0] === g) {
          b.buffer.shift();
          n++;
        }
        w.lading = { goed: g, n };
        const p = brengPlek(s, g, w);
        W.taken.set(w.id, { klus: 'breng', doel: g, x: p.x, y: p.y });
        stuur(s, [w.id], p.x, p.y);
      }
    } else if (t.klus === 'breng') {
      if (!w.lading && w.taak === 'rust') W.taken.delete(w.id); // de kern heeft hem al in de opslag gelegd
      else if (daar(w, t)) {
        if (w.lading) v[w.lading.goed] = Math.min(opslagMax(s, w.lading.goed), (v[w.lading.goed] ?? 0) + w.lading.n);
        w.lading = null;
        W.taken.delete(w.id);
      }
    }
  }
  i.fabricator.ploeg = ploeg;

  // telling voor het paneel
  const tel = { bouw: 0, fab: 0, haal: 0, breng: 0, graaf: 0, vrij: 0 };
  for (const w of s.werkers) {
    const t = W.taken.get(w.id);
    if (t) tel[t.klus]++;
    else if (w.taak === 'rust') tel.vrij++;
    else tel.graaf++;
  }
  W.telling = tel;

  // werk uitdelen, niet elke tik
  W.klok += sec;
  if (W.klok < 0.3) return;
  W.klok = 0;
  const vrij = s.werkers.filter((w) => !W.taken.has(w.id) && w.taak === 'rust');
  // een vrije muis met nog een lading: eerst wegbrengen
  for (const w of vrij.filter((x) => x.lading)) {
    const p = brengPlek(s, w.lading!.goed, w);
    W.taken.set(w.id, { klus: 'breng', doel: w.lading!.goed, x: p.x, y: p.y });
    stuur(s, [w.id], p.x, p.y);
  }
  const beschikbaar = vrij.filter((w) => !w.lading);
  // gravers zonder lading die op weg zijn naar een veld mogen ook ander werk gaan doen
  const gravers = s.werkers.filter((w) => w.taak === 'naarBron' && !w.lading && (!W.taken.has(w.id) || W.taken.get(w.id)!.klus === 'graaf'));
  const geef = (n: number, x: number, y: number, maak: (w: Werker) => Taak) => {
    for (let k = 0; k < n; k++) {
      const lijst = beschikbaar.length ? beschikbaar : gravers;
      if (!lijst.length) return;
      let bi = 0, bd = Infinity;
      for (let j = 0; j < lijst.length; j++) {
        const d = Math.hypot(lijst[j].x - x, lijst[j].y - y);
        if (d < bd) [bi, bd] = [j, d];
      }
      const w = lijst.splice(bi, 1)[0];
      const t = maak(w);
      W.taken.set(w.id, t);
      stuur(s, [w.id], t.x, t.y);
    }
  };

  // 1. bouwen
  for (const b of i.boren) if (b.af && !b.vlieg) need(b.id, G.ploegBouw, blok2(b));
  for (const p of i.stapels) if (p.af) need(p.id, G.ploegBouw, blok2(p));
  for (const p of i.palen) if (p.af) need(p.id, 1, { x: p.x, y: p.y, breed: 1, diep: 1 });
  for (const [k, t] of i.banden) if (t.af) need(`b${k}`, 1, { x: t.x, y: t.y, breed: 1, diep: 1 }, true);
  function need(doel: number | string, max: number, b: { x: number; y: number; breed: number; diep: number }, op = false) {
    const n = max - (aantal.get(doel) ?? 0);
    if (n <= 0) return;
    const c = midden(b);
    geef(n, c.x, c.y, (w) => {
      const p = op ? { x: b.x + (hash01(w.id) - 0.5) * 0.4, y: b.y + (hash01(w.id + 5) - 0.5) * 0.4 } : randPlek(b, w.id);
      return { klus: 'bouw', doel, ...p };
    });
  }
  // 2. fabriceren
  const fb = vast(s).fabricator;
  if (i.fabricator.rij.length && gevoed(s, fb)) {
    const c = midden(fb);
    geef(G.fabricator.ploeg - (aantal.get('fab') ?? 0), c.x, c.y, (w) => ({ klus: 'fab', doel: 'fab', ...randPlek(fb, w.id) }));
  }
  // 3. boren zonder band leeghalen (alleen als er plek in de opslag is)
  const ruimte = (g: Grondstof) => opslagMax(s, g) - (v[g] ?? 0);
  for (const b of i.boren as Boor[]) {
    if (b.af || b.vlieg || !b.buffer.length || boorHeeftBand(i, b) || ruimte(b.buffer[0]) <= 0) continue;
    const n = Math.min(4, Math.ceil(b.buffer.length / DRAAGT)) - (aantal.get(b.id) ?? 0);
    if (n > 0) geef(n, b.x + 0.5, b.y + 0.5, (w) => ({ klus: 'haal', doel: b.id, ...randPlek(blok2(b), w.id) }));
  }
  // 4. zelf graven, alleen waar nog plek voor is; de grondstof die het leegst is eerst
  const volgorde = GRONDSTOFFEN.filter((g) => ruimte(g) > 4 && s.kaart.afzettingen.some((a) => a.goed === g && a.rest > 0)).sort((a, b) => (v[a] ?? 0) / opslagMax(s, a) - (v[b] ?? 0) / opslagMax(s, b));
  // wie graaft voor een volle grondstof, stopt (de lading brengt hij nog weg)
  for (const w of gravers) {
    const a = s.kaart.afzettingen[w.bron];
    if (a && ruimte(a.goed) <= 0) {
      w.taak = 'rust';
      w.bron = -1;
      W.taken.delete(w.id);
    }
  }
  if (!volgorde.length) return;
  for (const w of beschikbaar.splice(0)) {
    let beste = null as null | { x: number; y: number }, bd = Infinity;
    for (const g of volgorde.slice(0, 2))
      for (const a of s.kaart.afzettingen) {
        if (a.goed !== g || a.rest <= 0) continue;
        const d = Math.hypot(a.x - w.x, a.y - w.y) + (g === volgorde[0] ? 0 : 6);
        if (d < bd) [beste, bd] = [a, d];
      }
    if (!beste) continue;
    W.taken.set(w.id, { klus: 'graaf', doel: '', x: beste.x, y: beste.y });
    stuur(s, [w.id], beste.x, beste.y);
  }
}

export function werkTrucje(eenheden: EenheidSoort[]): Trucje {
  DRAAGT = eenheden.find((e) => e.soort === 'muis')?.werk?.draagt ?? 2;
  return { naam: 'Werk', opTik: stapWerk };
}
