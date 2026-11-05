// Tekent de spelstaat: grond, grondstoffen, gebouwen en eenheden, met een gloedlaag voor het neon.
// De factie levert de plaatjes (FactieBeeld); de kern weet niet welke factie het is.
import { Assets, BlurFilter, ColorMatrixFilter, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { naarScherm, TEGEL_B, TEGEL_H } from './iso';
import { dimensieKleur, DIMENSIE_DUUR_SEC, HOOGTE_MIN, HOOGTE_PX, SPRONG_SEC, THUIS, type DimensieWereld } from '../data/dimensies';
import { schijfStraal, type Blok, type Kaart } from './kaart';
import type { SpelStaat } from './spel';
import { hoeken, hoogteOp, knikLinksRechts, TEGEL_KLIP, TEGEL_WATER } from './terrein';
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
  private gemist = 0;
  // grond: de wereld eromheen (nieuw per dimensie) en je eigen schijf (blijft)
  private ruimte = new Graphics(); // het niets tussen twee werelden
  private wereldGrond = new Container();
  private oudeGrond: Container | null = null; // de vorige wereld, die wegvalt
  private schijf = new Container();
  private grondGloed = new Container();
  private fx = new Fx();
  private flits = document.createElement('div');
  private duister = document.createElement('div');
  private schud = 0;

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
    this.wereld.addChild(this.ruimte, this.wereldGrond, this.schijf, this.markering, this.dingen);
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
    const los = new Container();
    this.wereld.addChildAt(los, this.wereld.getChildIndex(this.dingen) + 1);
    this.fx.hang(this.scherp, this.waas, los);

    const vast = { position: 'fixed', inset: '0', opacity: '0', pointerEvents: 'none' };
    Object.assign(this.flits.style, vast, { background: '#fff', zIndex: '9' });
    Object.assign(this.duister.style, vast, {
      background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.92) 78%)',
      zIndex: '4',
    });
    document.body.append(this.duister, this.flits);
    this.schijf.addChild(tekenSchijf(k));
    this.dimensie = this.staat.dimensie;
    this.gemist = this.staat.gemist;
    this.bouwWereld();
    for (const [naam, b] of [['machine', k.machine], ['opslag', k.opslag]] as [string, Blok][]) {
      const st = this.maak(naam);
      this.zetGebouw(st, b.x, b.y, b.breed, 1);
    }
    for (const w of this.staat.werkers) this.werkers.push(this.maak(w.soort, true));
    if (this.staat.onderweg > 0) {
      // begin van het spel: eerst in het niets, dan landen
      this.landing = false;
      this.wereldGrond.visible = false;
      this.grondGloed.visible = false;
      for (const st of this.afzettingen.values()) for (const d of st.delen) d.visible = false;
    }
  }

  // Zoom van de wereld: de gloed moet meeschalen, anders wordt hij te scherp of te vaag.
  zoom(z: number): void {
    this.blur.strength = 7 * z;
    this.blur2.strength = 22 * z;
    this.blur.padding = 30 * z;
    this.blur2.padding = 90 * z;
  }

  // De wereld rond de schijf: grond in de kleuren van deze dimensie en de grondstoffen.
  private bouwWereld(): void {
    const k: Kaart = this.staat.kaart;
    for (const st of this.afzettingen.values()) for (const d of st.delen) d.destroy();
    this.afzettingen.clear();
    for (const c of this.grondGloed.removeChildren()) c.destroy();
    const [grond, gloed] = tekenGrond(k, dimensieKleur(this.staat.dimensie));
    this.wereldGrond.addChild(grond);
    this.grondGloed.addChild(gloed);
    for (const a of k.afzettingen) {
      const naam = `${a.goed}-${a.variant + 1}`;
      const st = this.maak(naam);
      this.zetGebouw(st, a.x, a.y, 1, (hash01(a.id) < 0.5 ? 1 : -1) as 1 | -1);
      this.afzettingen.set(a.id, st);
    }
  }

  private flitsNu(kleur: string, sterk: number, uit: number): void {
    this.flits.style.background = kleur;
    this.flits.style.transition = 'none';
    this.flits.style.opacity = String(sterk);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        this.flits.style.transition = `opacity ${uit}s ease-out`;
        this.flits.style.opacity = '0';
      }),
    );
  }

  // Stream gehaald: de oude wereld wordt eronder weggerukt, de nieuwe pas zichtbaar bij de landing.
  private sprong(): void {
    this.dimensie = this.staat.dimensie;
    const k = this.staat.kaart;
    this.oudeGrond?.destroy({ children: true });
    this.oudeGrond = new Container();
    this.oudeGrond.addChild(...this.wereldGrond.removeChildren());
    this.wereld.addChildAt(this.oudeGrond, 1);
    this.bouwWereld();
    this.wereldGrond.visible = false;
    this.grondGloed.visible = false;
    for (const st of this.afzettingen.values()) for (const d of st.delen) d.visible = false;
    this.flitsNu('#fff', 1, 1.4);
    this.schud = 16;
    const m = machineTop(k);
    for (let i = 0; i < 26; i++) this.fx.bliksem(m, ringPunt(k, Math.random() * Math.PI * 2), 0.25 + Math.random() * 0.3);
    this.fx.golf(k, 0, 0xffffff);
    this.fx.golf(k, 0.12, 0x4ef2ff);
    this.fx.vonkenRing(k, 260, 0xbff6ff, 1);
    this.landing = false;
  }
  private landing = true;

  private landt(): void {
    const k = this.staat.kaart;
    this.landing = true;
    this.oudeGrond?.destroy({ children: true });
    this.oudeGrond = null;
    this.wereldGrond.visible = true;
    this.grondGloed.visible = true;
    for (const st of this.afzettingen.values()) for (const d of st.delen) d.visible = true;
    this.flitsNu(`#${dimensieKleur(this.dimensie).vlek.toString(16).padStart(6, '0')}`, 0.7, 0.9);
    this.schud = 22;
    this.fx.golf(k, 0, 0xffffff);
    this.fx.golf(k, 0.1, 0xffd23f);
    this.fx.golf(k, 0.22, 0xffffff);
    this.fx.stof(k, 220);
  }

  // Stream gemist: de machine had geen volle stroom. Vonken en rook, rood licht, en je blijft hier.
  private mis(): void {
    const k = this.staat.kaart;
    this.flitsNu('#ff2a1a', 0.55, 1.2);
    this.schud = 7;
    const m = machineTop(k);
    for (let i = 0; i < 10; i++) {
      const doel = ringPunt(k, Math.random() * Math.PI * 2);
      const half = { x: m.x + (doel.x - m.x) * (0.25 + Math.random() * 0.3), y: m.y + (doel.y - m.y) * (0.25 + Math.random() * 0.3) };
      this.fx.bliksem(m, half, 0.2 + Math.random() * 0.2, 0xff6a1a);
    }
    this.fx.vonken(m.x, m.y, 120, 0xffa02a, 0.9);
  }

  werk(sec: number, selectie: Set<number>): void {
    this.t += sec;
    const s = this.staat;
    const k = s.kaart;
    if (s.dimensie !== this.dimensie) this.sprong();
    if (s.gemist !== this.gemist) {
      this.gemist = s.gemist;
      this.mis();
    }
    const vol = s.machine.energie >= s.machine.maxEnergie;
    const m = machineTop(k);

    // aanloop: de laatste 12 seconden voor de stream
    const rest = DIMENSIE_DUUR_SEC - s.tijd;
    const aan = s.onderweg > 0 ? 0 : Math.max(0, 1 - rest / 12);
    let duister = 0;
    if (aan > 0) {
      if (vol) {
        if (Math.random() < 0.04 + aan * aan * 0.7) this.fx.bliksem(m, ringPunt(k, Math.random() * Math.PI * 2), 0.06 + Math.random() * 0.1);
        if (Math.random() < aan * 0.6) {
          const a = Math.random() * Math.PI * 2;
          this.fx.bliksem(ringPunt(k, a), ringPunt(k, a + 0.15 + Math.random() * 0.3), 0.05 + Math.random() * 0.08);
        }
        if (Math.random() < aan * 0.5) this.fx.vonkenRing(k, 2, 0xbff6ff, 0.4);
        this.schud = Math.max(this.schud, aan * aan * aan * 7);
        duister = aan * 0.75 * (Math.random() < 0.06 ? 0.4 : 1);
      } else if (Math.random() < aan * 0.08) {
        // te weinig stroom: het sputtert en haalt de ring niet
        const doel = ringPunt(k, Math.random() * Math.PI * 2);
        this.fx.bliksem(m, { x: (m.x + doel.x) / 2, y: (m.y + doel.y) / 2 }, 0.08, 0xff6a1a);
        this.fx.vonken(m.x, m.y, 6, 0xffa02a, 0.5);
      }
    }

    // de sprong: rukken, het niets, landen
    const fase = SPRONG_SEC - s.onderweg; // seconden sinds de sprong
    if (s.onderweg > 0) {
      if (this.oudeGrond) {
        // de oude wereld valt weg en dooft
        const v = Math.min(1, fase / 1.1);
        this.oudeGrond.y = v * v * 900;
        this.oudeGrond.alpha = 1 - v;
        if (v >= 1) {
          this.oudeGrond.destroy({ children: true });
          this.oudeGrond = null;
        }
      }
      duister = Math.min(0.55, fase / 0.8);
      if (Math.random() < 0.3) this.fx.bliksem(m, ringPunt(k, Math.random() * Math.PI * 2), 0.05 + Math.random() * 0.06);
      this.schud = Math.max(this.schud, 2.5);
      this.tekenRuimte(k, fase);
    } else if (!this.landing) this.landt();
    if (s.onderweg <= 0 && this.ruimte.visible) {
      this.ruimte.clear();
      this.ruimte.visible = false;
    }
    // de nieuwe wereld flikkert binnen na de landing
    this.wereldGrond.alpha = s.onderweg > 0 ? 0 : Math.min(1, (fase - SPRONG_SEC) / 0.6 + 0.4) * (Math.random() < 0.1 && fase < SPRONG_SEC + 1 ? 0.5 : 1);
    this.duister.style.opacity = String(duister);

    // schudden
    this.schud = Math.max(0, this.schud - sec * (this.schud > 8 ? 18 : 6));
    const sx = (Math.random() - 0.5) * 2 * this.schud, sy = (Math.random() - 0.5) * 2 * this.schud;
    this.wereld.pivot.set(Math.round(sx / PIXEL) * PIXEL, Math.round(sy / PIXEL) * PIXEL);
    this.fx.werk(sec);

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
        const p = naarScherm(w.x, w.y, hoogteOp(k, w.x, w.y));
        this.markering.ellipse(p.x, p.y, 7, 3.5);
      }
    });
    if (selectie.size) this.markering.stroke({ width: 1, color: 0x9dff2e, alpha: 0.7 });
  }

  // Het niets: zwart, met strepen licht die langs de schijf omhoog schieten (de schijf valt erdoorheen).
  private tekenRuimte(k: Kaart, fase: number): void {
    const g = this.ruimte;
    g.visible = true;
    g.clear();
    const c = naarScherm(k.ring.x, k.ring.y);
    const breed = 2600, hoog = 1600;
    g.rect(c.x - breed, c.y - hoog, breed * 2, hoog * 2).fill(0x020203);
    for (let i = 0; i < 320; i++) {
      const h = hash01(i * 13 + 5), h2 = hash01(i * 71 + 3);
      const snel = 600 + h2 * 1800;
      const x = c.x - breed + h * breed * 2;
      const lengte = 20 + h2 * 140;
      const y = c.y + hoog - ((h2 * 9000 + fase * snel) % (hoog * 2));
      const kleur = [0x4ef2ff, 0xffffff, 0xff4fd8, 0xffd23f][i % 4];
      g.rect(Math.round(x / PIXEL) * PIXEL, Math.round(y / PIXEL) * PIXEL, PIXEL * (1 + (i % 3 === 0 ? 1 : 0)), lengte).fill({ color: kleur, alpha: 0.25 + h * 0.5 });
    }
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
    const p = naarScherm(x, y, hoogteOp(this.staat.kaart, x + (tegels - 1) / 2, y + (tegels - 1) / 2)); // op de hoogte van zijn midden
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
    const p = naarScherm(x, y, hoogteOp(this.staat.kaart, x, y));
    const px = Math.round(p.x - m.ankerX * PIXEL * kijkt), py = Math.round(p.y - m.ankerY * PIXEL - hup);
    for (const d of st.delen) {
      d.scale.set(PIXEL * kijkt, PIXEL);
      d.position.set(px, py);
    }
    st.delen[0].zIndex = (x + y) * 10 + 3;
  }
}

// Is tegel (kol, rij) deel van je eigen schijf?
function opSchijf(k: Kaart, kol: number, rij: number): boolean {
  const dx = kol - k.ring.x, dy = rij - k.ring.y;
  return Math.hypot(dx, dy) <= schijfStraal(k, Math.atan2(dy, dx));
}

// Een stuk schuine grond iets lichter of donkerder: het licht komt van linksboven. gk en gr = hoeveel niveaus de grond
// stijgt per tegel in kolom- en rijrichting. De getallen zijn voorlopig; straks zit dit in de tegelset.
function belicht(kleur: number, gk: number, gr: number): number {
  const f = 1 + (gk - gr) * 0.3 - (gk + gr) * 0.1;
  const kanaal = (schuif: number) => Math.max(0, Math.min(255, Math.round(((kleur >> schuif) & 255) * f)));
  return (kanaal(16) << 16) | (kanaal(8) << 8) | kanaal(0);
}

const ruit = (x: number, y: number) => [x, y - TEGEL_H / 2, x + TEGEL_B / 2, y, x, y + TEGEL_H / 2, x - TEGEL_B / 2, y];

// De wereld eromheen in de kleuren van de dimensie, met heuvels. Vlekken die gloeien (lava, gif, kristal) gaan ook in de
// gloedlaag. Aan de voorkant een rand aarde en rots. Onder de schijf hoeft niets.
// Van achter naar voor getekend, dus een heuvel valt vanzelf over de grond erachter.
function tekenGrond(k: Kaart, wereld: DimensieWereld): [Graphics, Graphics] {
  const g = new Graphics();
  const gl = new Graphics();
  const { breed, diep } = k;
  for (let rij = 0; rij < diep; rij++)
    for (let kol = 0; kol < breed; kol++) {
      if (opSchijf(k, kol, rij)) continue;
      const { x, y } = naarScherm(kol, rij);
      const h = hash01(rij * 1000 + kol + k.afzettingen.length * 7919);
      const soort = k.soort[rij * breed + kol];
      if (soort === TEGEL_WATER) {
        const py = y - HOOGTE_MIN * HOOGTE_PX;
        const kleurW = wereld.water[Math.floor(h * wereld.water.length)];
        g.poly(ruit(x, py)).fill(kleurW);
        if (wereld.waterGloeit) gl.poly(ruit(x, py)).fill({ color: kleurW, alpha: 0.3 });
        continue;
      }
      // klippen in de kleur van de rotsrand, met een donkere lijn langs de bovenkant: een klip die van je af kijkt zie je
      // verder bijna niet, en je moet wel kunnen zien dat je daar niet langs kunt
      const kleur = soort === TEGEL_KLIP ? wereld.rand[0] : wereld.grond[Math.floor(h * wereld.grond.length)];
      const c = hoeken(k, kol, rij);
      const A = [x, y - TEGEL_H / 2 - c.a * HOOGTE_PX], R = [x + TEGEL_B / 2, y - c.r * HOOGTE_PX];
      const V = [x, y + TEGEL_H / 2 - c.v * HOOGTE_PX], L = [x - TEGEL_B / 2, y - c.l * HOOGTE_PX];
      if (c.a + c.v === c.r + c.l) g.poly([...A, ...R, ...V, ...L]).fill(belicht(kleur, c.r - c.a, c.l - c.a));
      else if (knikLinksRechts(c.a, c.r, c.v, c.l)) {
        g.poly([...A, ...R, ...L]).fill(belicht(kleur, c.r - c.a, c.l - c.a));
        g.poly([...V, ...L, ...R]).fill(belicht(kleur, c.v - c.l, c.v - c.r));
      } else {
        g.poly([...A, ...R, ...V]).fill(belicht(kleur, c.r - c.a, c.v - c.r));
        g.poly([...A, ...V, ...L]).fill(belicht(kleur, c.v - c.l, c.l - c.a));
      }
      if (soort === TEGEL_KLIP) {
        const laag = Math.min(c.a, c.r, c.v, c.l);
        for (const [p, q, hp, hq] of [[A, R, c.a, c.r], [R, V, c.r, c.v], [V, L, c.v, c.l], [L, A, c.l, c.a]] as [number[], number[], number, number][])
          if (hp > laag && hq > laag) g.moveTo(p[0], p[1]).lineTo(q[0], q[1]).stroke({ width: PIXEL, color: 0x060505, alpha: 0.85 });
        continue;
      }
      const v = hash01(h * 1e6);
      if (v < wereld.vlekKans) {
        const vx = x - 8 + Math.round(v * 400) % 14, vy = y - 2 + Math.round(v * 900) % 4 - Math.round(hoogteOp(k, kol, rij) * HOOGTE_PX / PIXEL) * PIXEL;
        g.rect(vx, vy, 4 + Math.round(v * 77) % 6, 2).fill(wereld.vlek);
        if (wereld.vlekGloeit) gl.rect(vx, vy, 4 + Math.round(v * 77) % 6, 2).fill(wereld.vlek);
      }
    }
  const dikte = 40;
  for (let i = 0; i < breed; i++) {
    const { x, y } = naarScherm(i, diep - 1);
    const c = hoeken(k, i, diep - 1);
    g.poly([x - TEGEL_B / 2, y - c.l * HOOGTE_PX, x, y + TEGEL_H / 2 - c.v * HOOGTE_PX, x, y + TEGEL_H / 2 + dikte, x - TEGEL_B / 2, y + dikte]).fill(wereld.rand[0]);
  }
  for (let i = 0; i < diep; i++) {
    const { x, y } = naarScherm(breed - 1, i);
    const c = hoeken(k, breed - 1, i);
    g.poly([x, y + TEGEL_H / 2 - c.v * HOOGTE_PX, x + TEGEL_B / 2, y - c.r * HOOGTE_PX, x + TEGEL_B / 2, y + dikte, x, y + TEGEL_H / 2 + dikte]).fill(wereld.rand[1]);
  }
  return [g, gl];
}

// Je eigen schijf: grauwe tegels, grof afgebroken rand die boven de wereld uitsteekt (rotswand aan de voorkant,
// slagschaduw op de wereld), een naad, brokken die eraf vallen en roestige klemmen. De ring er matte verf op.
function tekenSchijf(k: Kaart): Container {
  const c = new Container();
  const schaduw = new Graphics();
  const wand = new Graphics();
  const top = new Graphics();
  const naad = new Graphics();
  const WAND = 14;
  const r0 = Math.ceil(k.ring.r + 3);
  for (let rij = Math.floor(k.ring.y - r0); rij <= k.ring.y + r0; rij++)
    for (let kol = Math.floor(k.ring.x - r0); kol <= k.ring.x + r0; kol++) {
      if (!opSchijf(k, kol, rij)) continue;
      const { x, y } = naarScherm(kol, rij);
      const h = hash01(rij * 1000 + kol);
      top.poly(ruit(x, y)).fill(THUIS.grond[Math.floor(h * THUIS.grond.length)]);
      const v = hash01(h * 1e6);
      if (v < THUIS.vlekKans) top.rect(x - 8 + Math.round(v * 400) % 14, y - 2 + Math.round(v * 900) % 4, 4 + Math.round(v * 77) % 6, 2).fill(THUIS.vlek);
      else if (h < 0.06) top.rect(x - 4 + Math.round(h * 300) % 10, y, 2, 2).fill(0x34342f);
      const L = [x - TEGEL_B / 2, y], O = [x, y + TEGEL_H / 2], R = [x + TEGEL_B / 2, y], B = [x, y - TEGEL_H / 2];
      const voorL = !opSchijf(k, kol, rij + 1), voorR = !opSchijf(k, kol + 1, rij);
      const diepte = WAND + Math.round(hash01(h * 3e5) * 3) * PIXEL;
      for (const [aan, a, b, kleur] of [[voorL, L, O, 0x2a1f16], [voorR, O, R, 0x1c150f]] as [boolean, number[], number[], number][]) {
        if (!aan) continue;
        schaduw.poly([a[0], a[1], b[0], b[1], b[0] + 10, b[1] + diepte + 14, a[0] + 10, a[1] + diepte + 14]).fill({ color: 0, alpha: 0.45 });
        wand.poly([a[0], a[1], b[0], b[1], b[0], b[1] + diepte, a[0], a[1] + diepte]).fill(kleur);
        wand.poly([a[0], a[1], b[0], b[1], b[0], b[1] + 4, a[0], a[1] + 4]).fill(0x3b2b1c); // laag aarde
        // rotsstrepen en een afgebroken punt
        for (let i = 0; i < 4; i++) {
          const t = hash01(h * 7e4 + i);
          const px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
          wand.rect(Math.round(px / PIXEL) * PIXEL, Math.round(py / PIXEL) * PIXEL + 6 + i * 2, PIXEL * 2, PIXEL).fill(0x100c08);
        }
        const t = hash01(h * 9e3);
        wand.poly([a[0] + (b[0] - a[0]) * t - 4, a[1] + (b[1] - a[1]) * t + diepte - 1, a[0] + (b[0] - a[0]) * t + 4, a[1] + (b[1] - a[1]) * t + diepte - 1, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + diepte + 8]).fill(kleur);
        naad.moveTo(a[0], a[1]).lineTo(b[0], b[1]);
        // brokken die van de rand op de wereld zijn gevallen
        if (hash01(h * 5e4) < 0.45) {
          const bx = Math.round((a[0] + b[0]) / 2 + (hash01(h * 6e4) - 0.5) * 30), by = Math.round((a[1] + b[1]) / 2 + diepte + 8 + hash01(h * 8e4) * 14);
          schaduw.rect(bx, by, 6, 4).fill(THUIS.grond[1]);
          schaduw.rect(bx, by + 4, 6, 2).fill(0x0c0b0a);
          schaduw.rect(bx + 8, by + 2, 2, 2).fill(THUIS.grond[3]);
        }
      }
      // achterkant: de schijf ligt hoger dan de wereld, dus een lichte lip
      for (const [aan, a, b] of [[!opSchijf(k, kol, rij - 1), B, R], [!opSchijf(k, kol - 1, rij), L, B]] as [boolean, number[], number[]][]) {
        if (!aan) continue;
        naad.moveTo(a[0], a[1]).lineTo(b[0], b[1]);
        schaduw.poly([a[0], a[1] - 3, b[0], b[1] - 3, b[0], b[1], a[0], a[1]]).fill(0x0c0b0a);
        if (hash01(h * 4e4) < 0.18) {
          // roestige klem over de naad: lomp vastgeplakt
          const mx = Math.round((a[0] + b[0]) / 2), my = Math.round((a[1] + b[1]) / 2);
          top.rect(mx - 4, my - 8, 8, 12).fill(0x5a3a22);
          top.rect(mx - 4, my - 8, 8, 2).fill(0x7a5030);
          top.rect(mx - 2, my - 6, 2, 2).fill(0x1a120c);
          top.rect(mx - 2, my, 2, 2).fill(0x1a120c);
        }
      }
    }
  naad.stroke({ width: PIXEL, color: 0x0a0908, alpha: 0.9 });
  c.addChild(schaduw, wand, top, naad, tekenRing(k));
  return c;
}

// De transportring: slecht geverfde gele streepjes, mat, op pixelmaat. Verf mist hier en daar, kleur wisselt, randen rafelen.
function tekenRing(k: Kaart): Graphics {
  const g = new Graphics();
  const { x: cx, y: cy, r } = k.ring;
  const omtrek = 2 * Math.PI * r;
  const streepjes = Math.round(omtrek / 1.6);
  const verf = [0x8c7420, 0x9a7f26, 0x7f681c, 0xa3862c, 0x76601a];
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
        g.rect(px, py, PIXEL, PIXEL).fill({ color: verf[Math.floor(ruis * verf.length)], alpha: 0.65 + ruis * 0.3 });
      }
    }
  }
  return g;
}

interface Pt {
  x: number;
  y: number;
}
// Punt bovenop de machine, waar de bliksem uit komt (schermcoördinaten van de wereld).
function machineTop(k: Kaart): Pt {
  const p = naarScherm(k.machine.x + k.machine.breed / 2 - 0.5, k.machine.y + k.machine.diep / 2 - 0.5);
  return { x: p.x, y: p.y - 460 };
}
function ringPunt(k: Kaart, hoek: number): Pt {
  return naarScherm(k.ring.x + Math.cos(hoek) * k.ring.r, k.ring.y + Math.sin(hoek) * k.ring.r);
}

// Speciale effecten: bliksem, schokgolven, vonken en stof. Alleen beeld, dus Math.random mag.
class Fx {
  private scherp = new Graphics();
  private waas = new Graphics();
  private stofG = new Graphics();
  private bliksems: { pad: Pt[]; leeft: number; duur: number; kleur: number }[] = [];
  private golven: { c: Pt; r: number; t: number; kleur: number }[] = [];
  private deeltjes: { x: number; y: number; vx: number; vy: number; leeft: number; duur: number; kleur: number; maat: number; zwaar: number }[] = [];

  hang(scherp: Container, waas: Container, los: Container): void {
    this.scherp.blendMode = 'add';
    scherp.addChild(this.scherp);
    waas.addChild(this.waas);
    los.addChild(this.stofG);
  }

  bliksem(a: Pt, b: Pt, duur: number, kleur = 0x9ff4ff): void {
    const pad: Pt[] = [a];
    const n = 9 + Math.floor(Math.random() * 6);
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const uit = (Math.random() - 0.5) * len * 0.22 * Math.sin(t * Math.PI);
      pad.push({ x: a.x + dx * t + nx * uit, y: a.y + dy * t + ny * uit });
    }
    pad.push(b);
    this.bliksems.push({ pad, leeft: duur, duur, kleur });
    if (this.bliksems.length > 60) this.bliksems.shift();
  }

  golf(k: Kaart, vertraging: number, kleur: number): void {
    this.golven.push({ c: naarScherm(k.ring.x, k.ring.y), r: k.ring.r, t: -vertraging, kleur });
  }

  vonken(x: number, y: number, n: number, kleur: number, kracht: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (80 + Math.random() * 420) * kracht;
      this.deeltjes.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 120 * kracht, leeft: 0.4 + Math.random() * 0.8, duur: 1.2, kleur, maat: PIXEL, zwaar: 700 });
    }
  }

  vonkenRing(k: Kaart, n: number, kleur: number, kracht: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = ringPunt(k, a);
      const v = (150 + Math.random() * 600) * kracht;
      const dir = { x: Math.cos(a) - Math.sin(a), y: (Math.cos(a) + Math.sin(a)) / 2 };
      this.deeltjes.push({ x: p.x, y: p.y, vx: dir.x * v, vy: dir.y * v - Math.random() * 300 * kracht, leeft: 0.3 + Math.random() * 0.9, duur: 1.2, kleur, maat: PIXEL, zwaar: 500 });
    }
  }

  // stof dat bij de landing onder de rand van de schijf uit spuit
  stof(k: Kaart, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = naarScherm(k.ring.x + Math.cos(a) * schijfStraal(k, a), k.ring.y + Math.sin(a) * schijfStraal(k, a));
      const v = 60 + Math.random() * 260;
      const dir = { x: Math.cos(a) - Math.sin(a), y: (Math.cos(a) + Math.sin(a)) / 2 };
      this.deeltjes.push({ x: p.x, y: p.y + 10, vx: dir.x * v, vy: dir.y * v - Math.random() * 80, leeft: 0.8 + Math.random() * 1.2, duur: 2, kleur: [0x6a6258, 0x4a443d, 0x857b6e][i % 3], maat: PIXEL * (1 + Math.floor(Math.random() * 3)), zwaar: 60 });
    }
  }

  werk(sec: number): void {
    const s = this.scherp, w = this.waas;
    s.clear();
    w.clear();
    this.stofG.clear();
    for (const b of this.bliksems) b.leeft -= sec;
    this.bliksems = this.bliksems.filter((b) => b.leeft > 0);
    for (const b of this.bliksems) {
      const flak = Math.random() < 0.25 ? 0.4 : 1;
      s.poly(b.pad.flatMap((p) => [p.x, p.y]), false).stroke({ width: PIXEL, color: 0xffffff, alpha: flak });
      w.poly(b.pad.flatMap((p) => [p.x, p.y]), false).stroke({ width: PIXEL * 4, color: b.kleur, alpha: flak });
    }
    for (const g of this.golven) g.t += sec;
    this.golven = this.golven.filter((g) => g.t < 1.3);
    for (const g of this.golven) {
      if (g.t < 0) continue;
      const v = g.t / 1.3, r = g.r + (1 - (1 - v) * (1 - v)) * 40;
      s.ellipse(g.c.x, g.c.y, r * 45.25, r * 22.6).stroke({ width: PIXEL * 2, color: g.kleur, alpha: (1 - v) * 0.9 });
      w.ellipse(g.c.x, g.c.y, r * 45.25, r * 22.6).stroke({ width: PIXEL * 10, color: g.kleur, alpha: 1 - v });
    }
    for (const d of this.deeltjes) {
      d.leeft -= sec;
      d.vy += d.zwaar * sec;
      d.vx *= 1 - sec * 1.5;
      d.x += d.vx * sec;
      d.y += d.vy * sec;
    }
    this.deeltjes = this.deeltjes.filter((d) => d.leeft > 0);
    if (this.deeltjes.length > 900) this.deeltjes.splice(0, this.deeltjes.length - 900);
    for (const d of this.deeltjes) {
      const a = Math.min(1, d.leeft * 2);
      const x = Math.round(d.x / PIXEL) * PIXEL, y = Math.round(d.y / PIXEL) * PIXEL;
      (d.zwaar < 100 ? this.stofG : s).rect(x, y, d.maat, d.maat).fill({ color: d.kleur, alpha: a }); // stof gloeit niet
    }
  }
}
