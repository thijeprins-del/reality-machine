// Getallen voor Wrath: de woede van het land. Zie DESIGN.md, "Het land". Alles hier is een balansknop.
export const WRATH_MAX = 100;

// Vijf stadia, elk met zijn eigen overval (raid): hoe vaak, hoeveel overvallers.
export interface WrathStadium {
  vanaf: number; // Wrath vanaf dit getal
  naam: string; // zo heet het stadium in beeld
  kleur: string;
  raid: { elke: number; aantal: number } | null; // seconden tussen overvallen, overvallers per overval
}
export const WRATH_STADIA: WrathStadium[] = [
  { vanaf: 0, naam: 'CALM', kleur: '#6fcf6f', raid: null },
  { vanaf: 20, naam: 'WARY', kleur: '#d9d94a', raid: { elke: 80, aantal: 2 } },
  { vanaf: 40, naam: 'HOSTILE', kleur: '#ffb02e', raid: { elke: 55, aantal: 3 } },
  { vanaf: 60, naam: 'ENRAGED', kleur: '#ff6a1a', raid: { elke: 38, aantal: 5 } },
  { vanaf: 80, naam: 'WRATHFUL', kleur: '#ff3030', raid: { elke: 26, aantal: 7 } },
];

// Hebzucht: elke grondstof die uit het land komt kost zoveel Wrath (maal de sterkte van de dimensie).
export const WRATH_PER_GOED = 0.05;
// Wie even niets neemt (WRATH_RUST_NA s), kalmeert het land: zoveel Wrath per seconde, nooit onder de helft van het beginpunt.
export const WRATH_RUST_NA = 10;
export const WRATH_KALMEER_PER_SEC = 0.1;
export const WRATH_VLOER = 0.5;
// Een overval verslaan geeft rust: zoveel Wrath eraf per overvaller.
export const WRATH_PER_OVERVALLER_WEG = 0.5;

// Overvallers lopen naar de machine. Muizen vlakbij verdedigen: elke muis binnen VERDEDIG_STRAAL doet zoveel schade per seconde.
// Zo kost alle muizen op grondstoffen zetten je de verdediging: dat is de spanning.
export const OVERVAL_HP = 8; // maal sterkte
export const OVERVAL_SNELHEID = 1.2; // tegels per seconde
export const OVERVAL_SCHADE = 1.5; // heelheid per seconde van de machine, per overvaller die hem raakt
export const OVERVAL_BEREIK = 3.2; // tegels vanaf het midden van de machine
export const VERDEDIG_STRAAL = 2.5;
export const VERDEDIG_SCHADE = 0.3; // per muis per seconde
export const OVERVAL_AFSTAND = 24; // zo ver buiten de ring komen ze vandaan
export const EERSTE_OVERVAL_SEC = 20; // na de landing duurt het even voor de eerste komt

// De machine herstelt rustig als er niemand in de buurt is, en de stream vraagt minimaal zoveel heelheid.
export const HEEL_HERSTEL_PER_SEC = 0.3;
export const HEEL_MIN_STREAM = 50;
