// Kleine pixel-tekenbibliotheek voor sprites. Geen afhankelijkheden: schrijft PNG met node:zlib.
// Iso-afspraak: 1 sprite-pixel = 1 pixelmaat. Een tegel is 32 x 16 sprite-pixels (in het spel x2 = 64 x 32).
// Iso-eenheid: 1 stap langs kol = (+2, +1), langs rij = (-2, +1). Een tegel is 8 stappen.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

export function hex(h, a = 255) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

export class Doek {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Uint8ClampedArray(w * h * 4);
  }
  binnen(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x, y) {
    if (!this.binnen(x, y)) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    return [this.px[i], this.px[i + 1], this.px[i + 2], this.px[i + 3]];
  }
  vol(x, y) {
    return this.get(x, y)[3] > 0;
  }
  zet(x, y, kleur) {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.binnen(x, y) || !kleur) return;
    const c = typeof kleur === 'string' ? hex(kleur) : kleur;
    const i = (y * this.w + x) * 4;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
    this.px[i + 3] = c[3];
  }
  // Meng een kleur over een bestaande pixel (voor neon-gloed). Lege pixels blijven leeg.
  meng(x, y, kleur, f) {
    if (!this.vol(x, y)) return;
    const o = this.get(x, y);
    const c = hex(kleur);
    this.zet(x, y, [o[0] + (c[0] - o[0]) * f, o[1] + (c[1] - o[1]) * f, o[2] + (c[2] - o[2]) * f, 255]);
  }
  rect(x, y, w, h, kleur) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.zet(x + i, y + j, kleur);
  }
  lijn(x0, y0, x1, y1, kleur) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      this.zet(x0, y0, kleur);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // Iso-lijn in nette 2:1-trapjes.
  isoLijn(x, y, stappen, richting, kleur) {
    // richting: 'kol' (+2,+1), 'rij' (-2,+1)
    const sx = richting === 'kol' ? 1 : -1;
    for (let s = 0; s < stappen; s++) {
      this.zet(x + sx * 2 * s, y + s, kleur);
      this.zet(x + sx * (2 * s + 1), y + s, kleur);
    }
  }
  // Vul veelhoek (punten [[x,y],...]) met test op pixelmiddens.
  veelhoek(pt, kleur) {
    const xs = pt.map((p) => p[0]), ys = pt.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        const px = x + 0.5, py = y + 0.5;
        let in_ = false;
        for (let i = 0, j = pt.length - 1; i < pt.length; j = i++) {
          const [xi, yi] = pt[i], [xj, yj] = pt[j];
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) in_ = !in_;
        }
        if (in_) this.zet(x, y, kleur);
      }
    }
  }
  // Iso-blok. (x,y) = achterhoek op de grond. u = stappen langs kol, v = langs rij, h = hoogte in pixels.
  // k = { boven, links, rechts } en optioneel rand (lichte bovenrand).
  blok(x, y, u, v, h, k) {
    const P0 = [x, y], P1 = [x + 2 * u, y + u], P2 = [x + 2 * u - 2 * v, y + u + v], P3 = [x - 2 * v, y + v];
    const op = (p) => [p[0], p[1] - h];
    // links-voor: P3 -> P2, rechts-voor: P2 -> P1
    this.veelhoek([P3, P2, op(P2), op(P3)], k.links);
    this.veelhoek([P2, P1, op(P1), op(P2)], k.rechts);
    this.veelhoek([op(P0), op(P1), op(P2), op(P3)], k.boven);
    if (k.rand) {
      this.isoLijn(Math.round(op(P3)[0]), Math.round(op(P3)[1]), u, 'kol', k.rand);
      this.isoLijn(Math.round(op(P1)[0]) - 1, Math.round(op(P1)[1]), v, 'rij', k.rand);
    }
    return { P0, P1, P2, P3, h };
  }
  // Hangende kabel van a naar b met doorhang d. Donkere kern, eventueel glimlijn.
  kabel(ax, ay, bx, by, d, kleur, glim) {
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2 + 2;
    const mx = (ax + bx) / 2, my = (ay + by) / 2 + d;
    let vx = null, vy = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * mx + t * t * bx;
      const y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * my + t * t * by;
      const rx = Math.round(x), ry = Math.round(y);
      if (rx === vx && ry === vy) continue;
      this.zet(rx, ry, kleur);
      if (glim) this.zet(rx, ry - 1, glim);
      vx = rx; vy = ry;
    }
  }
  // Neonlampje: felle kern plus gloed in de buurpixels.
  neon(x, y, kleur, straal = 2) {
    for (let j = -straal; j <= straal; j++)
      for (let i = -straal; i <= straal; i++) {
        const d = Math.abs(i) + Math.abs(j);
        if (d > 0 && d <= straal) this.meng(x + i, y + j, kleur, 0.45 / d);
      }
    this.zet(x, y, kleur);
  }
  // Donkere buitenlijn rond alles wat gevuld is (4-buren).
  omlijn(kleur) {
    const k = hex(kleur);
    const zet = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (!this.vol(x, y) && (this.vol(x - 1, y) || this.vol(x + 1, y) || this.vol(x, y - 1) || this.vol(x, y + 1)))
          zet.push([x, y]);
    for (const [x, y] of zet) this.zet(x, y, k);
  }
  // Plak een ander doek erop (alleen gevulde pixels).
  plak(ander, ox, oy) {
    for (let y = 0; y < ander.h; y++)
      for (let x = 0; x < ander.w; x++) if (ander.vol(x, y)) this.zet(ox + x, oy + y, ander.get(x, y));
  }
  schaal(f) {
    const d = new Doek(this.w * f, this.h * f);
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) d.zet(x, y, this.get(Math.floor(x / f), Math.floor(y / f)));
    return d;
  }
  png(pad) {
    writeFileSync(pad, naarPng(this.w, this.h, this.px));
  }
}

// Vaste ruis zodat het script elke keer dezelfde pixels geeft.
export function ruis(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const crcTabel = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTabel[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function stuk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function naarPng(w, h, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const rauw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    rauw[y * (w * 4 + 1)] = 0;
    Buffer.from(px.buffer, y * w * 4, w * 4).copy(rauw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    stuk('IHDR', ihdr),
    stuk('IDAT', deflateSync(rauw, { level: 9 })),
    stuk('IEND', Buffer.alloc(0)),
  ]);
}
