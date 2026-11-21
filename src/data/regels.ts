// Shift-regels: een toestand van de dimensie die verandert hoe je er speelt. Alles hier is een balansknop.
// De generator rolt er een per dimensie (src/land/genereer.ts); de finale heeft altijd de storm.
// Zie DESIGN.md, "Shift-regels".
export type Conditie = 'laag' | 'hoog' | 'nacht' | 'regen' | 'storm';

export interface ConditieInfo {
  naam: string; // zo heet de regel in beeld
  tekst: string; // wat het met je doet, in een zin
  kleur: string;
  muis: number; // maal de loopsnelheid van de muizen
  overvaller: number; // maal de loopsnelheid van overvallers
  herstel: number; // maal het herstel van de machine
  afstand: number; // maal de afstand waarop overvallers verschijnen (kleiner = ze komen uit het donker)
  elke: number; // maal het interval tussen overvallen
  zicht: number; // maal de zichtstraal van de mist (alleen met ?fog=1)
  donker: number; // 0..1, hoe donker het beeld wordt
  regen: boolean;
}

const basis = { muis: 1, overvaller: 1, herstel: 1, afstand: 1, elke: 1, zicht: 1, donker: 0, regen: false };
export const CONDITIES: Record<Conditie, ConditieInfo> = {
  laag: { ...basis, naam: 'LOW GRAVITY', tekst: 'Everyone floats: rats and raiders move much faster', kleur: '#8ecbff', muis: 1.4, overvaller: 1.25 },
  hoog: { ...basis, naam: 'HIGH GRAVITY', tekst: 'Everything is heavy: rats move slowly, raiders are slowed less', kleur: '#d9a066', muis: 0.7, overvaller: 0.85 },
  nacht: { ...basis, naam: 'NIGHT', tekst: 'Dark: you see less, and raiders appear closer', kleur: '#8a8aff', donker: 0.55, zicht: 0.5, afstand: 0.6 },
  regen: { ...basis, naam: 'RAIN', tekst: 'Heavy rain: rats are slower and the machine mends at half speed', kleur: '#6fb7ff', muis: 0.85, herstel: 0.5, regen: true },
  storm: { ...basis, naam: 'STORM', tekst: 'Night and rain at once; raiders come faster. The final stand.', kleur: '#ff5a5a', muis: 0.85, herstel: 0.5, afstand: 0.6, zicht: 0.5, donker: 0.6, regen: true, elke: 0.8 },
};

export const KOMT_VOOR: Conditie[] = ['laag', 'hoog', 'nacht', 'regen'];
export const KANS_CONDITIE = 0.6; // vanaf de vierde dimensie: zo vaak heeft een dimensie een regel (de drie kerndimensies hebben er geen)
export const EERSTE_MET_REGEL = 4;

export const conditieUitTekst = (t: string | null): Conditie | undefined => {
  const k = (t ?? '').toLowerCase();
  const alias: Record<string, Conditie> = { low: 'laag', lowgravity: 'laag', high: 'hoog', highgravity: 'hoog', night: 'nacht', rain: 'regen', storm: 'storm', laag: 'laag', hoog: 'hoog', nacht: 'nacht', regen: 'regen' };
  return alias[k];
};
