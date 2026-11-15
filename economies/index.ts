// De lijst van economieën. Een nieuw bestand in deze map: hier één import en één regel in de lijst erbij.
// (Geen automatische map-lezer: de wereldgalerij bundelt met esbuild en die kent import.meta.glob niet.)
import schroot from './schroot.json';
import aarde from './aarde.json';
import gifwoud from './gifwoud.json';
import magmaveld from './magmaveld.json';
import kristaltoendra from './kristaltoendra.json';
import zoutzee from './zoutzee.json';

export const ECONOMIE_BESTANDEN: unknown[] = [schroot, aarde, gifwoud, magmaveld, kristaltoendra, zoutzee];
