// De plaatjes van de overvallers voor de kern. Alleen de bewoners die hier al een sprite hebben; de rest leent de stam.
import type { SpriteInfo } from '../kern/types';

const bestanden = import.meta.glob('../../assets/land/{steentijd,insecten}/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const url = (map: string, naam: string) => Object.entries(bestanden).find(([k]) => k.endsWith(`/${map}/${naam}.png`))?.[1];

// anker = de voeten
const LIJST: Record<string, { map: string; w: number; h: number; ankerX: number; ankerY: number }> = {
  speerwerper: { map: 'steentijd', w: 16, h: 24, ankerX: 8, ankerY: 23 },
  knotsdrager: { map: 'steentijd', w: 16, h: 24, ankerX: 8, ankerY: 23 },
  kever: { map: 'insecten', w: 30, h: 20, ankerX: 15, ankerY: 17 },
  mier: { map: 'insecten', w: 26, h: 16, ankerX: 13, ankerY: 14 },
};

export function landSprites(): Record<string, SpriteInfo> {
  const uit: Record<string, SpriteInfo> = {};
  for (const [naam, m] of Object.entries(LIJST)) {
    const u = url(m.map, naam);
    if (!u) continue;
    const gloed = url(m.map, `${naam}-gloed`);
    uit[naam] = { url: u, gloedUrl: gloed, w: m.w, h: m.h, ankerX: m.ankerX, ankerY: m.ankerY, tegels: 0 };
  }
  return uit;
}
