// De plaatjes van de muizen voor de kern: welke sprite hoort bij welke eenheid of welk gebouw.
import type { FactieBeeld, SpriteInfo } from '../kern/types';
import { MUIZEN_SPRITES } from './sprites';

const bestanden = import.meta.glob('../../assets/muizen/*.png', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>;

const url = (naam: string) => Object.entries(bestanden).find(([k]) => k.endsWith(`/${naam}.png`))?.[1];

export function muizenBeeld(): FactieBeeld {
  const sprites: Record<string, SpriteInfo> = {};
  for (const [naam, m] of Object.entries(MUIZEN_SPRITES)) {
    const u = url(naam);
    if (!u) continue;
    sprites[naam] = { ...m, url: u, gloedUrl: m.gloed ? url(`${naam}-gloed`) : undefined };
  }
  return { sprites, lading: { schroot: 'muis-schroot', hout: 'muis-hout', kristal: 'muis-kristal' } };
}
