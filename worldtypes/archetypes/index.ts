// De lijst van archetypes (de soorten dimensie: Stone age, Bugs, Giants, ...). Een nieuw bestand in deze map: hier één import en één regel
// in de lijst erbij. Elk bestand: naam, familie, kaartmaat, grondstoffen, loot en de vijand (raiders, sprites, aanvalsstijl).
import steentijd from './steentijd.json';
import oudheid from './oudheid.json';
import middeleeuwen from './middeleeuwen.json';
import industrieel from './industrieel.json';
import modern from './modern.json';
import scifi from './scifi.json';
import insecten from './insecten.json';
import monsters from './monsters.json';
import kuddes from './kuddes.json';
import reuzen from './reuzen.json';
import aliens from './aliens.json';
import tentakelbeest from './tentakelbeest.json';

export const ARCHETYPE_BESTANDEN: unknown[] = [steentijd, oudheid, middeleeuwen, industrieel, modern, scifi, insecten, monsters, kuddes, reuzen, aliens, tentakelbeest];
