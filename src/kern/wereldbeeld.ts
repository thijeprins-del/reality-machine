// Tekent de spelstaat: grond, grondstoffen, gebouwen en eenheden, met een gloedlaag voor het neon.
// De factie levert de plaatjes (FactieBeeld); de kern weet niet welke factie het is.
import { Assets, BlurFilter, ColorMatrixFilter, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { naarScherm, TEGEL_B, TEGEL_H } from './iso';
import { dimensieKleur, DIMENSIE_DUUR_SEC, THUIS, type DimensieKleur } from '../data/dimensies';
import type { Blok, Kaart } from './kaart';
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
  private dimensie = 0; // welke dimensie nu getekend is
  private grond = new Container(); // grond, gloeiende vlekken en de ring; nieuw bij elke dimensie
  private grondGloed = new Container();
  private ringGloed = new Graphics();
  private flits = document.createElement('div');

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
    this.wereld.addChild(this.grond, this.markering, this.dingen);
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
    this.grondGloed.blendMode = 'add';
    this.scherp.addChild(this.grondGloed);
    this.waas.addChild(this.ringGloed);

    Object.assign(this.flits.style, { position: 'fixed', inset: '0', background: '#fff', opacity: '0', pointerEvents: 'none', zIndex: '9' });
    document.body.appendChild(this.flits);
    this.nieuweDimensie();
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

  // Bij de stream: nieuwe grond in de kleuren van de nieuwe wereld, nieuwe grondstoffen, en een witte flits.
  private nieuweDimensie(): void {
    const k: Kaart = this.staat.kaart;
    this.dimensie = this.staat.dimensie;
    for (const st of this.afzettingen.values()) for (const d of st.delen) d.destroy();
    this.afzettingen.clear();
    for (const c of [...this.grond.removeChildren(), ...this.grondGloed.removeChildren()]) c.destroy();
    const kleur = dimensieKleur(this.dimensie);
    const [grond, gloed] = tekenGrond(k, kleur);
    this.grond.addChild(grond, tekenRing(k));
    this.grondGloed.addChild(gloed);
    this.ringGloed.clear();
    tekenRing(k, this.ringGloed);
    for (const a of k.afzettingen) {
      const naam = `${a.goed}-${a.variant + 1}`;
      const st = this.maak(naam);
      this.zetGebouw(st, a.x, a.y, 1, (hash01(a.id) < 0.5 ? 1 : -1) as 1 | -1);
      this.afzettingen.set(a.id, st);
    }
    // flits: meteen wit, dan langzaam weg
    this.flits.style.transition = 'none';
    this.flits.style.opacity = '1';
    requestAnimationFrame(() => {
      this.flits.style.transition = 'opacity 0.9s ease-out';
      this.flits.style.opacity = '0';
    });
  }

  werk(sec: number, selectie: Set<number>): void {
    this.t += sec;
    if (this.staat.dimensie !== this.dimensie) this.nieuweDimensie();
    // de ring laadt op in de laatste 10 seconden voor de stream
    const rest = DIMENSIE_DUUR_SEC - this.staat.tijd;
    const laad = Math.max(0, 1 - rest / 10);
    this.ringGloed.alpha = laad * (0.6 + 0.4 * Math.sin(this.t * (6 + laad * 20)));
    this.grondGloed.alpha = 0.7 + 0.3 * Math.sin(this.t * 1.7);
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

// Grond: binnen de ring je eigen grauwe tegels, erbuiten de kleuren van de wereld. Vlekken die gloeien (lava, gif,
// kristal) gaan ook in de gloedlaag. Aan de voorkant een rand aarde en rots.
function tekenGrond(k: Kaart, wereld: DimensieKleur): [Graphics, Graphics] {
  const g = new Graphics();
  const gl = new Graphics();
  const { breed, diep } = k;
  for (let rij = 0; rij < diep; rij++)
    for (let kol = 0; kol < breed; kol++) {
      const { x, y } = naarScherm(kol, rij);
      const thuis = Math.hypot(kol - k.ring.x, rij - k.ring.y) <= k.ring.r;
      const p = thuis ? THUIS : wereld;
      const h = hash01(rij * 1000 + kol + (thuis ? 0 : k.afzettingen.length * 7919));
      g.poly([x, y - TEGEL_H / 2, x + TEGEL_B / 2, y, x, y + TEGEL_H / 2, x - TEGEL_B / 2, y]).fill(p.grond[Math.floor(h * p.grond.length)]);
      const v = hash01(h * 1e6);
      if (v < p.vlekKans) {
        const vx = x - 8 + Math.round(v * 400) % 14, vy = y - 2 + Math.round(v * 900) % 4;
        g.rect(vx, vy, 4 + Math.round(v * 77) % 6, 2).fill(p.vlek);
        if (p.vlekGloeit) gl.rect(vx, vy, 4 + Math.round(v * 77) % 6, 2).fill(p.vlek);
      } else if (h < 0.06) g.rect(x - 4 + Math.round(h * 300) % 10, y, 2, 2).fill(0x34342f);
    }
  const dikte = 40;
  for (let i = 0; i < breed; i++) {
    const { x, y } = naarScherm(i, diep - 1);
    g.poly([x - TEGEL_B / 2, y, x, y + TEGEL_H / 2, x, y + TEGEL_H / 2 + dikte, x - TEGEL_B / 2, y + dikte]).fill(wereld.rand[0]);
  }
  for (let i = 0; i < diep; i++) {
    const { x, y } = naarScherm(breed - 1, i);
    g.poly([x, y + TEGEL_H / 2, x + TEGEL_B / 2, y, x + TEGEL_B / 2, y + dikte, x, y + TEGEL_H / 2 + dikte]).fill(wereld.rand[1]);
  }
  return [g, gl];
}

// De transportring: slecht geverfde gele streepjes, op pixelmaat. Verf mist hier en daar, kleur wisselt, randen rafelen.
// Met `gloed` erbij: dezelfde streepjes in neon voor de gloedlaag (de ring laadt op voor de stream).
function tekenRing(k: Kaart, gloed?: Graphics): Graphics {
  const g = gloed ?? new Graphics();
  const { x: cx, y: cy, r } = k.ring;
  const omtrek = 2 * Math.PI * r;
  const streepjes = Math.round(omtrek / 1.6);
  const verf = [0xb8941c, 0xc9a224, 0xa88618, 0xd4ae2a, 0x9c7c16];
  for (let s = 0; s < streepjes; s++) {
    const h = hash01(s * 31 + 7);
    const a0 = (s / streepjes) * Math.PI * 2 + (h - 0.5) * 0.03;
    const lang = (0.95 + h * 0.35) / r; // in radialen
    const stappen = Math.round(lang * r * 18);
    for (let i = 0; i <= stappen; i++) {
      const a = a0 + (i / stappen) * lang;
      for (let j = -2; j <= 2; j++) {
        const rr = r + j * 0.07 + (hash01(s * 1000 + i) - 0.5) * 0.05;
        const p = naarScherm(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        const px = Math.round(p.x / PIXEL) * PIXEL, py = Math.round(p.y / PIXEL) * PIXEL;
        const ruis = hash01(s * 7919 + i * 31 + j);
        const rand = Math.abs(j) === 2 || i === 0 || i === stappen;
        if (ruis < (rand ? 0.45 : 0.1)) continue; // afgebladderd
        if (gloed) {
          if (ruis > 0.5) g.rect(px, py, PIXEL, PIXEL).fill(0xffd23f);
        } else g.rect(px, py, PIXEL, PIXEL).fill({ color: verf[Math.floor(ruis * verf.length)], alpha: 0.7 + ruis * 0.3 });
      }
    }
  }
  return g;
}
