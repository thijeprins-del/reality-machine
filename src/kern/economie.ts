// Economieën: wat er in een wereld te halen en te bouwen valt. Elke economie is één JSON-bestand in economies/
// (grondstoffen, recepten, gebouwen, startkapitaal); dit bestand leest ze, controleert ze en geeft ze door.
// De controle komt uit de sandbox (tools/economy.html, `compile`): dezelfde regels, dus wat daar werkt, werkt hier.
//
// Een goed is zijn `id`. Naam, kleur, sprite en velden horen bij de economie: twee economieën mogen hetzelfde id anders
// aankleden ("water" hier, "Murky water" daar) en elk recept dat `water` vraagt neemt beide. Alleen het volume moet
// overal gelijk zijn, anders klopt de opslag niet.
import { ECONOMIE_BESTANDEN } from '../../economies/index';
import type { Voorraad } from './types';

// Velden met een grondstof op de kaart: hoeveel velden, hoeveel tegels per veld, hoeveel per tegel, hoe ver van de machine.
export interface Velden {
  count: number;
  tiles: [number, number];
  perTile: number;
  distance: [number, number];
}
export interface GoedSoort {
  id: string;
  name: string;
  color: string; // '#rrggbb'
  volume: number; // ruimte die één stuk inneemt in de opslag
  sprite?: string; // naam van het plaatje (assets/); zonder plaatje een blokje in `color`
  icon?: string; // klein plaatje als data-URL (uit de sandbox)
  onMap: boolean; // ligt als veld op de kaart
  glows: boolean; // gloeit in beeld (kristal)
  fields?: Velden;
}
export interface ReceptSoort {
  id: string;
  name: string;
  time: number; // seconden
  inputs: Voorraad; // leeg = winning (mijn, steengroeve)
  outputs: Voorraad;
  power: number; // kW die het gebouw levert zolang dit recept draait (0 = geen generator)
}
// Het gedrag van een gebouw. Nieuw gedrag vraagt code; een nieuw gebouw met bestaand gedrag alleen een regel in het bestand.
export type Aard = 'prod' | 'sink' | 'trash' | 'splitter' | 'merger' | 'belt' | 'pole';
export interface BouwSoort {
  id: string;
  name: string;
  color: string;
  sprite?: string;
  aard: Aard;
  recipes: string[]; // alleen 'prod'
  cost: Voorraad;
  work: number; // rat-seconden bouwen op de plek
  size: 1 | 2; // tegels breed en diep
  storage: number; // 'prod': volume dat de uitvoer mag innemen; 'sink': wat het magazijn erbij geeft
  speed: number; // 'prod': maal de snelheid van het recept; 'belt': tegels per seconde
  ports: number; // splitter: uitgangen; merger: ingangen
  kW: number;
  crew: number; // ratten voor volle snelheid (0 = draait vanzelf)
  insideRing: boolean; // mag alleen binnen de ring
  generator: boolean; // een van zijn recepten levert stroom ("power"): een brander, een turbine
  onDeposit: boolean; // moet bij een veld staan en draait het recept dat dat veld geeft
  depRes: string[]; // welke grondstoffen op de kaart dit gebouw kan winnen
  range: number; // 'onDeposit': zo ver om zijn voet graaft hij
  link: number; // 'pole': zo ver mogen palen uit elkaar staan
  reach: number; // 'pole': zo ver geeft hij stroom
}
export interface Economie {
  id: string;
  name: string;
  start: Voorraad; // startkapitaal
  bufferSize: number; // hoeveel van elke invoer een gebouw laat liggen
  warehouseStorage: number; // volume van het magazijn waarmee je begint
  goederen: Map<string, GoedSoort>;
  recepten: Map<string, ReceptSoort>;
  gebouwen: Map<string, BouwSoort>;
  waarschuwingen: string[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const heeft = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const kleur = (c: unknown, anders: string) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : anders);
const getal = (v: unknown, anders: number) => (typeof v === 'number' && Number.isFinite(v) ? v : anders);
const paar = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && n >= 0) && v[0] <= v[1];
const VELD_STANDAARD: Velden = { count: 3, tiles: [6, 10], perTile: 150, distance: [19, 27] };

// Volume van een stapel goederen.
export function volumeVan(v: Voorraad, volume: (id: string) => number): number {
  let n = 0;
  for (const [g, q] of Object.entries(v)) n += (q ?? 0) * volume(g);
  return n;
}

// Leest één economie. Geeft de fouten terug in plaats van te gooien, zodat de lader ze samen kan melden.
export function leesEconomie(bron: unknown): { fouten: string[]; economie?: Economie } {
  const fouten: string[] = [], waarschuwingen: string[] = [];
  if (!isObj(bron)) return { fouten: ['The top level must be an object { … }'] };
  const id = typeof bron.id === 'string' ? bron.id : '';
  if (!id) fouten.push('needs a string "id"');
  for (const k of ['resources', 'recipes', 'buildings']) if (!Array.isArray(bron[k])) fouten.push(`"${k}" must be an array`);
  if (fouten.length) return { fouten };

  const R = new Map<string, GoedSoort>(), C = new Map<string, ReceptSoort>(), B = new Map<string, BouwSoort>();
  (bron.resources as unknown[]).forEach((r, i) => {
    if (!isObj(r) || typeof r.id !== 'string' || !r.id) return fouten.push(`resources[${i}] needs a string "id"`);
    if (R.has(r.id)) return fouten.push(`Duplicate resource id "${r.id}"`);
    const v = r.volume ?? 1;
    if (!(typeof v === 'number' && v > 0)) fouten.push(`Resource "${r.id}": "volume" must be a number > 0`);
    let icon: string | undefined;
    if (r.icon !== undefined) {
      if (typeof r.icon === 'string' && /^data:image\/(png|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(r.icon)) icon = r.icon;
      else waarschuwingen.push(`Resource "${r.id}": "icon" must be a data:image/png;base64,… URL — ignored`);
    }
    const onMap = !!r.onMap;
    let fields: Velden | undefined;
    if (onMap) {
      const f = isObj(r.fields) ? r.fields : {};
      fields = {
        count: getal(f.count, VELD_STANDAARD.count),
        tiles: paar(f.tiles) ? f.tiles : VELD_STANDAARD.tiles,
        perTile: getal(f.perTile, VELD_STANDAARD.perTile),
        distance: paar(f.distance) ? f.distance : VELD_STANDAARD.distance,
      };
      if (!(Number.isInteger(fields.count) && fields.count >= 0 && fields.count <= 200)) fouten.push(`Resource "${r.id}": "fields.count" must be a whole number ≥ 0`);
      if (!(fields.perTile > 0)) fouten.push(`Resource "${r.id}": "fields.perTile" must be > 0`);
      if (f.tiles !== undefined && !paar(f.tiles)) fouten.push(`Resource "${r.id}": "fields.tiles" must be [min, max]`);
      if (f.distance !== undefined && !paar(f.distance)) fouten.push(`Resource "${r.id}": "fields.distance" must be [min, max]`);
    }
    R.set(r.id, { id: r.id, name: typeof r.name === 'string' && r.name ? r.name : r.id.toUpperCase(), color: kleur(r.color, '#999999'), volume: v as number,
      sprite: typeof r.sprite === 'string' ? r.sprite : undefined, icon, onMap, glows: !!r.glows, fields });
  });

  (bron.recipes as unknown[]).forEach((c, i) => {
    if (!isObj(c) || typeof c.id !== 'string' || !c.id) return fouten.push(`recipes[${i}] needs a string "id"`);
    if (C.has(c.id)) return fouten.push(`Duplicate recipe id "${c.id}"`);
    const ins = c.inputs ?? {}, outs = c.outputs ?? {};
    for (const [m, wat] of [[ins, 'inputs'], [outs, 'outputs']] as const) {
      if (!isObj(m)) { fouten.push(`Recipe "${c.id}": "${wat}" must be an object like {"iron_ore": 1}`); continue; }
      for (const [k, v] of Object.entries(m)) {
        if (!R.has(k)) fouten.push(`Recipe "${c.id}": unknown resource "${k}" in ${wat}`);
        if (!(Number.isInteger(v) && (v as number) > 0)) fouten.push(`Recipe "${c.id}": amount of "${k}" must be a whole number ≥ 1`);
      }
    }
    const power = c.power ?? 0;
    if (!(typeof power === 'number' && power >= 0)) fouten.push(`Recipe "${c.id}": "power" must be kW ≥ 0`);
    if (isObj(outs) && !Object.keys(outs).length && !(typeof power === 'number' && power > 0)) fouten.push(`Recipe "${c.id}" has no outputs and no power`);
    const t = c.time ?? 1;
    if (!(typeof t === 'number' && t > 0)) fouten.push(`Recipe "${c.id}": "time" must be seconds > 0`);
    C.set(c.id, { id: c.id, name: typeof c.name === 'string' && c.name ? c.name : c.id, time: t as number, inputs: (isObj(ins) ? ins : {}) as Voorraad, outputs: (isObj(outs) ? outs : {}) as Voorraad, power: typeof power === 'number' && power > 0 ? power : 0 });
  });

  const s = isObj(bron.settings) ? bron.settings : {};
  const pos = (v: unknown, d: number) => (typeof v === 'number' && v > 0 ? v : d);
  const bufferSize = pos(s.bufferSize, 10), defaultStorage = pos(s.defaultStorage, 10), warehouseStorage = pos(s.warehouseStorage, 200);
  const volume = (g: string) => R.get(g)?.volume ?? 1;

  (bron.buildings as unknown[]).forEach((b, i) => {
    if (!isObj(b) || typeof b.id !== 'string' || !b.id) return fouten.push(`buildings[${i}] needs a string "id"`);
    if (B.has(b.id)) return fouten.push(`Duplicate building id "${b.id}"`);
    const rs = b.recipes ?? [];
    if (!Array.isArray(rs) || rs.some((x) => typeof x !== 'string')) return fouten.push(`Building "${b.id}": "recipes" must be an array of recipe ids`);
    (rs as string[]).forEach((r) => { if (!C.has(r)) fouten.push(`Building "${b.id}": unknown recipe "${r}"`); });
    const aard: Aard = b.belt ? 'belt' : b.pole ? 'pole' : b.trash ? 'trash' : b.sink ? 'sink' : b.splitter ? 'splitter' : b.merger ? 'merger' : 'prod';
    if (aard === 'prod' && !rs.length) waarschuwingen.push(`Building "${b.id}" has no recipes and isn't a sink, trash, splitter, merger, belt or pole`);
    if (aard !== 'prod' && rs.length) waarschuwingen.push(`Building "${b.id}" is a ${aard}, so its recipes are ignored`);
    const ports = b.ports ?? ({ sink: 4, trash: 2, splitter: 3, merger: 3 } as Record<string, number>)[aard] ?? 1;
    if (!(Number.isInteger(ports) && (ports as number) >= 1 && (ports as number) <= 8)) fouten.push(`Building "${b.id}": "ports" must be a whole number 1–8`);
    const speed = b.speed ?? (aard === 'belt' ? 2 : 1);
    if (!(typeof speed === 'number' && speed > 0)) fouten.push(`Building "${b.id}": "speed" must be a number > 0`);
    if (b.storage !== undefined && !(typeof b.storage === 'number' && b.storage > 0)) fouten.push(`Building "${b.id}": "storage" must be a number > 0`);
    const storage = getal(b.storage, defaultStorage);
    const size = b.size ?? (aard === 'belt' || aard === 'pole' || aard === 'splitter' || aard === 'merger' || aard === 'trash' ? 1 : 2);
    if (size !== 1 && size !== 2) fouten.push(`Building "${b.id}": "size" must be 1 or 2`);
    if (aard === 'prod') (rs as string[]).forEach((r) => {
      const c = C.get(r);
      if (!c) return;
      const v = volumeVan(c.outputs, volume);
      if (v > storage) fouten.push(`Building "${b.id}" can never run "${r}": its outputs take ${v} volume but storage is ${storage}`);
    });
    const cost: Voorraad = {};
    if (b.cost !== undefined) {
      if (!isObj(b.cost)) fouten.push(`Building "${b.id}": "cost" must be an object like {"iron": 5}`);
      else for (const [k, v] of Object.entries(b.cost)) {
        if (!R.has(k)) fouten.push(`Building "${b.id}": unknown resource "${k}" in cost`);
        else if (!(Number.isInteger(v) && (v as number) >= 0)) fouten.push(`Building "${b.id}": cost of "${k}" must be a whole number ≥ 0`);
        else if ((v as number) > 0) cost[k] = v as number;
      }
    }
    // onDeposit: moet bij een veld staan; alleen recepten die de grondstof van dat veld geven kunnen daar draaien
    const depRes = new Set<string>();
    if (b.onDeposit) {
      if (aard !== 'prod') fouten.push(`Building "${b.id}": only production buildings can be "onDeposit"`);
      (rs as string[]).forEach((r) => { for (const g of Object.keys(C.get(r)?.outputs ?? {})) if (R.get(g)?.onMap) depRes.add(g); });
      if (aard === 'prod' && !depRes.size) fouten.push(`Building "${b.id}" is "onDeposit" but none of its recipes output a resource with "onMap": true`);
    }
    B.set(b.id, {
      id: b.id, name: typeof b.name === 'string' && b.name ? b.name : b.id.toUpperCase(), color: kleur(b.color, '#666666'),
      sprite: typeof b.sprite === 'string' ? b.sprite : undefined, aard, recipes: aard === 'prod' ? (rs as string[]) : [], cost,
      work: pos(b.work, 4), size: (size === 1 ? 1 : 2), storage, speed: speed as number, ports: ports as number,
      kW: Math.max(0, getal(b.kW, 0)), crew: Math.max(0, getal(b.crew, 0)), insideRing: !!b.insideRing, onDeposit: !!b.onDeposit,
      generator: aard === 'prod' && (rs as string[]).some((r) => (C.get(r)?.power ?? 0) > 0),
      depRes: [...depRes], range: pos(b.range, 3), link: pos(b.link, 8), reach: pos(b.reach, 5),
    });
  });

  if (!fouten.length) {
    const alle = [...B.values()];
    for (const c of C.values()) if (!alle.some((b) => b.recipes.includes(c.id))) waarschuwingen.push(`Recipe "${c.id}" isn't available in any building`);
    for (const r of R.values()) if (![...C.values()].some((c) => heeft(c.outputs, r.id))) waarschuwingen.push(`Nothing produces "${r.id}"`);
    if (!alle.some((b) => b.aard === 'belt')) waarschuwingen.push('No building with "belt": true, so no conveyors in this economy');
  }

  const start: Voorraad = {};
  if (bron.startingResources !== undefined) {
    if (!isObj(bron.startingResources)) fouten.push('"startingResources" must be an object like {"iron": 30}');
    else for (const [k, v] of Object.entries(bron.startingResources)) {
      if (!R.has(k)) fouten.push(`startingResources: unknown resource "${k}"`);
      else if (!(Number.isInteger(v) && (v as number) >= 0)) fouten.push(`startingResources: amount of "${k}" must be a whole number ≥ 0`);
      else if ((v as number) > 0) start[k] = v as number;
    }
  }
  // Kun je hier beginnen? Een winningsgebouw moet te betalen zijn uit het startkapitaal of uit wat ratten met de hand delven.
  for (const b of B.values()) if (b.onDeposit)
    for (const k of Object.keys(b.cost)) if (!start[k] && !R.get(k)?.onMap) waarschuwingen.push(`Building "${b.id}" costs "${k}", which is neither in startingResources nor on the map: you may not be able to start here`);
  if (fouten.length) return { fouten };
  return { fouten, economie: { id, name: typeof bron.name === 'string' && bron.name ? bron.name : id, start, bufferSize, warehouseStorage, goederen: R, recepten: C, gebouwen: B, waarschuwingen } };
}

// ---- het register: alle economieën, gelezen bij het laden van het spel ----
const ECONOMIEEN = new Map<string, Economie>();
{
  const fouten: string[] = [];
  for (const bron of ECONOMIE_BESTANDEN) {
    const naam = isObj(bron) && typeof bron.id === 'string' ? bron.id : '?';
    const { fouten: f, economie: e } = leesEconomie(bron);
    fouten.push(...f.map((x) => `economies/${naam}.json: ${x}`));
    if (!e) continue;
    if (ECONOMIEEN.has(e.id)) fouten.push(`economies: two files with id "${e.id}"`);
    // hetzelfde goed in twee economieën mag anders heten, maar moet evenveel ruimte innemen
    for (const ander of ECONOMIEEN.values())
      for (const g of e.goederen.values()) {
        const a = ander.goederen.get(g.id);
        if (a && a.volume !== g.volume) fouten.push(`Resource "${g.id}" has volume ${g.volume} in "${e.id}" but ${a.volume} in "${ander.id}": it must be the same everywhere`);
      }
    ECONOMIEEN.set(e.id, e);
    if (import.meta.env?.DEV) for (const x of e.waarschuwingen) console.warn(`economies/${e.id}.json: ${x}`);
  }
  if (fouten.length) throw new Error('Economy files are wrong:\n' + fouten.join('\n'));
}

export const economieen = (): Economie[] => [...ECONOMIEEN.values()];
export const bestaatEconomie = (id: string): boolean => ECONOMIEEN.has(id);
export function economie(id: string): Economie {
  const e = ECONOMIEEN.get(id);
  if (!e) throw new Error(`Unknown economy "${id}"`);
  return e;
}

// De economie van de wereld waar het spel nu is: zet het spel bij de start en bij elke sprong (kern/spel.ts).
let actief: Economie | null = null;
export const zetActieveEconomie = (e: Economie): void => { actief = e; };
export const actieveEconomie = (): Economie => actief ?? economieen()[0];
// De grondstoffen die in deze economie op de kaart liggen, in de volgorde van het bestand.
export const grondstoffenVan = (e: Economie): string[] => [...e.goederen.values()].filter((g) => g.onMap).map((g) => g.id);

// Een goed opzoeken: eerst in de economie van de wereld waar je nu bent (zo heet het daar), anders in de eerste economie
// die het id kent (voorraad uit een eerdere wereld). Een onbekend id krijgt een grauw standaardgoed.
export function goed(id: string, eerst: Economie = actieveEconomie()): GoedSoort {
  const hier = eerst.goederen.get(id);
  if (hier) return hier;
  for (const e of ECONOMIEEN.values()) {
    const g = e.goederen.get(id);
    if (g) return g;
  }
  return { id, name: id.toUpperCase(), color: '#999999', volume: 1, onMap: false, glows: false };
}
