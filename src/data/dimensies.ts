// Getallen voor dimensies, de kaart en de stream. Zie DESIGN.md.
import type { TegelSet } from '../kern/tegels';
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
export const DIMENSIES: DimensieWereld[] = [
  { naam: 'RUST DUNES', grond: [0x5a2a12, 0x6b3316, 0x4f240f, 0x733a1a, 0x62301a], vlek: 0x2a1208, vlekKans: 0.15, rand: [0x3a1a0a, 0x2a1207], heuvels: { schaal: 16, hoog: 4.5, basis: 0.8, klipSchaal: 19, klipDrempel: 0.28, klipHoog: 2 }, water: [0x4a3a1c, 0x54421f, 0x40331a], tegelset: 'roestduin' },
  { naam: 'CRYSTAL TUNDRA', grond: [0x8fa6c8, 0x9db3d3, 0x8299bd, 0xa8bddb, 0x7f95b8], vlek: 0x4ef2ff, vlekGloeit: true, vlekKans: 0.04, rand: [0x4c5c80, 0x3b4868], heuvels: { schaal: 9, hoog: 5, basis: 0.8, klipSchaal: 12, klipDrempel: 0.2, klipHoog: 3 }, water: [0x3f8fb8, 0x4a9cc4, 0x3684ad], waterGloeit: true, tegelset: 'kristaltoendra' },
  { naam: 'POISON WOODS', grond: [0x1f3a14, 0x24431a, 0x1a3311, 0x2a4b1d, 0x203d16], vlek: 0x9dff2e, vlekGloeit: true, vlekKans: 0.06, rand: [0x142410, 0x0e1a0b], heuvels: { schaal: 12, hoog: 4, basis: 1, klipSchaal: 15, klipDrempel: 0.3, klipHoog: 2 }, water: [0x3f7a12, 0x4a8a16, 0x366b10], waterGloeit: true, tegelset: 'gifwoud' },
  { naam: 'MAGMA FIELD', grond: [0x1a1514, 0x201917, 0x161211, 0x241c19, 0x1c1614], vlek: 0xff6a1a, vlekGloeit: true, vlekKans: 0.12, rand: [0x2a0d06, 0x1e0904], heuvels: { schaal: 8, hoog: 7, basis: 1.2, klipSchaal: 10, klipDrempel: 0.12, klipHoog: 3 }, water: [0xff5a12, 0xff7a1a, 0xe8480c], waterGloeit: true, tegelset: 'magmaveld' },
  { naam: 'SALT SEA', grond: [0xc98aa5, 0xd496b0, 0xbf7f9b, 0xdca2bb, 0xc48aa3], vlek: 0xfff0fa, vlekKans: 0.1, rand: [0x7a4060, 0x5c2f48], heuvels: { schaal: 22, hoog: 3.5, basis: -0.2, klipSchaal: 24, klipDrempel: 0.42, klipHoog: 2 }, water: [0xe8d4e0, 0xf0dee8, 0xdcc8d6], tegelset: 'zoutzee' }
  ,{ naam: 'EARTH', grond: [0x527e2f], vlek: 0x2f4a1c, vlekKans: 0.08, rand: [0x4a3a22, 0x382b19], heuvels: { schaal: 18, hoog: 4.5, basis: 0.7, klipSchaal: 17, klipDrempel: 0.3, klipHoog: 2 }, water: [0x1f66ad], tegelset: 'aarde' },
];
export const dimensieKleur = (dimensie: number): DimensieWereld => DIMENSIES[(dimensie - 1) % DIMENSIES.length];
export const dimensieKaart = (dimensie: number): [number, number] => DIMENSIES[(dimensie - 1) % DIMENSIES.length].kaart ?? [KAART_BREED, KAART_DIEP];
export const dimensieHeuvels = (dimensie: number): Heuvels => DIMENSIES[(dimensie - 1) % DIMENSIES.length].heuvels;

// Mist van de wereld (fog of war): hoe ver iemand ziet, in tegels. De machine ziet de hele ring plus een stuk eromheen.
export const MIST_ZICHT_MUIS = 6.5;
export const MIST_ZICHT_MACHINE = 7; // extra bovenop de ringstraal
export const MIST_UPDATE_SEC = 0.15; // zo vaak wordt de mist bijgewerkt
