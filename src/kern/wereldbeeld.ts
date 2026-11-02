// Tekent de spelstaat: grond, grondstoffen, gebouwen en eenheden, met een gloedlaag voor het neon.
// De factie levert de plaatjes (FactieBeeld); de kern weet niet welke factie het is.
import { Assets, BlurFilter, ColorMatrixFilter, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { naarScherm, TEGEL_B, TEGEL_H } from './iso';
import type { Blok } from './kaart';
import type { SpelStaat } from './spel';
import { hash01 } from './toeval';
import type { FactieBeeld, SpriteInfo } from './types';
import { WERELD_SPRITES } from './wereld-sprites';

export const PIXEL = 2; // één pixelmaat: elke sprite-pixel is 2 schermpixels bij zoom 1

const wereldBestanden = import.meta.glob('../../assets/wereld/*.png', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>;
const wereldUrl = (naam: string) => Object.entries(wereldBestanden).find(([k]) => k.endsWith(`/${naam}.png`))?.[1];

function wereldSprites(): Record<string, SpriteInfo> {
  const uit: Record<string, SpriteInfo> = {};
  for (const [naam, m] of Object.entries(WERELD_SPRITES)) {
    const u = wereldUrl(naam);
    if (u) uit[naam] = { ...m, url: u, gloedUrl: m.gloed ? wereldUrl(`${naam}-gloed`) : undefined };
  }
  return uit;
}

interface Stuk {
  delen: Sprite[]; // lijf plus gloedlagen
  naam: string;
}

export class WereldBeeld {
  readonly wereld = new Container();
  private dingen = new Container();
  private markering = new Graphics();
  private scherp = new Container();
  private waas = new Container();
  private waas2 = new Container();
  private blur = new BlurFilter({ strength: 7, quality: 3 });
  private blur2 = new BlurFilter({ strength: 22, quality: 4 });
  private texturen = new Map<string, Texture>();
  private sprites: Record<string, SpriteInfo>;
  private werkers: Stuk[] = [];
  private afzettingen = new Map<number, Stuk>();
  private t = 0;

  constructor(
    private staat: SpelStaat,
    private beeld: FactieBeeld,
  ) {
    this.sprites = { ...wereldSprites(), ...beeld.sprites };
  }

  async laad(): Promise<void> {
    await Promise.all(
      Object.entries(this.sprites).flatMap(([naam, s]) => [
        this.laadTex(naam, s.url),
        s.gloedUrl ? this.laadTex(`${naam}-gloed`, s.gloedUrl) : Promise.resolve(),
      ]),
    );
    const k = this.staat.kaart;
    this.wereld.addChild(tekenGrond(k.breed, k.diep), this.markering, this.dingen);
    this.dingen.sortableChildren = true;

    const fel = (f: number) => {
      const cm = new ColorMatrixFilter();
      cm.brightness(f, false);
      return cm;
    };
    this.waas.filters = [this.blur, fel(3)];
    this.waas.blendMode = 'add';
    this.waas2.filters = [this.blur2, fel(6)];
    this.waas2.blendMode = 'add';
    this.waas2.alpha = 0.8;
    this.wereld.addChild(this.waas2, this.waas, this.scherp);

    for (const a of k.afzettingen) {
      const naam = `${a.goed}-${a.variant + 1}`;
      const st = this.maak(naam);
      this.zetGebouw(st, a.x, a.y, 1, (hash01(a.id) < 0.5 ? 1 : -1) as 1 | -1);
      this.afzettingen.set(a.id, st);
    }
    for (const [naam, b] of [['machine', k.machine], ['opslag', k.opslag]] as [string, Blok][]) {
      const st = this.maak(naam);
      this.zetGebouw(st, b.x, b.y, b.breed, 1);
    }
    for (const w of this.staat.werkers) this.werkers.push(this.maak(w.soort, true));
  }

  // Zoom van de wereld: de gloed moet meeschalen, anders wordt hij te scherp of te vaag.
  zoom(z: number): void {
    this.blur.strength = 7 * z;
    this.blur2.strength = 22 * z;
    this.blur.padding = 30 * z;
    this.blur2.padding = 90 * z;
  }

  werk(sec: number, selectie: Set<number>): void {
    this.t += sec;
    const hapering = Math.random() < 0.015 ? 0.35 : 1;
    this.waas.alpha = (0.85 + 0.15 * Math.sin(this.t * 2.1) * Math.sin(this.t * 7.3)) * hapering;

    for (const a of this.staat.kaart.afzettingen) {
      const st = this.afzettingen.get(a.id);
      if (st && a.rest <= 0) {
        for (const d of st.delen) d.destroy();
        this.afzettingen.delete(a.id);
      }
    }

    this.markering.clear();
    this.staat.werkers.forEach((w, i) => {
      const st = this.werkers[i];
      const naam = (w.lading && this.beeld.lading?.[w.lading.goed]) || w.soort;
      if (st.naam !== naam) this.wissel(st, naam);
      const loopt = w.taak !== 'rust' && w.taak !== 'graven';
      const fase = hash01(w.id) * 10;
      // lopen = huppelen, graven = snel op en neer
      const hup = loopt
        ? Math.sin(this.t * 14 + fase) > 0.3 ? PIXEL : 0
        : w.taak === 'graven' && Math.sin(this.t * 22 + fase) > 0 ? PIXEL : 0;
      this.zetEenheid(st, w.x, w.y, w.kijkt, hup);
      if (selectie.has(w.id)) {
        const p = naarScherm(w.x, w.y);
        this.markering.ellipse(p.x, p.y, 7, 3.5);
      }
    });
    if (selectie.size) this.markering.stroke({ width: 1, color: 0x9dff2e, alpha: 0.7 });
  }

  private async laadTex(naam: string, url: string): Promise<void> {
    const tex = await Assets.load<Texture>(url);
    tex.source.scaleMode = 'nearest';
    this.texturen.set(naam, tex);
  }

  // Eenheden krijgen alleen de scherpe gloed: honderden wazige brilletjes worden één groene mist.
  private maak(naam: string, eenheid = false): Stuk {
    const delen = [new Sprite(this.texturen.get(naam))];
    this.dingen.addChild(delen[0]);
    const gloed = this.texturen.get(`${naam}-gloed`);
    if (gloed)
      for (const laag of eenheid ? [this.scherp] : [this.scherp, this.waas, this.waas2]) {
        const g = new Sprite(gloed);
        if (laag === this.scherp) g.blendMode = 'add';
        laag.addChild(g);
        delen.push(g);
      }
    return { delen, naam };
  }

  private wissel(st: Stuk, naam: string): void {
    st.naam = naam;
    st.delen[0].texture = this.texturen.get(naam)!;
    const gloed = this.texturen.get(`${naam}-gloed`);
    for (const d of st.delen.slice(1)) {
      d.visible = !!gloed;
      if (gloed) d.texture = gloed;
    }
  }

  // Gebouw of grondstof: anker op de achterhoek van tegel (x, y). Tekenvolgorde op de voorste hoek.
  private zetGebouw(st: Stuk, x: number, y: number, tegels: number, spiegel: 1 | -1): void {
    const m = this.sprites[st.naam];
    const p = naarScherm(x, y);
    const px = p.x - m.ankerX * PIXEL * spiegel, py = p.y - TEGEL_H / 2 - m.ankerY * PIXEL;
    for (const d of st.delen) {
      d.scale.set(PIXEL * spiegel, PIXEL);
      d.position.set(px, py);
    }
    st.delen[0].zIndex = (x + y + 2 * (tegels - 1)) * 10;
  }

  // Eenheid: voeten op (x, y). Kijkt naar links = gespiegeld.
  private zetEenheid(st: Stuk, x: number, y: number, kijkt: 1 | -1, hup: number): void {
    const m = this.sprites[st.naam];
    const p = naarScherm(x, y);
    const px = Math.round(p.x - m.ankerX * PIXEL * kijkt), py = Math.round(p.y - m.ankerY * PIXEL - hup);
    for (const d of st.delen) {
      d.scale.set(PIXEL * kijkt, PIXEL);
      d.position.set(px, py);
    }
    st.delen[0].zIndex = (x + y) * 10 + 3;
  }
}

// Grauwe grond: donkere tegels met wat vlekken, en een rand aarde en rots aan de voorkant van het eiland.
function tekenGrond(breed: number, diep: number): Graphics {
  const g = new Graphics();
  const kleuren = [0x1d1e1c, 0x21221f, 0x1a1b19, 0x242521, 0x1f1d1a];
  for (let rij = 0; rij < diep; rij++)
    for (let kol = 0; kol < breed; kol++) {
      const { x, y } = naarScherm(kol, rij);
      const h = hash01(rij * 1000 + kol);
      g.poly([x, y - TEGEL_H / 2, x + TEGEL_B / 2, y, x, y + TEGEL_H / 2, x - TEGEL_B / 2, y]).fill(
        kleuren[Math.floor(h * kleuren.length)],
      );
      // een vlek olie of een steentje hier en daar
      if (h > 0.85) g.rect(x - 6 + Math.round(h * 40) % 12, y - 2, 4, 2).fill(0x121210);
      else if (h < 0.08) g.rect(x - 4 + Math.round(h * 300) % 10, y, 2, 2).fill(0x34342f);
    }
  const dikte = 40;
  for (let i = 0; i < breed; i++) {
    const { x, y } = naarScherm(i, diep - 1);
    g.poly([x - TEGEL_B / 2, y, x, y + TEGEL_H / 2, x, y + TEGEL_H / 2 + dikte, x - TEGEL_B / 2, y + dikte]).fill(0x1f1813);
  }
  for (let i = 0; i < diep; i++) {
    const { x, y } = naarScherm(breed - 1, i);
    g.poly([x, y + TEGEL_H / 2, x + TEGEL_B / 2, y, x + TEGEL_B / 2, y + dikte, x, y + TEGEL_H / 2 + dikte]).fill(0x16110d);
  }
  return g;
}
