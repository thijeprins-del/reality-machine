// Getallen voor dimensies, de kaart en de stream. Zie DESIGN.md.
import { economie, type Economie } from '../kern/economie';
import type { TegelSet } from '../kern/tegels';
import { WERELDTYPES, wereldType, type WereldType } from '../kern/wereldtypes';
import type { Grondstof } from '../kern/types';

export const DIMENSIE_DUUR_SEC = 300; // 5 minuten per wereld (Thije, 3 nov)

// De sprong: de schijf wordt uit de wereld gerukt, hangt even in het niets, en landt dan in de volgende.
// Zo lang staat de tijd en het werk stil (het stroomnet loopt door).
export const SPRONG_SEC = 3.5;

// De kaart van een dimensie: de schijf in het midden, ruim wereld eromheen.
export const KAART_BREED = 160;
export const KAART_DIEP = 160;
export const KAART_MIN = 48; // kleiner past de schijf met de velden eromheen niet

// De transportring: een slecht geverfde gele stippellijn om de machine. Alles binnen de ring springt mee naar de
// volgende dimensie; de grondstoffen liggen erbuiten en blijven achter.
// Binnen de ring bouw je, dus hij is ruim (Thije, 2 nov). De schijf eronder steekt er grof en ongelijk buiten.
export const RING_STRAAL = 14; // tegels vanaf het midden van de machine

// Hoogte van het land, in hele niveaus. Elke tegel heeft zijn eigen vier hoeken (zie kern/terrein.ts); één niveau is
// HOOGTE_PX schermpixels omhoog. Een tegel met alle hoeken op HOOGTE_MIN is water. De wereld rond de schijf ligt op 0, de schijf zelf op SCHIJF_HOOGTE:
// één blok hoog, met kleppen rondom die bij de landing uitschuiven tot hellingen naar de grond (zie kaart.ts).
export const SCHIJF_HOOGTE = 1;
export const HOOGTE_MIN = -1;
export const HOOGTE_MAX = 5;
export const HOOGTE_PX = 16;
// Land achter een wand van minstens MIN_STUK tegels krijgt een oprit; hooguit MAX_OPRITTEN keer rondkijken per wereld.
export const MIN_STUK = 30;
export const MAX_OPRITTEN = 12;
// Een plateau kleiner dan zoveel tegels wordt geen plateau: een los blokje leest als een foutje in de kaart.
export const MIN_PLATEAU = 40;
// Plateaus komen pas vanaf dit deel van de weg tussen TERREIN_VLAK en TERREIN_VOL: niet vlak naast je schijf.
export const PLATEAU_VANAF = 0.6;
// Tot zo ver buiten de ring blijft de wereld vlak (de schijf en haar kleppen: de verste klephoek ligt op 4,82); hier zijn de
// heuvels op volle hoogte.
export const TERREIN_VLAK = 5;
export const TERREIN_VOL = 10;

// Hoe hoger, hoe lichter: elk niveau is een stap helderder, zodat je hoogte in één oogopslag ziet. Laag land op 0 krijgt
// HOOGTE_TINT_LAAG, de top op HOOGTE_MAX blijft de volle kleur van de tegelset. Water doet niet mee.
export const HOOGTE_TINT_LAAG = 0.58;
export const hoogteTint = (z: number): number => HOOGTE_TINT_LAAG + ((1 - HOOGTE_TINT_LAAG) * Math.max(0, Math.min(HOOGTE_MAX, z))) / HOOGTE_MAX;

// Velden met grondstoffen: hoeveel velden, hoeveel tegels per veld, hoeveel per tegel, hoe ver van de machine.
export const VELDEN: Record<Grondstof, { aantal: number; tegels: [number, number]; perTegel: number; afstand: [number, number] }> = {
  // Weinig velden die veel geven: een boor neerzetten moet de moeite waard zijn (Thije, 5 nov).
  schroot: { aantal: 3, tegels: [8, 12], perTegel: 200, afstand: [19, 25] },
  hout: { aantal: 3, tegels: [6, 10], perTegel: 150, afstand: [19, 27] },
  kristal: { aantal: 2, tegels: [4, 6], perTegel: 80, afstand: [23, 28] },
};

// Elke dimensie ziet er echt anders uit. Binnen de ring blijft je eigen grauwe grond; erbuiten de kleuren van de wereld.
export interface DimensieKleur {
  naam: string;
  grond: number[]; // tegelkleuren
  vlek: number; // kleur van vlekken op de grond
  vlekGloeit?: boolean; // vlekken in de gloedlaag (lava, gif)
  vlekKans: number; // deel van de tegels met een vlek
  rand: [number, number]; // zijkanten van het land
}
// De heuvels van een wereld: schaal = tegels per heuvel, hoog = hoeveel niveaus de ruis op en neer gaat, basis = gemiddelde
// hoogte. Wat onder de -0,5 zakt wordt water: een lage basis geeft meer meren, een hoge basis een golvend land.
// klipSchaal = tegels per plateau, klipDrempel = hoe zeldzaam (ruis -1 tot 1: hoger is minder plateaus, 1 is geen),
// klipHoog = hoeveel niveaus een plateau boven het land eromheen ligt: zo hoog is de wand.
export interface Heuvels {
  schaal: number;
  hoog: number;
  basis: number;
  klipSchaal: number;
  klipDrempel: number;
  klipHoog: number;
}
export const THUIS: DimensieKleur = {
  naam: 'HOME',
  grond: [0x1d1e1c, 0x21221f, 0x1a1b19, 0x242521, 0x1f1d1a],
  vlek: 0x121210,
  vlekKans: 0.15,
  rand: [0x1f1813, 0x16110d],
};
// Een echte dimensie heeft ook terrein en water; THUIS (je schijf) niet.
export interface DimensieWereld extends DimensieKleur {
  heuvels: Heuvels;
  water: number[];
  waterGloeit?: boolean; // ook in de gloedlaag
  tegelset: TegelSet; // de tegels uit scripts/pixel/terrein.mjs
  kaart?: [number, number]; // breed en diep van deze wereld, als die afwijkt van KAART_BREED x KAART_DIEP
}
// De werelden zelf staan in worldtypes/*.json (kern/wereldtypes.ts leest ze): naam, tegelset, kleuren, heuvels, economie.
export const DIMENSIES: WereldType[] = WERELDTYPES;
// Welk wereldtype een dimensie heeft: standaard de lijst in volgorde, maar het spel meldt hier de gerolde dimensies aan
// (src/land/), zodat het land eruitziet als wat de generator rolde. Zonder aanmelding blijft het de oude volgorde.
let typeVan: ((dimensie: number) => string) | null = null;
export const zetWereldBron = (f: ((dimensie: number) => string) | null): void => { typeVan = f; };
const wereldVan = (dimensie: number): WereldType => {
  const id = typeVan?.(dimensie);
  return (id && wereldType(id)) || DIMENSIES[(dimensie - 1) % DIMENSIES.length];
};
// De economie van een dimensie: wat er ligt en wat je er kunt bouwen (economies/*.json).
export const economieVan = (dimensie: number): Economie => economie(wereldVan(dimensie).economie);
export const dimensieKleur = (dimensie: number): DimensieWereld => wereldVan(dimensie);
export const dimensieKaart = (dimensie: number): [number, number] => wereldVan(dimensie).kaart ?? [KAART_BREED, KAART_DIEP];
export const dimensieHeuvels = (dimensie: number): Heuvels => wereldVan(dimensie).heuvels;

// Mist van de wereld (fog of war): hoe ver iemand ziet, in tegels. De machine ziet de hele ring plus een stuk eromheen.
export const MIST_ZICHT_MUIS = 9;
export const MIST_ZICHT_MACHINE = 16; // extra bovenop de ringstraal
export const MIST_UPDATE_SEC = 0.15; // zo vaak wordt de mist bijgewerkt
