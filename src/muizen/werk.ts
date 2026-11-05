// Muizen werken zelf. Een muis die niets te doen heeft zoekt werk, in deze volgorde:
//   0. rennen: in het looprad, als dat aan staat (zoveel als de stand vraagt)
//   1. bouwen: spullen uit de opslag naar de bouwplek brengen, en dan de bouwplek afmaken
//      (fabricator, boor, band, paal, stapel)
//   2. fabriceren: in een fabricator werken die een recept heeft, en hem zijn grondstof brengen
//   3. sjouwen: een boor of fabricator zonder band leeghalen en het naar de stapel of de opslag brengen
//   4. graven: zelf grondstof halen uit het dichtstbijzijnde veld waar nog plek voor is in de opslag,
//      maar alleen de bovenkant van een tegel (HAND_DEEL); de rest kan alleen een drill
// Je kunt muizen nog steeds verplaatsen of naar een veld sturen; daarna zoeken ze werk vanaf waar ze staan.
// Het lopen, graven en sjouwen naar de opslag doet de kern (werkers.ts); dit trucje kiest alleen het werk.
import type { SpelStaat } from '../kern/spel';
import type { EenheidSoort, Goed, Grondstof, Trucje, Voorraad } from '../kern/types';
import { stuur, type Werker } from '../kern/werkers';
import { hash01 } from '../kern/toeval';
import {
  blok2, getallen, gevoed, GRONDSTOFFEN, heeftBand, industrie, invoerMax, leeg, midden, opslagMax, vast, type Maker,
} from './industrie';
import { energie, log } from './energie';
import { VELDEN } from '../data/dimensies';
import { naamVan } from './kosten';

export type Klus = 'ren' | 'bouw' | 'fab' | 'haal' | 'breng' | 'graaf' | 'lever';
interface Taak {
  klus: Klus;
  doel: number | string; // id van het ding, `b`+tegelsleutel van een band, `in`+id voor de invoer van een fabricator
  x: number;
  y: number;
  // lever: eerst ophalen in de opslag (pak), dan naar het doel brengen
  goed?: Goed;
  n?: number;
  fase?: 'pak' | 'breng';
  van?: string; // lever: waar hij het pakt: '' = opslag/stapel, `m`+id = bij een drill of fabricator op de grond, `b`+tegel = van een belt
}
interface WerkStaat {
  taken: Map<number, Taak>;
  klok: number;
  telling: Record<Klus | 'vrij', number>;
}
const STATEN = new WeakMap<SpelStaat, WerkStaat>();
let DRAAGT = 2;
let HAND = 0.15;
// zo diep mag een muis met de hand graven: daaronder blijft het liggen voor een drill
const handGrens = (a: { goed: Grondstof }) => VELDEN[a.goed].perTegel * (1 - HAND);
const handOp = (a: { goed: Grondstof; rest: number }) => a.rest - handGrens(a) >= DRAAGT;
const handLeegGemeld = new WeakMap<SpelStaat, Set<string>>();

export function werk(s: SpelStaat): WerkStaat {
  let w = STATEN.get(s);
  if (!w) {
    w = { taken: new Map(), klok: 0, telling: { ren: 0, bouw: 0, fab: 0, haal: 0, breng: 0, graaf: 0, lever: 0, vrij: 0 } };
    STATEN.set(s, w);
  }
  return w;
}

// de kern zet een doel op een klip of tegen een gebouw net ernaast neer: dichtbij is goed genoeg
const daar = (w: Werker, t: Taak) => w.taak === 'rust' && Math.hypot(w.x - t.x, w.y - t.y) < 1;

// Een plekje langs de rand van een blok, voor elke muis een eigen.
function randPlek(b: { x: number; y: number; breed: number; diep: number }, id: number): { x: number; y: number } {
  const h = hash01(id * 7 + 3), z = Math.floor(hash01(id * 13 + 1) * 4);
  const l = b.x - 0.8, t = b.y - 0.8, r = b.x + b.breed - 0.2, o = b.y + b.diep - 0.2;
  return [{ x: l + (r - l) * h, y: o }, { x: r, y: t + (o - t) * h }, { x: l + (r - l) * h, y: t }, { x: l, y: t + (o - t) * h }][z];
}

// Waar haal je iets op? De opslag of een stapel van dat goed, wat het dichtst bij is (een plekje langs de rand).
function pakPlek(s: SpelStaat, g: Goed, w: Werker): { x: number; y: number } {
  const blokken = [s.kaart.opslag, vast(s).erf, ...industrie(s).stapels.filter((p) => p.goed === g && !p.af).map(blok2)];
  let beste = blokken[0], bd = Infinity;
  for (const b of blokken) {
    const c = midden(b), d = Math.hypot(c.x - w.x, c.y - w.y);
    if (d < bd) [beste, bd] = [b, d];
  }
  return randPlek(beste, w.id);
}

// Waar breng je een goed heen? Naar de stapel voor dat goed met de hoogste prio (bij gelijke prio de dichtstbijzijnde),
// anders de opslag.
function brengPlek(s: SpelStaat, g: Goed, w: Werker): { x: number; y: number } {
  const alle = industrie(s).stapels.filter((p) => p.goed === g && !p.af);
  const top = Math.max(-1, ...alle.map((p) => p.prio));
  const st = alle.filter((p) => p.prio === top);
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
  const bouwplek = new Map<number | string, { af: number; nodig: Voorraad }>();
  for (const b of i.boren) if (b.af && !b.vlieg) bouwplek.set(b.id, b);
  for (const p of [...i.palen, ...i.stapels, ...i.fabrieken]) if (p.af) bouwplek.set(p.id, p);
  for (const [k, t] of i.banden) if (t.af) bouwplek.set(`b${k}`, t);
  const aantal = new Map<number | string, number>();
  const rad = energie(s).bronnen.find((b) => b.renners);
  let rennen = 0;
  const onderweg = new Map<string, number>(); // "doel:goed" -> hoeveel er al gehaald of gebracht wordt
  const gepland = new Map<Goed, number>(); // nog op te halen uit de opslag
  const geplandBij = new Map<string, number>(); // "van:goed" -> nog op te halen van de grond of een belt
  // Waar muizen spullen naartoe brengen: bouwplekken (wat nog nodig is) en fabricators (hun invoer).
  const dingen = [...i.boren, ...i.palen, ...i.stapels, ...i.fabrieken];
  const leverDoel = (doel: number | string) => {
    const plek = bouwplek.get(doel);
    if (plek) {
      let b;
      if (typeof doel === 'string') {
        const t = i.banden.get(+doel.slice(1));
        if (!t) return null;
        b = { x: t.x, y: t.y, breed: 1, diep: 1 };
      } else {
        const x = dingen.find((q) => q.id === doel);
        if (!x) return null;
        b = i.palen.includes(x) ? { x: x.x, y: x.y, breed: 1, diep: 1 } : blok2(x);
      }
      return {
        blok: b,
        soorten: Object.keys(plek.nodig),
        wil: (g: Goed) => plek.nodig[g] ?? 0,
        krijg: (g: Goed, n: number) => {
          const nodig = plek.nodig[g] ?? 0;
          if (n > nodig) v[g] = (v[g] ?? 0) + n - nodig; // te veel gebracht: terug in de opslag
          plek.nodig[g] = Math.max(0, nodig - n);
        },
      };
    }
    const f = typeof doel === 'string' && doel.startsWith('in') ? i.fabrieken.find((x) => x.id === +doel.slice(2)) : undefined;
    if (!f || f.af || !f.recept) return null;
    return {
      blok: blok2(f),
      soorten: Object.keys(G.recepten[f.recept].in),
      wil: (g: Goed) => invoerMax(f, g) - (f.invoer[g] ?? 0),
      krijg: (g: Goed, n: number) => {
        if (G.recepten[f.recept!].in[g]) f.invoer[g] = (f.invoer[g] ?? 0) + n;
        else v[g] = (v[g] ?? 0) + n; // recept is intussen veranderd: terug in de opslag
      },
    };
  };
  const ploeg = new Map<number, number>();
  const makers: Maker[] = [...i.boren, ...i.fabrieken];
  // Iets oppakken waar het ligt: uit de opslag, bij een drill of fabricator op de grond, of van een belt. Geeft hoeveel.
  const pak = (van: string, g: Goed, n: number): number => {
    if (van.startsWith('m')) {
      const b = makers.find((x) => x.id === +van.slice(1));
      if (!b) return 0;
      let k = 0;
      for (let j = b.buffer.length - 1; j >= 0 && k < n; j--) if (b.buffer[j] === g) {
        b.buffer.splice(j, 1);
        k++;
      }
      return k;
    }
    if (van.startsWith('b')) {
      const bt = i.banden.get(+van.slice(1));
      if (!bt || bt.goed !== g) return 0;
      bt.goed = undefined;
      bt.voortgang = 0;
      return 1;
    }
    const k = Math.min(n, Math.floor(v[g] ?? 0));
    v[g] = (v[g] ?? 0) - k;
    return k;
  };
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
    if (t.klus === 'ren') {
      if (!rad || !rad.aan || !rad.mk) {
        W.taken.delete(w.id);
        continue;
      }
      aantal.set('rad', (aantal.get('rad') ?? 0) + 1);
      if (daar(w, t)) rennen++;
      continue;
    }
    if (t.klus === 'bouw') {
      const plek = bouwplek.get(t.doel);
      if (!plek) {
        W.taken.delete(w.id);
        continue;
      }
      aantal.set(t.doel, (aantal.get(t.doel) ?? 0) + 1);
      if (daar(w, t) && leeg(plek.nodig)) plek.af = Math.max(0, plek.af - sec);
    } else if (t.klus === 'lever') {
      const sleutel = `${t.doel}:${t.goed}`;
      onderweg.set(sleutel, (onderweg.get(sleutel) ?? 0) + (t.n ?? 0));
      aantal.set(`l${t.doel}`, (aantal.get(`l${t.doel}`) ?? 0) + 1);
      if (t.fase === 'pak') {
        if (t.van) geplandBij.set(`${t.van}:${t.goed}`, (geplandBij.get(`${t.van}:${t.goed}`) ?? 0) + (t.n ?? 0));
        else gepland.set(t.goed!, (gepland.get(t.goed!) ?? 0) + (t.n ?? 0));
        // bij de opslag zet de kern een muis soms net ergens anders neer: dichtbij is goed genoeg
        if (w.taak !== 'rust') continue;
        if (Math.hypot(w.x - t.x, w.y - t.y) > (t.van?.startsWith('b') ? 1.5 : 2.5)) {
          stuur(s, [w.id], t.x, t.y);
          continue;
        }
        const d = leverDoel(t.doel);
        const neem = d ? pak(t.van ?? '', t.goed!, t.n ?? 0) : 0;
        if (neem <= 0 || !d) {
          W.taken.delete(w.id);
          continue;
        }
        w.lading = { goed: t.goed as Grondstof, n: neem }; // de kern noemt het Grondstof, maar het mag elk goed zijn
        const p = randPlek(d.blok, w.id);
        Object.assign(t, { fase: 'breng', n: neem, x: p.x, y: p.y });
        stuur(s, [w.id], p.x, p.y);
      } else {
        const d = leverDoel(t.doel);
        if (!d || !w.lading) W.taken.delete(w.id); // doel weg: een vrije muis met lading brengt hem terug naar de opslag
        else if (w.taak === 'rust' && Math.hypot(w.x - t.x, w.y - t.y) > 1.5) stuur(s, [w.id], t.x, t.y);
        else if (w.taak === 'rust') {
          d.krijg(w.lading.goed, w.lading.n);
          w.lading = null;
          W.taken.delete(w.id);
        }
      }
    } else if (t.klus === 'fab') {
      const f = i.fabrieken.find((x) => x.id === t.doel);
      if (!f || f.af || !f.recept) {
        W.taken.delete(w.id);
        continue;
      }
      aantal.set(`f${f.id}`, (aantal.get(`f${f.id}`) ?? 0) + 1);
      if (daar(w, t)) ploeg.set(f.id, (ploeg.get(f.id) ?? 0) + 1);
    } else if (t.klus === 'haal') {
      const b = makers.find((x) => x.id === t.doel);
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
        w.lading = { goed: g as Grondstof, n }; // de kern noemt het Grondstof, maar telt elk goed op in de opslag
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
  for (const f of i.fabrieken) f.ploeg = ploeg.get(f.id) ?? 0;
  if (rad) rad.rennen = rennen;

  // telling voor het paneel
  const tel = { ren: 0, bouw: 0, fab: 0, haal: 0, breng: 0, graaf: 0, lever: 0, vrij: 0 };
  for (const w of s.werkers) {
    const t = W.taken.get(w.id);
    if (t) tel[t.klus]++;
    else if (w.taak === 'rust') tel.vrij++;
    else tel.graaf++;
  }
  W.telling = tel;
  handGraven(s);

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
  // (ook als ze al aan het graven zijn: brengen en bouwen gaat voor zelf graven)
  const gravers = s.werkers.filter((w) => (w.taak === 'naarBron' || w.taak === 'graven') && !w.lading && (!W.taken.has(w.id) || W.taken.get(w.id)!.klus === 'graaf'));
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

  // Waar ligt goed g het dichtst bij c, en hoeveel kan je daar nog pakken (min wat al gepland is)?
  const bron = (g: Goed, c: { x: number; y: number }) => {
    let beste = null as null | { van: string; n: number; x: number; y: number }, bd = Infinity;
    const kijk = (van: string, n: number, x: number, y: number) => {
      if (n <= 0) return;
      const d = Math.hypot(x - c.x, y - c.y);
      if (d < bd) [beste, bd] = [{ van, n, x, y }, d];
    };
    const o = midden(s.kaart.opslag);
    kijk('', Math.floor(v[g] ?? 0) - (gepland.get(g) ?? 0), o.x, o.y);
    for (const m of makers) {
      if ((m as { vlieg?: number }).vlieg || m.af) continue;
      const n = m.buffer.filter((x) => x === g).length - (geplandBij.get(`m${m.id}:${g}`) ?? 0);
      const p = randPlek(blok2(m), m.id);
      kijk(`m${m.id}`, n, p.x, p.y);
    }
    for (const [k, bt] of i.banden) if (!bt.af && bt.goed === g) kijk(`b${k}`, 1 - (geplandBij.get(`b${k}:${g}`) ?? 0), bt.x + 0.5, bt.y + 0.5);
    return beste as null | { van: string; n: number; x: number; y: number };
  };
  // Spullen brengen: haal wat het doel nog wil hebben uit de opslag, van de grond of van een belt.
  const lever = (doel: number | string, maxMuizen: number) => {
    const d = leverDoel(doel);
    if (!d) return;
    let muizen = maxMuizen - (aantal.get(`l${doel}`) ?? 0);
    for (const g of d.soorten) {
      let wil = d.wil(g) - (onderweg.get(`${doel}:${g}`) ?? 0);
      while (wil > 0 && muizen > 0) {
        if (!beschikbaar.length && !gravers.length) return; // geen muizen meer vrij
        const c = midden(d.blok);
        // dichtstbij het doel: de opslag, iets op de grond bij een drill of fabricator, of op een belt
        const b = bron(g, c);
        const n = Math.min(DRAAGT, wil, b?.n ?? 0);
        if (!b || n <= 0) break;
        geef(1, c.x, c.y, (w) => ({ klus: 'lever', doel, goed: g, n, fase: 'pak', van: b.van, ...(b.van ? { x: b.x, y: b.y } : pakPlek(s, g, w)) }));
        if (b.van) geplandBij.set(`${b.van}:${g}`, (geplandBij.get(`${b.van}:${g}`) ?? 0) + n);
        else gepland.set(g, (gepland.get(g) ?? 0) + n);
        onderweg.set(`${doel}:${g}`, (onderweg.get(`${doel}:${g}`) ?? 0) + n);
        wil -= n;
        muizen--;
      }
    }
  };

  // 0. rennen in het looprad: zonder stroom geen fabricator en geen boor
  if (rad?.aan && rad.mk && rad.renners) {
    const rb = vast(s).bronnen[rad.id], c = midden(rb);
    const teveel = (aantal.get('rad') ?? 0) - rad.renners[rad.stand];
    // stand lager gezet: wie te veel is, stapt uit
    if (teveel > 0) for (const [id, t] of [...W.taken].filter(([, t]) => t.klus === 'ren').slice(0, teveel)) {
      W.taken.delete(id);
      void t;
    }
    geef(rad.renners[rad.stand] - (aantal.get('rad') ?? 0), c.x, c.y, (w) => ({
      klus: 'ren', doel: 'rad', x: rb.x + 0.5 + (hash01(w.id * 3) - 0.5) * 0.7, y: rb.y + 0.25 + hash01(w.id * 5 + 1) * 0.6,
    }));
  }

  // 1. bouwen: eerst de spullen erheen, dan bouwen
  for (const [doel, plek] of bouwplek) if (!leeg(plek.nodig)) lever(doel, 6);
  for (const b of i.boren) if (b.af && !b.vlieg && leeg(b.nodig)) need(b.id, G.ploegBouw, blok2(b));
  for (const p of [...i.stapels, ...i.fabrieken]) if (p.af && leeg(p.nodig)) need(p.id, G.ploegBouw, blok2(p));
  for (const p of i.palen) if (p.af && leeg(p.nodig)) need(p.id, 1, { x: p.x, y: p.y, breed: 1, diep: 1 });
  for (const [k, t] of i.banden) if (t.af && leeg(t.nodig)) need(`b${k}`, 1, { x: t.x, y: t.y, breed: 1, diep: 1 }, true);
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
  for (const f of i.fabrieken) {
    if (f.af || !f.recept || !gevoed(s, blok2(f))) continue;
    const fb = blok2(f), c = midden(fb);
    geef(G.fabricator.ploeg - (aantal.get(`f${f.id}`) ?? 0), c.x, c.y, (w) => ({ klus: 'fab', doel: f.id, ...randPlek(fb, w.id) }));
  }
  // en hun grondstof brengen
  for (const f of i.fabrieken) if (!f.af && f.recept) lever(`in${f.id}`, 4);
  // 3. boren zonder band leeghalen (alleen als er plek in de opslag is)
  const ruimte = (g: Goed) => opslagMax(s, g) - (v[g] ?? 0);
  for (const b of makers) {
    if (b.af || (b as { vlieg?: number }).vlieg || !b.buffer.length || heeftBand(i, b) || ruimte(b.buffer[0]) <= 0) continue;
    const n = Math.min(4, Math.ceil(b.buffer.length / DRAAGT)) - (aantal.get(b.id) ?? 0);
    if (n > 0) geef(n, b.x + 0.5, b.y + 0.5, (w) => ({ klus: 'haal', doel: b.id, ...randPlek(blok2(b), w.id) }));
  }
  // 4. zelf graven, alleen waar nog plek voor is; de grondstof die het leegst is eerst
  const volgorde = GRONDSTOFFEN.filter((g) => ruimte(g) > 4 && s.kaart.afzettingen.some((a) => a.goed === g && handOp(a))).sort((a, b) => (v[a] ?? 0) / opslagMax(s, a) - (v[b] ?? 0) / opslagMax(s, b));
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
        if (a.goed !== g || !handOp(a)) continue;
        const d = Math.hypot(a.x - w.x, a.y - w.y) + (g === volgorde[0] ? 0 : 6);
        if (d < bd) [beste, bd] = [a, d];
      }
    if (!beste) continue;
    W.taken.set(w.id, { klus: 'graaf', doel: '', x: beste.x, y: beste.y });
    stuur(s, [w.id], beste.x, beste.y);
  }
}

// Muizen die naar een tegel gaan (of erop graven) die met de hand leeg is: naar een andere tegel van dat goed
// waar nog bovenkant ligt, anders stoppen. Geldt ook als de speler ze zelf naar een veld stuurt.
function handGraven(s: SpelStaat): void {
  const gemeld = handLeegGemeld.get(s) ?? new Set<string>();
  handLeegGemeld.set(s, gemeld);
  // wat er per tegel nog met de hand af mag, min wat de muizen die er al zijn gaan meenemen
  const ruim = new Map<number, number>();
  const over = (a: { id: number; goed: Grondstof; rest: number }) => ruim.get(a.id) ?? a.rest - handGrens(a);
  for (const w of s.werkers) {
    if ((w.taak !== 'naarBron' && w.taak !== 'graven') || w.lading) continue;
    const a = s.kaart.afzettingen[w.bron];
    if (!a || a.rest <= 0) continue;
    if (over(a) >= DRAAGT) {
      ruim.set(a.id, over(a) - DRAAGT);
      continue;
    }
    let beste = null as null | typeof a, bd = Infinity;
    for (const b of s.kaart.afzettingen) {
      if (b.goed !== a.goed || b.rest <= 0 || over(b) < DRAAGT) continue;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d <= 6 && d < bd) [beste, bd] = [b, d];
    }
    if (beste) {
      ruim.set(beste.id, over(beste) - DRAAGT);
      w.bron = beste.id;
      w.taak = 'naarBron';
      stuur(s, [w.id], beste.x, beste.y);
      w.bron = beste.id;
      continue;
    }
    w.taak = 'rust';
    w.bron = -1;
    werk(s).taken.delete(w.id);
    const sleutel = `${s.dimensie}:${a.goed}:${Math.round(a.x / 8)}:${Math.round(a.y / 8)}`;
    if (!gemeld.has(sleutel)) {
      gemeld.add(sleutel);
      log(energie(s), `TOP OF ${naamVan(a.goed)} FIELD DUG OUT. DRILL THE REST`, 'amber');
    }
  }
}

export function werkTrucje(eenheden: EenheidSoort[], handDeel = 0.15): Trucje {
  HAND = handDeel;
  DRAAGT = eenheden.find((e) => e.soort === 'muis')?.werk?.draagt ?? 2;
  return { naam: 'Werk', opTik: stapWerk };
}
