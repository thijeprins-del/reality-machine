// De plaatjes van de ratten voor de kern: welke sprite hoort bij welke eenheid, welk gebouw of welk goed.
import { economieen, type GoedSoort } from '../kern/economie';
import type { SoortBeeld, SpriteInfo } from '../kern/types';
import { MUIZEN_SPRITES } from './sprites';

const bestanden = import.meta.glob('../../assets/muizen/*.png', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>;

// Plaatjes van goederen (assets/goederen/): hoop-<sprite> (28 x 24) voor de hopen in de opslag en de iconen in de balk,
// last-<sprite> (18 x 18) voor het brokje op een band en bij de voet van een gebouw. De velden laadt kern/wereldbeeld.ts.
const goederen = import.meta.glob('../../assets/goederen/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const HOOP = { w: 28, h: 24, ankerX: 14, ankerY: 19, tegels: 0, gloed: false };
const LAST = { w: 18, h: 18, ankerX: 9, ankerY: 15, tegels: 0, gloed: false };

const url = (naam: string) => Object.entries(bestanden).find(([k]) => k.endsWith(`/${naam}.png`))?.[1];
const goedUrl = (naam: string) => Object.entries(goederen).find(([k]) => k.endsWith(`/${naam}.png`))?.[1];
// Het icoon van een goed: zijn hoopje (eerst op zijn sprite, dan op zijn id). Geen plaatje: undefined.
export const goedIcoon = (g: GoedSoort): string | undefined =>
  goedUrl(`hoop-${g.sprite ?? g.id}`) ?? url(`hoop-${g.sprite ?? g.id}`) ?? goedUrl(`hoop-${g.id}`) ?? url(`hoop-${g.id}`);

export function rattenBeeld(): SoortBeeld {
  const sprites: Record<string, SpriteInfo> = {};
  for (const [naam, m] of Object.entries(MUIZEN_SPRITES)) {
    const u = url(naam);
    if (!u) continue;
    sprites[naam] = { ...m, url: u, gloedUrl: m.gloed ? url(`${naam}-gloed`) : undefined };
  }
  for (const pad of Object.keys(goederen)) {
    const naam = pad.slice(pad.lastIndexOf('/') + 1, -4);
    if (naam.startsWith('hoop-')) sprites[naam] = { ...HOOP, url: goederen[pad] };
    if (naam.startsWith('last-')) sprites[naam] = { ...LAST, url: goederen[pad] };
  }
  // Een rat met een bundel op de rug: voor elk goed waarvan er zo'n plaatje is (muis-<sprite>), anders de gewone rat.
  const lading: Record<string, string> = {};
  for (const e of economieen()) for (const g of e.goederen.values()) {
    const naam = [`muis-${g.sprite ?? g.id}`, `muis-${g.id}`].find((n) => sprites[n]);
    if (naam && !lading[g.id]) lading[g.id] = naam;
  }
  return { sprites, lading };
}
