// De gegevens per archetype en klimaat voor de dimensiegenerator. Alleen getallen en namen, geen regels.
// Elk archetype is één JSON-bestand in worldtypes/archetypes/ (naam, grondstoffen, loot, vijand); dit bestand leest en controleert ze.
// Zie DESIGN.md "Het land" en het plan (Procedural generation).
import { ARCHETYPE_BESTANDEN } from '../../worldtypes/archetypes/index';
import type { AanvalStijl } from '../data/run';
import type { Archetype, Familie, GedeeldeGrondstof, Klimaat, UniekeGrondstof } from '../kern/types';

// Een plaatje van een overvaller: de map in assets/land/ en de maat. anker = de voeten.
export interface VijandSprite { id: string; map: string; w: number; h: number; ankerX: number; ankerY: number }
export interface Vijand {
  overvallers: string[]; // sprite-id's; komt een id vaker voor, dan is hij vaker
  sprites: VijandSprite[];
  aanval?: AanvalStijl; // zonder: gewone overvallers uit het Wrath-stadium
}

export interface ArchetypeInfo {
  familie: Familie;
  naam: string; // zo heet het type in beeld ("STONE AGE")
  uniek: UniekeGrondstof[]; // hieruit komen er 1 of 2
  kans: Record<GedeeldeGrondstof, number>; // kans (0..1) dat een gedeelde grondstof bestaat, bovenop het klimaat
  aliassen: Partial<Record<GedeeldeGrondstof, string>>; // andere naam voor een gedeeld goed in dit type
  loot: { vondst: string; kans: number; vereist?: string }[];
  kaart: [number, number];
  beginWrathPlekken: { plek: string; wrath: [number, number]; gewicht: number }[];
  naamStijl: 'stam' | 'oud' | 'riddersland' | 'fabriek' | 'stad' | 'ster' | 'nest' | 'hol' | 'trek' | 'reus' | 'vreemd' | 'vlees';
  naamVorm: string; // sjabloon, {n} = gegenereerde naam
  ziet: string; // wat je ziet (korte omschrijving voor galerij en hulp)
  vecht: string; // waarmee het land terugvecht
  vijand?: Vijand; // zonder: de stam leent zijn overvallers uit
}

const PLEKKEN = [
  { plek: 'wilderness, far from anyone', wrath: [0, 10] as [number, number], gewicht: 4 },
  { plek: 'edge of their territory', wrath: [15, 30] as [number, number], gewicht: 3 },
  { plek: 'next to a site', wrath: [30, 50] as [number, number], gewicht: 2 },
  { plek: 'in the middle of it', wrath: [50, 70] as [number, number], gewicht: 1 },
];


type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const GEDEELDE: GedeeldeGrondstof[] = ['metaal', 'hout', 'water', 'steen'];
const FAMILIES: Familie[] = ['beschaving', 'wildernis', 'bijzonder'];
const NAAMSTIJLEN: ArchetypeInfo['naamStijl'][] = ['stam', 'oud', 'riddersland', 'fabriek', 'stad', 'ster', 'nest', 'hol', 'trek', 'reus', 'vreemd', 'vlees'];
const AANVAL_GETALLEN = { every: 'elke', count: 'aantal', hp: 'hp', speed: 'snelheid', damage: 'schade' } as const;

function lees(bron: unknown, fouten: string[]): [string, ArchetypeInfo] | null {
  if (!isObj(bron) || typeof bron.id !== 'string' || !bron.id) { fouten.push('worldtypes/archetypes: a file without a string "id"'); return null; }
  const id = bron.id;
  const fout = (t: string) => { fouten.push(`worldtypes/archetypes/${id}.json: ${t}`); };
  const tekst = (k: string): string => { const v = bron[k]; if (typeof v === 'string' && v) return v; fout(`"${k}" must be text`); return ''; };
  const getal = (v: unknown, k: string): number => { if (typeof v === 'number' && Number.isFinite(v)) return v; fout(`"${k}" must be a number`); return 0; };
  if (!FAMILIES.includes(bron.family as Familie)) fout(`"family" must be one of ${FAMILIES.join(', ')}`);
  if (!NAAMSTIJLEN.includes(bron.nameStyle as never)) fout(`"nameStyle" must be one of ${NAAMSTIJLEN.join(', ')}`);
  const kaart = bron.map;
  if (!(Array.isArray(kaart) && kaart.length === 2 && kaart.every((n) => Number.isInteger(n) && n > 0))) fout('"map" must be [width, depth] in tiles');
  const res = isObj(bron.resources) ? bron.resources : {};
  const uniek = (Array.isArray(res.unique) ? res.unique : []).map((u): UniekeGrondstof => {
    if (!isObj(u) || typeof u.id !== 'string' || typeof u.name !== 'string') { fout('"resources.unique" needs { "id", "name" } entries'); return { id: '', naam: '' }; }
    return { id: u.id, naam: u.name };
  });
  if (!uniek.length) fout('"resources.unique" needs at least one entry');
  const kans = {} as Record<GedeeldeGrondstof, number>;
  const kansBron = isObj(res.sharedChance) ? res.sharedChance : {};
  for (const g of GEDEELDE) kans[g] = getal(kansBron[g], `resources.sharedChance.${g}`);
  const aliassen: ArchetypeInfo['aliassen'] = {};
  if (isObj(res.aliases)) for (const [g, n] of Object.entries(res.aliases)) {
    if (!GEDEELDE.includes(g as GedeeldeGrondstof) || typeof n !== 'string') fout(`"resources.aliases": "${g}" must be one of ${GEDEELDE.join(', ')} with a text name`);
    else aliassen[g as GedeeldeGrondstof] = n;
  }
  const loot = (Array.isArray(bron.loot) ? bron.loot : []).map((l) => {
    if (!isObj(l) || typeof l.item !== 'string') { fout('"loot" needs { "item", "weight" } entries'); return { vondst: '', kans: 0 }; }
    if (l.requires !== undefined && !uniek.some((u) => u.id === l.requires)) fout(`loot "${l.item}": "requires" must be one of this type's unique resources`);
    return { vondst: l.item, kans: getal(l.weight, `loot.${l.item}.weight`), ...(typeof l.requires === 'string' ? { vereist: l.requires } : {}) };
  });
  if (!loot.length) fout('"loot" needs at least one entry');
  let vijand: Vijand | undefined;
  if (bron.enemy !== undefined) {
    const e = isObj(bron.enemy) ? bron.enemy : {};
    const sprites = (Array.isArray(e.sprites) ? e.sprites : []).map((x): VijandSprite => {
      if (!isObj(x) || typeof x.id !== 'string' || typeof x.folder !== 'string') { fout('"enemy.sprites" needs { "id", "folder", "width", "height", "anchorX", "anchorY" }'); return { id: '', map: '', w: 0, h: 0, ankerX: 0, ankerY: 0 }; }
      return { id: x.id, map: x.folder, w: getal(x.width, `enemy.sprites.${x.id}.width`), h: getal(x.height, `enemy.sprites.${x.id}.height`), ankerX: getal(x.anchorX, `enemy.sprites.${x.id}.anchorX`), ankerY: getal(x.anchorY, `enemy.sprites.${x.id}.anchorY`) };
    });
    const overvallers = Array.isArray(e.raiders) ? e.raiders.map(String) : [];
    if (!overvallers.length) fout('"enemy.raiders" needs at least one sprite id');
    for (const r of overvallers) if (!sprites.some((x) => x.id === r)) fout(`"enemy.raiders": "${r}" is not in "enemy.sprites"`);
    let aanval: AanvalStijl | undefined;
    if (e.attack !== undefined) {
      const a = isObj(e.attack) ? e.attack : {};
      aanval = { elke: 0, aantal: 0, hp: 0, snelheid: 0, schade: 0 };
      for (const [en, nl] of Object.entries(AANVAL_GETALLEN)) aanval[nl] = getal(a[en], `enemy.attack.${en}`);
      if (a.quietUntil !== undefined) aanval.stilTot = getal(a.quietUntil, 'enemy.attack.quietUntil');
      if (a.fixed !== undefined) aanval.vast = getal(a.fixed, 'enemy.attack.fixed');
    }
    vijand = { overvallers, sprites, ...(aanval ? { aanval } : {}) };
  }
  return [id, {
    familie: bron.family as Familie, naam: tekst('name'), uniek, kans, aliassen, loot, kaart: kaart as [number, number],
    beginWrathPlekken: PLEKKEN, naamStijl: bron.nameStyle as ArchetypeInfo['naamStijl'], naamVorm: tekst('nameForm'), ziet: tekst('sees'), vecht: tekst('fights'), vijand,
  }];
}

export const ARCHETYPES = {} as Record<Archetype, ArchetypeInfo>;
{
  const fouten: string[] = [];
  for (const bron of ARCHETYPE_BESTANDEN) {
    const r = lees(bron, fouten);
    if (!r) continue;
    if (r[0] in ARCHETYPES) fouten.push(`worldtypes/archetypes: two files with id "${r[0]}"`);
    ARCHETYPES[r[0] as Archetype] = r[1];
  }
  for (const a of ['steentijd', 'oudheid', 'middeleeuwen', 'industrieel', 'modern', 'scifi', 'insecten', 'monsters', 'kuddes', 'reuzen', 'aliens', 'tentakelbeest'] as Archetype[])
    if (!ARCHETYPES[a]) fouten.push(`worldtypes/archetypes: no file for "${a}"`);
  if (fouten.length) throw new Error('Archetype files are wrong:\n' + fouten.join('\n'));
}

export const PER_FAMILIE: Record<Familie, Archetype[]> = {
  beschaving: ['steentijd', 'oudheid', 'middeleeuwen', 'industrieel', 'modern', 'scifi'],
  wildernis: ['insecten', 'monsters', 'kuddes'],
  bijzonder: ['reuzen', 'aliens', 'tentakelbeest'],
};

// Het klimaat wijzigt de kans per gedeelde grondstof (maal). Een woestijn heeft weinig water en hout, een toendra weinig hout.
export const KLIMAAT_KANS: Record<Klimaat, Record<GedeeldeGrondstof, number>> = {
  roestduin: { metaal: 1.2, hout: 0.4, water: 0.4, steen: 1.1 },
  kristaltoendra: { metaal: 0.9, hout: 0.3, water: 1.1, steen: 1.2 },
  gifwoud: { metaal: 0.6, hout: 1.3, water: 1.0, steen: 0.7 },
  magmaveld: { metaal: 1.3, hout: 0.2, water: 0.2, steen: 1.2 },
  zoutzee: { metaal: 0.5, hout: 0.4, water: 1.4, steen: 0.9 },
  aarde: { metaal: 1.0, hout: 1.1, water: 1.0, steen: 1.0 },
};

export const KLIMATEN = Object.keys(KLIMAAT_KANS) as Klimaat[];

// Lettergrepen voor de namen, per stijl. De generator plakt er 2 of 3 aan elkaar.
export const NAAMDELEN: Record<ArchetypeInfo['naamStijl'], { begin: string[]; eind: string[] }> = {
  stam: { begin: ['Ug', 'Kor', 'Bra', 'Gru', 'Tok', 'Mu'], eind: ['ak', 'ug', 'om', 'ar', 'ok'] },
  oud: { begin: ['Aur', 'Cal', 'Vel', 'Mar', 'Tar', 'Sen'], eind: ['ium', 'ona', 'ica', 'anum', 'eia'] },
  riddersland: { begin: ['Os', 'Wal', 'Ead', 'Bran', 'Hel', 'Thor'], eind: ['mar', 'wick', 'gar', 'heim', 'mund'] },
  fabriek: { begin: ['Kess', 'Cor', 'Brun', 'Hal', 'Pitt', 'Ash'], eind: ['ford', 'ton', 'wall', 'burn', 'hurst'] },
  stad: { begin: ['New', 'Port', 'Mid', 'Glen', 'Harb', 'Lake'], eind: ['view', 'haven', 'ton', 'field', 'side'] },
  ster: { begin: ['Zy', 'Ax', 'Nov', 'Kry', 'Vex', 'Orb'], eind: ['on-7', 'ara', 'ix', 'ium-3', 'eta'] },
  nest: { begin: ['Krel', 'Zik', 'Tsk', 'Vrr', 'Brz', 'Klik'], eind: ['-Tak', '-Zul', '-Mer', '-Zzit', '-Kra'] },
  hol: { begin: ['Gor', 'Skar', 'Vok', 'Drak', 'Mor', 'Nug'], eind: ['rak', 'goth', 'maw', 'thar', 'nox'] },
  trek: { begin: ['Bel', 'Run', 'Thun', 'Kal', 'Dor', 'Yam'], eind: ['ara', 'hoof', 'dal', 'moor', 'steppe'] },
  reus: { begin: ['Jotun', 'Bor', 'Grum', 'Thrym', 'Ymir', 'Tor'], eind: ['heim', 'dun', 'gard', 'fell', 'kol'] },
  vreemd: { begin: ['Ql', 'Xe', 'Nuu', 'Ae', 'Zhi', 'Oo'], eind: ['vor', 'ti', 'lum', 'sh', 'ka'] },
  vlees: { begin: ['Shub', 'Cth', 'Yog', 'Nyar', 'Ul', 'Dag'], eind: ['oth', 'ul', 'gur', 'ath', 'on'] },
};
