// Wereldtypes: hoe een wereld eruitziet (tegelset, kleuren, heuvels) en welke economie er geldt. Elk type is één
// JSON-bestand in worldtypes/; dit bestand leest en controleert ze. De getallen stonden eerst in src/data/dimensies.ts.
import { WERELDTYPE_BESTANDEN } from '../../worldtypes/index';
import type { DimensieWereld } from '../data/dimensies';
import { bestaatEconomie } from './economie';
import { TEGELSETS, type TegelSet } from './tegels';

export interface WereldType extends DimensieWereld {
  id: string;
  economie: string; // id van een bestand in economies/
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

function lees(bron: unknown, fouten: string[]): WereldType | null {
  if (!isObj(bron) || typeof bron.id !== 'string' || !bron.id) { fouten.push('worldtypes: a file without a string "id"'); return null; }
  const waar = `worldtypes/${bron.id}.json`;
  const fout = (t: string) => { fouten.push(`${waar}: ${t}`); };
  const hex = (v: unknown, sleutel: string): number => {
    if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) return parseInt(v.slice(1), 16);
    fout(`"${sleutel}" must be a colour like "#5a2a12"`);
    return 0;
  };
  const lijst = (v: unknown, sleutel: string, min = 1): number[] => {
    if (Array.isArray(v) && v.length >= min) return v.map((x) => hex(x, sleutel));
    fout(`"${sleutel}" must be a list of at least ${min} colour${min > 1 ? 's' : ''}`);
    return [0, 0];
  };
  const num = (v: unknown, sleutel: string): number => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    fout(`"${sleutel}" must be a number`);
    return 0;
  };
  if (!TEGELSETS.includes(bron.tileset as TegelSet)) fout(`"tileset" must be one of ${TEGELSETS.join(', ')}`);
  if (typeof bron.economy !== 'string' || !bestaatEconomie(bron.economy)) fout(`"economy": there is no economies/${String(bron.economy)}.json`);
  const h = isObj(bron.hills) ? bron.hills : {};
  if (!isObj(bron.hills)) fout('"hills" is missing');
  const rand = lijst(bron.edge, 'edge', 2);
  const kaart = bron.map;
  if (kaart !== undefined && !(Array.isArray(kaart) && kaart.length === 2 && kaart.every((n) => Number.isInteger(n) && n > 0))) fout('"map" must be [width, depth] in tiles');
  return {
    id: bron.id,
    economie: String(bron.economy),
    naam: typeof bron.name === 'string' && bron.name ? bron.name : bron.id.toUpperCase(),
    tegelset: bron.tileset as TegelSet,
    grond: lijst(bron.ground, 'ground'),
    vlek: hex(bron.spot, 'spot'),
    ...(bron.spotGlows ? { vlekGloeit: true } : {}),
    vlekKans: num(bron.spotChance, 'spotChance'),
    rand: [rand[0], rand[1]],
    water: lijst(bron.water, 'water'),
    ...(bron.waterGlows ? { waterGloeit: true } : {}),
    heuvels: {
      schaal: num(h.scale, 'hills.scale'), hoog: num(h.height, 'hills.height'), basis: num(h.base, 'hills.base'),
      klipSchaal: num(h.cliffScale, 'hills.cliffScale'), klipDrempel: num(h.cliffThreshold, 'hills.cliffThreshold'), klipHoog: num(h.cliffHeight, 'hills.cliffHeight'),
    },
    ...(kaart ? { kaart: kaart as [number, number] } : {}),
  };
}

export const WERELDTYPES: WereldType[] = [];
{
  const fouten: string[] = [];
  for (const bron of WERELDTYPE_BESTANDEN) {
    const w = lees(bron, fouten);
    if (!w) continue;
    if (WERELDTYPES.some((x) => x.id === w.id)) fouten.push(`worldtypes: two files with id "${w.id}"`);
    WERELDTYPES.push(w);
  }
  for (const set of TEGELSETS) if (!WERELDTYPES.some((w) => w.tegelset === set)) fouten.push(`worldtypes: no world type uses tileset "${set}" (the generator can roll it)`);
  if (fouten.length) throw new Error('World type files are wrong:\n' + fouten.join('\n'));
}

export const wereldType = (id: string): WereldType | undefined => WERELDTYPES.find((w) => w.id === id);

// Het wereldtype bij een gerolde tegelset. Delen meer types één tegelset, dan kiest `worp` (0..1, vast per dimensie) er een:
// zo kost de keuze geen trekking uit de toevalsstroom en blijven bestaande seeds dezelfde werelden geven.
export function wereldTypeVoor(set: TegelSet, worp: number): WereldType {
  const lijst = WERELDTYPES.filter((w) => w.tegelset === set);
  return lijst[Math.min(lijst.length - 1, Math.floor(worp * lijst.length))];
}
