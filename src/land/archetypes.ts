// De gegevens per archetype en klimaat voor de dimensiegenerator. Alleen getallen en namen, geen regels.
// Zie DESIGN.md "Het land" en het plan (Procedural generation).
import type { Archetype, Familie, GedeeldeGrondstof, Klimaat, UniekeGrondstof } from '../kern/types';

export interface ArchetypeInfo {
  familie: Familie;
  naam: string; // zo heet het type in beeld ("STONE AGE")
  uniek: UniekeGrondstof[]; // hieruit komen er 1 of 2
  // kans (0..1) dat een gedeelde grondstof bestaat, bovenop het klimaat
  kans: Record<GedeeldeGrondstof, number>;
  loot: { vondst: string; kans: number; vereist?: string }[]; // 3 bouwplannen per type (muizenversie)
  kaart: [number, number];
  beginWrathPlekken: { plek: string; wrath: [number, number]; gewicht: number }[];
  naamStijl: 'stam' | 'oud' | 'riddersland' | 'fabriek' | 'stad' | 'ster' | 'nest' | 'hol' | 'trek' | 'reus' | 'vreemd' | 'vlees';
  naamVorm: string; // sjabloon, {n} = gegenereerde naam
}

const U = (id: string, naam: string): UniekeGrondstof => ({ id, naam });
const PLEKKEN = [
  { plek: 'wilderness, far from anyone', wrath: [0, 10] as [number, number], gewicht: 4 },
  { plek: 'edge of their territory', wrath: [15, 30] as [number, number], gewicht: 3 },
  { plek: 'next to a site', wrath: [30, 50] as [number, number], gewicht: 2 },
  { plek: 'in the middle of it', wrath: [50, 70] as [number, number], gewicht: 1 },
];

export const ARCHETYPES: Record<Archetype, ArchetypeInfo> = {
  steentijd: { familie: 'beschaving', naam: 'STONE AGE', uniek: [U('vuursteen', 'Flint'), U('bot', 'Bone'), U('vacht', 'Hide')],
    kans: { metaal: 0.15, hout: 0.9, water: 0.7, steen: 0.9 },
    loot: [{ vondst: 'bot-boorkop', kans: 3, vereist: 'bot' }, { vondst: 'vuurkuil-brander', kans: 2, vereist: 'vuursteen' }, { vondst: 'totem-baken', kans: 1 }],
    kaart: [160, 160], beginWrathPlekken: PLEKKEN, naamStijl: 'stam', naamVorm: 'Tribe of {n}' },
  oudheid: { familie: 'beschaving', naam: 'ANTIQUITY', uniek: [U('brons', 'Bronze'), U('marmer', 'Marble')],
    kans: { metaal: 0.55, hout: 0.7, water: 0.7, steen: 0.9 },
    loot: [{ vondst: 'schroot-katapult', kans: 3, vereist: 'brons' }, { vondst: 'brons-tandwielen', kans: 2, vereist: 'brons' }, { vondst: 'marmeren-fundering', kans: 1, vereist: 'marmer' }],
    kaart: [160, 160], beginWrathPlekken: PLEKKEN, naamStijl: 'oud', naamVorm: 'Republic of {n}' },
  middeleeuwen: { familie: 'beschaving', naam: 'MEDIEVAL', uniek: [U('ijzererts', 'Iron ore'), U('steenkool', 'Coal')],
    kans: { metaal: 0.8, hout: 0.8, water: 0.7, steen: 0.8 },
    loot: [{ vondst: 'trebuchet-toren', kans: 3, vereist: 'ijzererts' }, { vondst: 'windmolen-stroom', kans: 2 }, { vondst: 'smidse', kans: 2, vereist: 'steenkool' }],
    kaart: [160, 160], beginWrathPlekken: PLEKKEN, naamStijl: 'riddersland', naamVorm: 'Kingdom of {n}' },
  industrieel: { familie: 'beschaving', naam: 'INDUSTRIAL', uniek: [U('steenkool', 'Coal'), U('olie', 'Oil'), U('staal', 'Steel')],
    kans: { metaal: 0.9, hout: 0.5, water: 0.8, steen: 0.7 },
    loot: [{ vondst: 'stoomketel', kans: 3, vereist: 'steenkool' }, { vondst: 'rail-band', kans: 2, vereist: 'staal' }, { vondst: 'olielamp-generator', kans: 1, vereist: 'olie' }],
    kaart: [160, 160], beginWrathPlekken: PLEKKEN, naamStijl: 'fabriek', naamVorm: '{n} Works' },
  modern: { familie: 'beschaving', naam: 'MODERN', uniek: [U('beton', 'Concrete'), U('koper', 'Copper'), U('brandstof', 'Fuel'), U('elektronica', 'Electronics')],
    kans: { metaal: 0.9, hout: 0.4, water: 0.8, steen: 0.6 },
    loot: [{ vondst: 'centrale-generator', kans: 3, vereist: 'brandstof' }, { vondst: 'bouwkraan', kans: 2 }, { vondst: 'autowrak-pantser', kans: 2, vereist: 'koper' }],
    kaart: [160, 160], beginWrathPlekken: PLEKKEN, naamStijl: 'stad', naamVorm: 'City of {n}' },
  scifi: { familie: 'beschaving', naam: 'SCI-FI', uniek: [U('plasmacel', 'Plasma cells'), U('legering', 'Alloy')],
    kans: { metaal: 0.85, hout: 0.2, water: 0.6, steen: 0.5 },
    loot: [{ vondst: 'schildgenerator', kans: 3, vereist: 'plasmacel' }, { vondst: 'drone-mijner', kans: 2, vereist: 'legering' }, { vondst: 'plasma-brander', kans: 1, vereist: 'plasmacel' }],
    kaart: [160, 160], beginWrathPlekken: PLEKKEN, naamStijl: 'ster', naamVorm: 'Dome {n}' },
  insecten: { familie: 'wildernis', naam: 'BUGS', uniek: [U('chitine', 'Chitin'), U('honing', 'Honey'), U('hars', 'Resin')],
    kans: { metaal: 0.2, hout: 0.85, water: 0.7, steen: 0.6 },
    loot: [{ vondst: 'chitine-pantser', kans: 3, vereist: 'chitine' }, { vondst: 'honing-brandstof', kans: 2, vereist: 'honing' }, { vondst: 'harslijm-band', kans: 1, vereist: 'hars' }],
    kaart: [160, 160], beginWrathPlekken: PLEKKEN, naamStijl: 'nest', naamVorm: 'Hive of {n}' },
  monsters: { familie: 'wildernis', naam: 'MONSTERS', uniek: [U('monsterbot', 'Monster bone'), U('gif', 'Venom')],
    kans: { metaal: 0.3, hout: 0.7, water: 0.6, steen: 0.8 },
    loot: [{ vondst: 'gifkoeling', kans: 3, vereist: 'gif' }, { vondst: 'botten-frame', kans: 2, vereist: 'monsterbot' }, { vondst: 'klauwenval', kans: 1 }],
    kaart: [160, 160], beginWrathPlekken: PLEKKEN, naamStijl: 'hol', naamVorm: 'Lair of {n}' },
  kuddes: { familie: 'wildernis', naam: 'HORDES', uniek: [U('huid', 'Hide'), U('hoorn', 'Horn'), U('mest', 'Dung')],
    kans: { metaal: 0.15, hout: 0.5, water: 0.9, steen: 0.6 },
    loot: [{ vondst: 'mestbrander', kans: 3, vereist: 'mest' }, { vondst: 'hoorn-sirene', kans: 2, vereist: 'hoorn' }, { vondst: 'huid-dak', kans: 1, vereist: 'huid' }],
    kaart: [160, 160], beginWrathPlekken: PLEKKEN, naamStijl: 'trek', naamVorm: 'Herd of {n}' },
  reuzen: { familie: 'bijzonder', naam: 'GIANTS', uniek: [U('reuzenijzer', 'Giant iron'), U('reuzenhaar', 'Giant hair')],
    kans: { metaal: 0.9, hout: 0.8, water: 0.6, steen: 0.7 },
    loot: [{ vondst: 'reuzensmidse', kans: 3, vereist: 'reuzenijzer' }, { vondst: 'haarkabel', kans: 2, vereist: 'reuzenhaar' }, { vondst: 'spijker-mijn', kans: 1, vereist: 'reuzenijzer' }],
    kaart: [200, 200], beginWrathPlekken: PLEKKEN, naamStijl: 'reus', naamVorm: 'Valley of {n}' },
  aliens: { familie: 'bijzonder', naam: 'ALIENS', uniek: [U('xenolegering', 'Xeno alloy'), U('gloeislijm', 'Glowing goo')],
    kans: { metaal: 0.7, hout: 0.3, water: 0.5, steen: 0.6 },
    loot: [{ vondst: 'tractorstraal', kans: 3, vereist: 'xenolegering' }, { vondst: 'slijmreactor', kans: 2, vereist: 'gloeislijm' }, { vondst: 'baken-ontvanger', kans: 1 }],
    kaart: [200, 200], beginWrathPlekken: PLEKKEN, naamStijl: 'vreemd', naamVorm: 'Crash site {n}' },
  tentakelbeest: { familie: 'bijzonder', naam: 'TENTACLE BEAST', uniek: [U('inkt', 'Ink'), U('ichor', 'Ichor')],
    kans: { metaal: 0.2, hout: 0.3, water: 0.9, steen: 0.4 },
    loot: [{ vondst: 'inktreactor', kans: 3, vereist: 'inkt' }, { vondst: 'vleesband', kans: 2, vereist: 'ichor' }, { vondst: 'aderpols', kans: 1 }],
    kaart: [256, 256], beginWrathPlekken: PLEKKEN, naamStijl: 'vlees', naamVorm: '{n}, the Living Ground' },
};

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
