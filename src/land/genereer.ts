// De dimensiegenerator: een dimensie komt uit de run-seed en haar nummer, dus dezelfde seed geeft dezelfde run.
// Stappen (plan, "Procedural generation"): familie, archetype, klimaat, gedeelde grondstoffen, unieke grondstoffen,
// naam. Native sites en shift-regels komen later. Geen DOM of Pixi: werkt ook in een los script of artifact.
import type { Archetype, Dimensie, Familie, GedeeldeGrondstof, GrondstofAanbod } from '../kern/types';
import { ARCHETYPES, KLIMAAT_KANS, KLIMATEN, NAAMDELEN, PER_FAMILIE } from './archetypes';

const GEDEELD: GedeeldeGrondstof[] = ['metaal', 'hout', 'water', 'steen'];

// Vaste stroom uit een getal (mulberry32), los van de spelstaat: de generator verbruikt het spel-toeval niet.
function stroom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const kies = <T>(r: () => number, lijst: readonly T[]): T => lijst[Math.min(lijst.length - 1, Math.floor(r() * lijst.length))];
function weeg<T>(r: () => number, lijst: readonly T[], gewicht: (t: T) => number): T {
  const totaal = lijst.reduce((a, t) => a + gewicht(t), 0);
  let n = r() * totaal;
  for (const t of lijst) if ((n -= gewicht(t)) < 0) return t;
  return lijst[lijst.length - 1];
}

// Run-diepte waarop we de stroom per dimensie ontkoppelen: nummer en seed samen.
const dimSeed = (seed: number, nummer: number): number => (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(nummer, 0xc2b2ae35)) >>> 0;

// De familie komt uit een dek dat de hele run doorloopt: nooit dezelfde familie twee keer achter elkaar en een bijzondere
// dimensie hooguit eens per drie sprongen. Daarom hangt dimensie n af van de geschiedenis (1..n-1), maar blijft die vast per seed.
function families(seed: number, tot: number): Familie[] {
  const r = stroom(dimSeed(seed, 0));
  const lijst: Familie[] = [];
  for (let n = 1; n <= tot; n++) {
    const vorige = lijst[n - 2];
    const laatsteBijzonder = lijst.slice(-2).includes('bijzonder');
    const keuze = weeg<Familie>(r, ['beschaving', 'wildernis', 'bijzonder'], f => (f === vorige ? 0 : f === 'bijzonder' ? (laatsteBijzonder || n === 1 ? 0 : 0.5 + n * 0.06) : f === 'beschaving' ? 1.2 : 1));
    lijst.push(keuze);
  }
  return lijst;
}

// De drie landen zijn het eerste half uur steeds nieuw; vanaf nummer 9 (de finale) leidt de generator niets meer: dat is een
// vaste dimensie, zie het plan. Hier alleen 1..8 en daarna gewoon door voor de galerij.
// De archetypes wisselen ook: hetzelfde archetype kan pas weer terugkomen als het niet in de vorige twee zat.
export function genereerDimensie(seed: number, nummer: number, opties: { familie?: Familie; archetype?: Archetype } = {}): Dimensie {
  const fam = families(seed, nummer);
  const vorige: Archetype[] = [];
  for (let n = 1; n < nummer; n++) vorige.push(rol(seed, n, fam[n - 1], vorige.slice(-2)).archetype);
  return rol(seed, nummer, opties.familie ?? fam[nummer - 1], vorige.slice(-2), opties.archetype);
}

function rol(seed: number, nummer: number, f: Familie, vermijd: Archetype[], gedwongen?: Archetype): Dimensie {
  if (gedwongen) f = ARCHETYPES[gedwongen].familie;
  const r = stroom(dimSeed(seed, nummer));

  // 2. archetype. Beschavingen worden later in de run later in de tijd.
  const lijst = PER_FAMILIE[f];
  const diepte = Math.min(1, (nummer - 1) / 7);
  const archetype: Archetype = gedwongen ?? weeg(r, lijst, a => {
    if (vermijd.includes(a) && lijst.length > vermijd.length) return 0;
    if (f !== 'beschaving') return 1;
    const i = lijst.indexOf(a) / (lijst.length - 1); // 0 = oudst, 1 = nieuwst
    return 0.15 + Math.max(0, 1 - Math.abs(i - diepte) * 1.8);
  });
  const info = ARCHETYPES[archetype];

  // 3. klimaat
  const klimaat = kies(r, KLIMATEN);

  // 4. gedeelde grondstoffen: elk heeft een kans uit archetype maal klimaat. Minstens twee bestaan altijd.
  const kansen = GEDEELD.map(g => ({ g, k: Math.min(0.97, info.kans[g] * KLIMAAT_KANS[klimaat][g]), worp: r() }));
  const aanwezig = new Set(kansen.filter(x => x.worp < x.k).map(x => x.g));
  for (const x of [...kansen].sort((a, b) => b.k - a.k)) { // te weinig? voeg de waarschijnlijkste toe
    if (aanwezig.size >= 2) break;
    aanwezig.add(x.g);
  }
  const aanbod: GrondstofAanbod[] = GEDEELD.filter(g => aanwezig.has(g)).map(g => ({ goed: g, gewicht: +(0.6 + r() * 1.2).toFixed(2) }));

  // 5. unieke grondstoffen: 1 of 2 uit de archetypelijst
  const pool = [...info.uniek];
  const aantal = pool.length > 1 && r() < 0.6 ? 2 : 1;
  const uniek = [];
  for (let i = 0; i < aantal; i++) uniek.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  for (const u of uniek) aanbod.push({ goed: u.id, gewicht: +(0.8 + r() * 1.0).toFixed(2) });

  // Loot: de plannen waarvan de unieke grondstof er ligt (of die er geen nodig hebben).
  const ids = new Set(uniek.map(u => u.id));
  const loot = info.loot.filter(l => !l.vereist || ids.has(l.vereist) || r() < 0.2).map(l => ({ ...l }));
  if (loot.length === 0) loot.push({ ...info.loot[info.loot.length - 1] });

  // Landing (voor de bijbehorende Wrath): wordt later een echte plek op de kaart; nu alleen het getal.
  const plek = weeg(r, info.beginWrathPlekken, p => p.gewicht);
  const opening = Math.round(plek.wrath[0] + r() * (plek.wrath[1] - plek.wrath[0]) + (nummer - 1) * 2); // dieper in de run = kwader

  return {
    nummer,
    seed: dimSeed(seed, nummer),
    naam: maakNaam(r, archetype),
    familie: f,
    archetype,
    klimaat,
    aanbod,
    uniek,
    loot,
    kaart: info.kaart,
    beginWrath: Math.min(70, opening),
    sterkte: +(1 + (nummer - 1) * 0.12).toFixed(2),
  };
}

function maakNaam(r: () => number, archetype: Archetype): string {
  const info = ARCHETYPES[archetype];
  const d = NAAMDELEN[info.naamStijl];
  const begin = kies(r, d.begin);
  const eind = kies(r, d.eind);
  const n = info.naamStijl === 'nest' ? `${begin}${eind}` : begin + eind.replace(/^-/, '').toLowerCase();
  return info.naamVorm.replace('{n}', n.charAt(0).toUpperCase() + n.slice(1));
}

// Een hele run in één keer (voor de galerij en de rooktest): dimensies 1..n van één seed.
export function genereerRun(seed: number, aantal = 8): Dimensie[] {
  const fam = families(seed, aantal);
  const uit: Dimensie[] = [];
  for (let n = 1; n <= aantal; n++) uit.push(rol(seed, n, fam[n - 1], uit.slice(-2).map(d => d.archetype)));
  return uit;
}
