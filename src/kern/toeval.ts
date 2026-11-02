// Toeval voor spelregels: altijd uit de seed (mulberry32), zodat een run met dezelfde seed hetzelfde loopt.
export function volgende(staat: { toeval: number }): number {
  let t = (staat.toeval = (staat.toeval + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Vaste ruis per getal (bv. per eenheid), zonder de toevalsstroom te verbruiken.
export function hash01(n: number): number {
  let t = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  t ^= t >>> 13;
  t = Math.imul(t, 0xc2b2ae35);
  t ^= t >>> 16;
  return (t >>> 0) / 4294967296;
}
