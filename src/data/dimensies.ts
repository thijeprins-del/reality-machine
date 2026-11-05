// Getallen voor dimensies, de kaart en de stream. Zie DESIGN.md.
import type { Grondstof } from '../kern/types';

export const DIMENSIE_DUUR_SEC = 300; // 5 minuten per wereld (Thije, 3 nov)

// De sprong: de schijf wordt uit de wereld gerukt, hangt even in het niets, en landt dan in de volgende.
// Zo lang staat de tijd en het werk stil (het stroomnet loopt door).
export const SPRONG_SEC = 3.5;

// De kaart van een dimensie: de schijf in het midden, ruim wereld eromheen.
export const KAART_BREED = 64;
export const KAART_DIEP = 64;

// De transportring: een slecht geverfde gele stippellijn om de machine. Alles binnen de ring springt mee naar de
// volgende dimensie; de grondstoffen liggen erbuiten en blijven achter.
// Binnen de ring bouw je, dus hij is ruim (Thije, 2 nov). De schijf eronder steekt er grof en ongelijk buiten.
export const RING_STRAAL = 14; // tegels vanaf het midden van de machine

// Hoogte van het land, in hele niveaus, op de hoeken van de tegels. Eén niveau is HOOGTE_PX schermpixels omhoog.
// -1 wordt water (stap 2 van het terrein). Tot die tijd komt de generator niet lager dan HOOGTE_DROOG. Je schijf ligt op 0.
export const HOOGTE_MIN = -1;
export const HOOGTE_DROOG = 0;
export const HOOGTE_MAX = 5;
export const HOOGTE_PX = 16;
// Tot zo ver buiten de ring blijft de wereld vlak (de schijf en haar schaduw); hier zijn de heuvels op volle hoogte.
export const TERREIN_VLAK = 3.5;
export const TERREIN_VOL = 10;

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
// hoogte. Alles onder de grond wordt vlakte: een lage basis geeft losse heuvels, een hoge basis een golvend land.
export interface Heuvels {
  schaal: number;
  hoog: number;
  basis: number;
}
export const THUIS: DimensieKleur = {
  naam: 'HOME',
  grond: [0x1d1e1c, 0x21221f, 0x1a1b19, 0x242521, 0x1f1d1a],
  vlek: 0x121210,
  vlekKans: 0.15,
  rand: [0x1f1813, 0x16110d],
};
export const DIMENSIES: (DimensieKleur & { heuvels: Heuvels })[] = [
  { naam: 'RUST DUNES', grond: [0x5a2a12, 0x6b3316, 0x4f240f, 0x733a1a, 0x62301a], vlek: 0x2a1208, vlekKans: 0.15, rand: [0x3a1a0a, 0x2a1207], heuvels: { schaal: 16, hoog: 4, basis: 1.5 } },
  { naam: 'CRYSTAL TUNDRA', grond: [0x8fa6c8, 0x9db3d3, 0x8299bd, 0xa8bddb, 0x7f95b8], vlek: 0x4ef2ff, vlekGloeit: true, vlekKans: 0.04, rand: [0x4c5c80, 0x3b4868], heuvels: { schaal: 9, hoog: 5, basis: 1 } },
  { naam: 'POISON WOODS', grond: [0x1f3a14, 0x24431a, 0x1a3311, 0x2a4b1d, 0x203d16], vlek: 0x9dff2e, vlekGloeit: true, vlekKans: 0.06, rand: [0x142410, 0x0e1a0b], heuvels: { schaal: 12, hoog: 4, basis: 2 } },
  { naam: 'MAGMA FIELD', grond: [0x1a1514, 0x201917, 0x161211, 0x241c19, 0x1c1614], vlek: 0xff6a1a, vlekGloeit: true, vlekKans: 0.12, rand: [0x2a0d06, 0x1e0904], heuvels: { schaal: 8, hoog: 7, basis: 2 } },
  { naam: 'SALT SEA', grond: [0xc98aa5, 0xd496b0, 0xbf7f9b, 0xdca2bb, 0xc48aa3], vlek: 0xfff0fa, vlekKans: 0.1, rand: [0x7a4060, 0x5c2f48], heuvels: { schaal: 22, hoog: 3, basis: 0.5 } },
];
export const dimensieKleur = (dimensie: number): DimensieKleur => DIMENSIES[(dimensie - 1) % DIMENSIES.length];
export const dimensieHeuvels = (dimensie: number): Heuvels => DIMENSIES[(dimensie - 1) % DIMENSIES.length].heuvels;
