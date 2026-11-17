// De plaatjes van de overvallers voor de kern. Alleen de bewoners die hier al een sprite hebben; de rest leent de stam.
import type { SpriteInfo } from '../kern/types';
import { ARCHETYPES, type VijandSprite } from './archetypes';

const bestanden = import.meta.glob('../../assets/land/*/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const url = (map: string, naam: string) => Object.entries(bestanden).find(([k]) => k.endsWith(`/${map}/${naam}.png`))?.[1];

// De plaatjes en hun maat staan bij elk type (worldtypes/archetypes/*.json: "enemy.sprites" en "residents", de otters). anker = de voeten.
const LIJST = new Map<string, VijandSprite>();
for (const a of Object.values(ARCHETYPES)) for (const sp of [...(a.vijand?.sprites ?? []), ...a.bewoners]) LIJST.set(sp.id, sp);

export function landSprites(): Record<string, SpriteInfo> {
  const uit: Record<string, SpriteInfo> = {};
  for (const [naam, m] of LIJST) {
    const u = url(m.map, naam);
    if (!u) continue;
    const gloed = url(m.map, `${naam}-gloed`);
    uit[naam] = { url: u, gloedUrl: gloed, w: m.w, h: m.h, ankerX: m.ankerX, ankerY: m.ankerY, tegels: 0 };
  }
  return uit;
}
