// Het contract tussen kern en facties. Nieuw veld nodig? Kleine aparte PR op dit bestand.
export type FactieId = 'muizen' | 'otters';

export interface Factie {
  id: FactieId;
  naam: string;
}

export interface Eenheid {
  factie: FactieId;
  soort: string;
  x: number;
  y: number;
}

export interface Vondst {
  soort: string;
  waarde: number;
}

export interface Gebouw {
  factie: FactieId;
  soort: string;
  x: number;
  y: number;
}
