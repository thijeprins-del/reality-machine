// De plaatjes van de muizen voor de kern: welke sprite hoort bij welke eenheid of welk gebouw.
import { economieen } from '../kern/economie';
import type { SoortBeeld, SpriteInfo } from '../kern/types';
import { MUIZEN_SPRITES } from './sprites';

const bestanden = import.meta.glob('../../assets/muizen/*.png', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>;

const url = (naam: string) => Object.entries(bestanden).find(([k]) => k.endsWith(`/${naam}.png`))?.[1];

export function rattenBeeld(): SoortBeeld {
  const sprites: Record<string, SpriteInfo> = {};
  for (const [naam, m] of Object.entries(MUIZEN_SPRITES)) {
    const u = url(naam);
    if (!u) continue;
    sprites[naam] = { ...m, url: u, gloedUrl: m.gloed ? url(`${naam}-gloed`) : undefined };
  }
  // Een rat met een bundel op de rug: voor elk goed waarvan er zo'n plaatje is (muis-<sprite>), anders de gewone rat.
  const lading: Record<string, string> = {};
  for (const e of economieen()) for (const g of e.goederen.values()) if (sprites[`muis-${g.sprite ?? g.id}`]) lading[g.id] = `muis-${g.sprite ?? g.id}`;
  return { sprites, lading };
}
