// De lijst van wereldtypes. Een nieuw bestand in deze map: hier één import en één regel in de lijst erbij.
// De volgorde telt niet voor het spel: de generator rolt een tegelset en kiest daarna een wereldtype met die tegelset.
import roestduin from './roestduin.json';
import kristaltoendra from './kristaltoendra.json';
import gifwoud from './gifwoud.json';
import magmaveld from './magmaveld.json';
import zoutzee from './zoutzee.json';
import aarde from './aarde.json';

export const WERELDTYPE_BESTANDEN: unknown[] = [roestduin, kristaltoendra, gifwoud, magmaveld, zoutzee, aarde];
