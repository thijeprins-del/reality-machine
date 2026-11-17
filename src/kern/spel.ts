import { DIMENSIE_DUUR_SEC, economieVan, zetWereldBron, MIST_ZICHT_MACHINE, MIST_ZICHT_MUIS, SPRONG_SEC } from '../data/dimensies';
import { zetActieveEconomie } from './economie';
import { binnenRing, maakKaart, type Kaart } from './kaart';
import { werkMist, type Kijker } from './mist';
import { meet } from './prestatie';
import { HEEL_MIN_STREAM } from '../data/wrath';
import { FINALE, FINALE_TYPE, FINALE_WRATH, KERN_DIMENSIES, type Uitkomst } from '../data/run';
import { nieuwLand, rolDimensie, stapLand, typeUitTekst, type LandStaat } from '../land/wrath';
import type { Archetype } from './types';
import { hash01 } from './toeval';
import { wereldType } from './wereldtypes';
import type { Soort, Machine, Voorraad } from './types';
import { maakWerkers, stapWerkers, type Werker } from './werkers';

// Spelregels zonder tekenen. Toeval voor regels altijd via de seed (`toeval`), nooit Math.random.
export interface SpelStaat {
  seed: number;
  toeval: number; // stand van de toevalsstroom (zie toeval.ts)
  tijd: number; // seconden in de huidige dimensie
  dimensie: number; // hoeveelste dimensie
  onderweg: number; // seconden nog in het niets tussen twee dimensies (0 = geland)
  gemist: number; // zo vaak kwam de stream terwijl de machine geen volle stroom had
  start?: Start; // waarmee dit spel begon
  klokStil?: boolean; // testgereedschap: de tijd in deze dimensie loopt niet door, dus er komt geen stream
  kaart: Kaart;
  machine: Machine;
  voorraad: Voorraad; // wat er in de opslag ligt
  economieen: string[]; // de economieën waarin je deze run al geland bent (elk geeft één keer haar startkapitaal)
  werkers: Werker[];
  uitkomst?: Uitkomst; // gezet als de run voorbij is: gewonnen (finale gehaald) of verloren
  land: LandStaat; // de gerolde dimensie, Wrath en de overvallers (src/land/wrath.ts)
}

// Wat de URL of een test mag vastleggen voor de start: ?type= ?wrath= ?shift= (zie startUitAdres).
export interface Start {
  type?: Archetype; // type van de eerste dimensie
  wrath?: number; // Wrath bij de eerste landing
  shift?: number; // begin in deze dimensie in plaats van de eerste
  wereld?: string; // ?world=: wereldtype van de eerste dimensie (id van een bestand in worldtypes/)
  gratisStroom?: boolean; // ?power=free: de machine telt altijd als opgeladen (om de hele run te kunnen testen)
}

const dimCache = new Map<string, ReturnType<typeof rolDimensie>>();
function gerold(seed: number, nummer: number, type?: Archetype) {
  // De run: de drie kerndimensies staan vast, de finale ook; de rest rolt de generator.
  type ??= nummer === FINALE ? FINALE_TYPE : KERN_DIMENSIES[nummer - 1];
  const sleutel = `${seed}:${nummer}:${type ?? ''}`;
  let d = dimCache.get(sleutel);
  if (!d) dimCache.set(sleutel, (d = rolDimensie(seed, nummer, type)));
  return d;
}

export function nieuwSpel(seed: number, f: Soort, start: Start = {}): SpelStaat {
  const s = { toeval: seed >>> 0 };
  const eerste = Math.max(1, Math.floor(start.shift ?? 1));
  // De kaart, de kleuren en de economie volgen het wereldtype van de gerolde dimensie; het type uit de URL geldt alleen voor de eerste.
  zetWereldBron((n) => (n === eerste && start.wereld) || gerold(seed, n, n === eerste ? start.type : undefined).wereldtype);
  zetActieveEconomie(economieVan(eerste));
  const kaart = meet('generate map', () => maakKaart(seed, eerste));
  const werkers: Werker[] = [];
  for (const [soort, aantal] of Object.entries(f.startEenheden)) {
    const nieuw = maakWerkers(soort, aantal ?? 0, kaart, s);
    for (const w of nieuw) w.id = werkers.length + w.id;
    werkers.push(...nieuw);
  }
  const st: SpelStaat = {
    seed,
    toeval: s.toeval,
    tijd: 0,
    dimensie: eerste,
    gemist: 0,
    onderweg: SPRONG_SEC, // het spel begint in het niets en landt dan in de eerste wereld
    kaart,
    machine: { ...f.startMachine },
    voorraad: { ...economieVan(eerste).start }, // het startkapitaal van de economie van de eerste wereld
    economieen: [economieVan(eerste).id],
    werkers,
    land: undefined as unknown as LandStaat,
  };
  st.land = nieuwLand(st, gerold(seed, eerste, start.type), start.wrath ?? (eerste === FINALE ? FINALE_WRATH : undefined));
  st.start = start;
  return st;
}

const klaarVoorStream = (s: SpelStaat): boolean => (s.start?.gratisStroom || s.machine.energie >= s.machine.maxEnergie) && s.machine.heelheid >= HEEL_MIN_STREAM;

export function verlies(s: SpelStaat, reden: string): void {
  if (!s.uitkomst) s.uitkomst = { gewonnen: false, reden };
}

export function stap(s: SpelStaat, f: Soort, sec: number): void {
  if (s.uitkomst) return; // de run is voorbij
  if (s.onderweg > 0) {
    // in het niets: niemand loopt, de klok staat stil, alleen het trucje (stroomnet) draait
    s.onderweg = Math.max(0, s.onderweg - sec);
    f.trucje.opTik?.(s, sec);
    return;
  }
  stapWerkers(s, f.eenheden, sec);
  werkMist(s.kaart.mist, sec, () => kijkers(s));
  f.trucje.opTik?.(s, sec);
  stapLand(s, sec);
  if (s.machine.heelheid <= 0) { verlies(s, 'The reality machine was torn apart by the land.'); return; }
  if (!s.klokStil) s.tijd += sec;
  while (s.tijd >= DIMENSIE_DUUR_SEC) {
    s.tijd -= DIMENSIE_DUUR_SEC;
    // Alleen met volle stroom en genoeg heelheid op dat moment haal je de stream; anders is de run voorbij.
    if (!klaarVoorStream(s)) { s.gemist += 1; verlies(s, `The stream came at dimension ${s.dimensie} and the machine was not ready (power ${Math.floor(s.machine.energie)}/${s.machine.maxEnergie}, integrity ${Math.floor(s.machine.heelheid)}).`); return; }
    if (s.dimensie >= FINALE) { s.uitkomst = { gewonnen: true, reden: 'The last stream carried your disc out of the Hostile Land.' }; return; }
    stream(s, f);
  }
}

// Vroeg springen: de stream komt nu in plaats van aan het eind van de klok. Dezelfde regels als de gewone stream:
// is de machine niet klaar, dan is de run voorbij. Tijdens de sprong zelf of na het eind doet het niets.
export const kanVroegSpringen = (s: SpelStaat): boolean => !s.uitkomst && s.onderweg <= 0;
export const machineKlaar = (s: SpelStaat): boolean => klaarVoorStream(s);
export function vroegStream(s: SpelStaat): boolean {
  if (!kanVroegSpringen(s)) return false;
  s.tijd = DIMENSIE_DUUR_SEC; // de volgende stap handelt de stream af, met dezelfde controle als altijd
  return true;
}

// De stream: alles binnen de gele ring springt naar de volgende dimensie. Daar liggen nieuwe grondstoffen.
export function stream(s: SpelStaat, f?: Soort): void {
  s.dimensie += 1;
  s.tijd = 0;
  s.onderweg = SPRONG_SEC;
  const eco = economieVan(s.dimensie);
  zetActieveEconomie(eco); // de nieuwe wereld heeft haar eigen grondstoffen en gebouwen
  verhuis(s);
  // De eerste keer in een economie krijg je haar startkapitaal erbij: genoeg om er de eerste gebouwen van te zetten.
  if (!s.economieen.includes(eco.id)) {
    s.economieen.push(eco.id);
    for (const [g, n] of Object.entries(eco.start)) s.voorraad[g] = (s.voorraad[g] ?? 0) + (n ?? 0);
  }
  s.land = nieuwLand(s, gerold(s.seed, s.dimensie), s.dimensie === FINALE ? FINALE_WRATH : undefined); // de landing zet het beginpunt van Wrath
  f?.trucje.opStream?.(s);
}


function verhuis(s: SpelStaat): void {
  const oud = s.kaart.machine;
  s.kaart = meet('generate map', () => maakKaart(s.seed, s.dimensie)); // zelfde machine en opslag, nieuw terrein en nieuwe velden
  // Een wereld van een andere maat heeft zijn midden ergens anders: alles op de schijf verhuist mee.
  const dx = s.kaart.machine.x - oud.x, dy = s.kaart.machine.y - oud.y;
  for (const w of s.werkers) {
    w.x += dx;
    w.y += dy;
  }
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

// Wie de wereld ziet: de machine (de hele ring en een stuk eromheen) en elke eenheid.
function kijkers(s: SpelStaat): Kijker[] {
  const r = s.kaart.ring;
  return [{ x: r.x, y: r.y, r: r.r + MIST_ZICHT_MACHINE }, ...s.werkers.map((w) => ({ x: w.x, y: w.y, r: MIST_ZICHT_MUIS }))];
}

export function restTijd(s: SpelStaat): number {
  return Math.max(0, DIMENSIE_DUUR_SEC - s.tijd);
}

export function seedUitAdres(): number {
  const p = new URLSearchParams(location.search).get('seed');
  const n = p === null ? NaN : Number(p);
  return Number.isFinite(n) ? n : Date.now() % 1_000_000;
}

// ?type=stone ?world=zoutzee ?wrath=80 ?shift=4: spring in de URL meteen naar een wereld of een Wrath-niveau (voor testen).
export function startUitAdres(): Start {
  const p = new URLSearchParams(location.search);
  const start: Start = {};
  const type = typeUitTekst(p.get('type'));
  if (p.get('type') && !type) console.warn(`?type=${p.get('type')} is unknown; use e.g. stone, antiquity, medieval, industrial, modern, scifi, bugs, monsters, hordes, giants, aliens, tentacle`);
  if (type) start.type = type;
  const w = p.get('wrath'), sh = p.get('shift');
  if (w !== null && Number.isFinite(Number(w))) start.wrath = Number(w);
  if (p.get('power') === 'free') start.gratisStroom = true;
  const wereld = p.get('world');
  if (wereld && wereldType(wereld)) start.wereld = wereld;
  else if (wereld) console.warn(`?world=${wereld} is unknown; use the id of a file in worldtypes/`);
  if (sh !== null && Number.isFinite(Number(sh))) start.shift = Number(sh);
  return start;
}
