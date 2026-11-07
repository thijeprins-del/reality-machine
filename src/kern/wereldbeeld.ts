// Tekent de spelstaat: grond, grondstoffen, gebouwen en eenheden, met een gloedlaag voor het neon.
// De factie levert de plaatjes (FactieBeeld); de kern weet niet welke factie het is.
import { Assets, BlurFilter, ColorMatrixFilter, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { naarScherm, TEGEL_B, TEGEL_H } from './iso';
import { dimensieKleur, DIMENSIE_DUUR_SEC, hoogteTint, HOOGTE_MIN, HOOGTE_PX, SCHIJF_HOOGTE, SPRONG_SEC, THUIS, type DimensieWereld } from '../data/dimensies';
import { tekenDebug } from './debugbeeld';
import { klepHoeken, opKlep, opSchijf, schijfStraal, type Blok, type Kaart } from './kaart';
import type { SpelStaat } from './spel';
import { hoeken, hoogteOp, knikLinksRechts, TEGEL_LAND, tegelOnder, TEGEL_WATER } from './terrein';
import { TerreinBewerker } from './terreinbewerker';
import { hash01 } from './toeval';
import type { FactieBeeld, SpriteInfo } from './types';
import { CEL_B, CEL_H, CEL_X, CEL_Y, celLand, celSchuim, celWand, celWater, KOLOMMEN, SCHUIM_BEELDEN, TEGELSETS, VARIANTEN, WAND_B, WAND_H, WAND_KOLOMMEN, WAND_VARIANTEN, WAND_Y, WATER_BEELDEN, WATER_VARIANTEN, type TegelSet } from './tegels';
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

export interface Stuk {
  delen: Sprite[]; // lijf plus gloedlagen
  naam: string;
}

export class WereldBeeld {
  readonly wereld = new Container();
  // Lagen die een factie ook mag gebruiken (bv. muizen: boren, banden, hopen in de opslag).
  readonly dingen = new Container(); // gesorteerd op diepte: zIndex = (kol + rij) * 10
  readonly vloer = new Container(); // plat op de grond, onder alles (kabels, markeringen)
  readonly scherp = new Container(); // gloedlagen
  readonly waas = new Container();
  readonly waas2 = new Container();
  private markering = new Graphics();
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
    await Promise.all([
      ...Object.entries(this.sprites).flatMap(([naam, s]) => [
        this.laadTex(naam, s.url),
        s.gloedUrl ? this.laadTex(`${naam}-gloed`, s.gloedUrl) : Promise.resolve(),
      ]),
      ...TEGELSETS.flatMap((set) => [`tegels-${set}`, `wanden-${set}`].map((naam) => this.laadTex(naam, wereldUrl(naam) as string))),
    ]);
    const k = this.staat.kaart;
    this.wereld.addChild(this.ruimte, this.wereldGrond, this.schijf, this.vloer, this.markering, this.dingen);
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
    // De gloed van de grond hoort op de grond: onder de schijf en alles wat erop staat, anders krijgt een boom voor een
    // gloeiend meer de kleur van dat meer.
    this.grondGloed.blendMode = 'add';
    this.wereld.addChildAt(this.grondGloed, this.wereld.getChildIndex(this.wereldGrond) + 1);
    const los = new Container();
    this.wereld.addChildAt(los, this.wereld.getChildIndex(this.dingen) + 1);
    this.fx.hang(this.scherp, this.waas, los);
    this.debug.visible = false;
    this.wereld.addChild(this.debug, this.kwastLijn);
    this.bewerker = new TerreinBewerker(() => this.staat, () => (this.terreinVuil = true), this.kwastLijn);
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'F1') return;
      e.preventDefault(); // anders opent de browser zijn hulppagina
      this.debugAan = !this.debugAan;
      this.debugGetekend = null;
    });

    const vast = { position: 'fixed', inset: '0', opacity: '0', pointerEvents: 'none' };
    Object.assign(this.flits.style, vast, { background: '#fff', zIndex: '9' });
    Object.assign(this.duister.style, vast, {
      background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.92) 78%)',
      zIndex: '4',
    });
    document.body.append(this.duister, this.flits);
    this.kleppen = new Kleppen(k);
    this.schijf.addChild(tekenSchijf(k), this.kleppen.g);
    this.schijfVan = k.machine;
    this.machineNu = k.machine;
    this.dimensie = this.staat.dimensie;
    this.gemist = this.staat.gemist;
    this.bouwWereld();
    for (const [naam, b] of [['machine', k.machine], ['opslag', k.opslag]] as [string, Blok][]) {
      const st = this.maak(naam);
      this.zetGebouw(st, b.x, b.y, b.breed, 1);
      this.opSchijfStukken.push(st);
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
    this.bouwGrond(k);
    for (const a of k.afzettingen) {
      const naam = `${a.goed}-${a.variant + 1}`;
      const st = this.maak(naam);
      this.zetAfzetting(st, a);
      this.afzettingen.set(a.id, st);
    }
  }

  private zetAfzetting(st: Stuk, a: Kaart['afzettingen'][number]): void {
    this.zetGebouw(st, a.x, a.y, 1, (hash01(a.id) < 0.5 ? 1 : -1) as 1 | -1);
  }

  // Het terrein is veranderd (terreinbewerker): de grond opnieuw leggen, grondstoffen op hun nieuwe hoogte.
  private legGrondOpnieuw(): void {
    const k = this.staat.kaart;
    for (const c of this.wereldGrond.removeChildren()) c.destroy({ children: true });
    this.bouwGrond(k);
    for (const a of k.afzettingen) {
      const st = this.afzettingen.get(a.id);
      if (st) this.zetAfzetting(st, a);
    }
    this.debugGetekend = null;
  }

  private bouwGrond(k: Kaart): void {
    for (const c of this.grondGloed.removeChildren()) c.destroy();
    const wereld = dimensieKleur(this.staat.dimensie);
    this.golven = [];
    this.wereldGrond.addChild(this.legTegels(k, wereld, wereld.tegelset));
    this.wereldGrond.addChild(tekenHoogtelijnen(k));
  }

  // Eén cel uit het plaatje van een tegelset. Bewaard, want duizenden tegels delen dezelfde paar cellen.
  private cel(set: TegelSet, i: number): Texture {
    const naam = `${set}/${i}`;
    let t = this.cellen.get(naam);
    if (!t) {
      const rx = (i % KOLOMMEN) * CEL_B, ry = Math.floor(i / KOLOMMEN) * CEL_H;
      t = new Texture({ source: this.texturen.get(`tegels-${set}`)!.source, frame: new Rectangle(rx, ry, CEL_B, CEL_H) });
      this.cellen.set(naam, t);
    }
    return t;
  }

  // Eén stuk wand uit het wandenplaatje van een tegelset.
  private wandCel(set: TegelSet, i: number): Texture {
    const naam = `${set}/w${i}`;
    let t = this.cellen.get(naam);
    if (!t) {
      const rx = (i % WAND_KOLOMMEN) * WAND_B, ry = Math.floor(i / WAND_KOLOMMEN) * WAND_H;
      t = new Texture({ source: this.texturen.get(`wanden-${set}`)!.source, frame: new Rectangle(rx, ry, WAND_B, WAND_H) });
      this.cellen.set(naam, t);
    }
    return t;
  }

  // De grond als tegels, van achter naar voor: wat hoger ligt valt vanzelf over wat erachter ligt, ook over water.
  // Na elke tegel de wanden op zijn twee achterranden, waar de buur erachter hoger ligt. Een wand die van je af kijkt
  // hoeft niet: daar staat de hoge tegel zelf voor.
  private legTegels(k: Kaart, wereld: DimensieWereld, set: TegelSet): Container {
    const c = new Container();
    c.isRenderGroup = true; // de tegels staan stil: niet elk beeld opnieuw rekenen
    const gl = new Graphics(); // wat gloeit: lava, gif en kristal
    const leg = (i: number, kol: number, rij: number, laag: number, tint = 1) => {
      const p = naarScherm(kol, rij, laag);
      const s = new Sprite(this.cel(set, i));
      s.tint = grijs(tint);
      s.scale.set(PIXEL);
      s.position.set(p.x - CEL_X * PIXEL, p.y - CEL_Y * PIXEL);
      c.addChild(s);
      return s;
    };
    // Een wand tussen de rand van de hoge buur (tP links, tQ rechts op het scherm) en de eigen rand eronder (bP, bQ).
    // (x, y) is het roosterpunt waar de rand links begint.
    const wand = (richting: number, x: number, y: number, tP: number, tQ: number, bP: number, bQ: number, h: number) => {
      if (tP - bP <= 0 && tQ - bQ <= 0) return;
      const p = naarScherm(x, y, tP);
      const s = new Sprite(this.wandCel(set, celWand(Math.floor(h * WAND_VARIANTEN), richting, tQ - tP, bQ - bP, tP - bP)));
      s.tint = grijs(hoogteTint(Math.max(tP, tQ)));
      s.scale.set(PIXEL);
      s.position.set(p.x, p.y - WAND_Y * PIXEL);
      c.addChild(s);
    };
    const { breed, diep } = k;
    for (let rij = 0; rij < diep; rij++)
      for (let kol = 0; kol < breed; kol++) {
        if (opSchijf(k, kol, rij)) continue;
        const h = hash01(rij * 1000 + kol + 77);
        // Onder een klep ligt gewoon vlakke grond: die zie je zolang hij nog niet uitgeschoven is. De klep zelf tekent Kleppen.
        const klep = opKlep(k, kol, rij);
        const c4 = klep ? { a: 0, r: 0, v: 0, l: 0 } : hoeken(k, kol, rij);
        if (k.soort[rij * breed + kol] === TEGEL_WATER) {
          // De gloed ligt boven alles, dus alleen op water dat je ook echt ziet: niet achter een heuvel.
          if (wereld.waterGloeit) {
            const p = naarScherm(kol, rij, HOOGTE_MIN);
            const voor = tegelOnder(k, p.x, p.y);
            if (voor.kol === kol && voor.rij === rij) gl.poly(ruit(p.x, p.y)).fill({ color: wereld.water[Math.floor(h * wereld.water.length)], alpha: 0.3 });
          }
          const variant = Math.floor(h * WATER_VARIANTEN), fase = Math.floor(hash01(h * 1e5) * WATER_BEELDEN);
          this.golven.push({ s: leg(celWater(variant, fase), kol, rij, HOOGTE_MIN), set, cel: (b) => celWater(variant, (b + fase) % WATER_BEELDEN) });
          // schuim op de randen waar het water iets anders raakt
          for (const [rand, dk, dr] of [[0, 0, -1], [1, 1, 0], [2, 0, 1], [3, -1, 0]]) {
            const nk = kol + dk, nr = rij + dr;
            if (nk < 0 || nr < 0 || nk >= breed || nr >= diep || k.soort[nr * breed + nk] === TEGEL_WATER) continue;
            const f = Math.floor(hash01(h * 3e5 + rand) * SCHUIM_BEELDEN);
            this.golven.push({ s: leg(celSchuim(rand, f), kol, rij, HOOGTE_MIN), set, cel: (b) => celSchuim(rand, (b + f) % SCHUIM_BEELDEN) });
          }
        } else {
          const laag = Math.min(c4.a, c4.r, c4.v, c4.l);
          leg(celLand(c4.a - laag, c4.r - laag, c4.v - laag, c4.l - laag, Math.floor(h * VARIANTEN)), kol, rij, laag, hoogteTint((c4.a + c4.r + c4.v + c4.l) / 4));
          const v = hash01(h * 1e6);
          if (wereld.vlekGloeit && v < wereld.vlekKans) {
            const p = naarScherm(kol, rij, klep ? 0 : hoogteOp(k, kol, rij));
            gl.rect(Math.round((p.x - 8 + Math.round(v * 400) % 14) / PIXEL) * PIXEL, Math.round((p.y - 2 + Math.round(v * 900) % 4) / PIXEL) * PIXEL, 4 + Math.round(v * 77) % 6, PIXEL).fill(wereld.vlek);
          }
        }
        // achter-links: de buur (kol - 1, rij), van de linkerhoek naar de achterhoek
        if (kol > 0 && !klep) {
          const n = hoeken(k, kol - 1, rij);
          wand(1, kol - 0.5, rij + 0.5, n.v, n.r, c4.l, c4.a, hash01(h * 7e5));
        }
        // achter-rechts: de buur (kol, rij - 1), van de achterhoek naar de rechterhoek
        if (rij > 0 && !klep) {
          const n = hoeken(k, kol, rij - 1);
          wand(0, kol - 0.5, rij - 0.5, n.l, n.v, c4.a, c4.r, hash01(h * 9e5));
        }
      }
    c.addChild(tekenRand(k, wereld));
    this.grondGloed.addChild(gl);
    return c;
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
    this.sprongTijd = this.t;
    const k = this.staat.kaart;
    this.oudeGrond?.destroy({ children: true });
    this.oudeGrond = new Container();
    this.oudeGrond.addChild(...this.wereldGrond.removeChildren());
    this.wereld.addChildAt(this.oudeGrond, 1);
    // Andere maat: de schijf ligt nu op andere tegels. De oude grond schuift mee, zodat hij er nog steeds onder ligt.
    const verschuif = naarScherm(k.machine.x - this.machineNu.x, k.machine.y - this.machineNu.y);
    this.oudeGrond.position.set(verschuif.x, verschuif.y);
    this.oudeGrondY = verschuif.y;
    this.machineNu = k.machine;
    const schijfNaar = naarScherm(k.machine.x - this.schijfVan.x, k.machine.y - this.schijfVan.y);
    this.schijf.position.set(schijfNaar.x, schijfNaar.y);
    this.opSchijfStukken.forEach((st, i) => {
      const b = i === 0 ? k.machine : k.opslag;
      this.zetGebouw(st, b.x, b.y, b.breed, 1);
    });
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
  private schijfVan!: Blok; // de machine zoals de schijf getekend is; waar hij nu ligt bepaalt de verschuiving
  private machineNu!: Blok;
  private opSchijfStukken: Stuk[] = []; // de machine en de opslag
  private oudeGrondY = 0;
  private cellen = new Map<string, Texture>();
  private debug = new Graphics();
  private kwastLijn = new Graphics();
  private terreinVuil = false;
  bewerker!: TerreinBewerker;
  private debugAan = false;
  private debugGetekend: Kaart | null = null; // voor welke kaart het debugbeeld nu klopt
  private golven: { s: Sprite; set: TegelSet; cel: (beeld: number) => number }[] = []; // water en schuim die bewegen
  private golfBeeld = 0;
  private landTijd = -10; // wanneer we landden (op de klok van this.t)
  private sprongTijd = -10; // wanneer we voor het laatst sprongen
  private kleppen!: Kleppen;

  private landt(): void {
    const k = this.staat.kaart;
    this.landing = true;
    this.landTijd = this.t;
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
        this.oudeGrond.y = this.oudeGrondY + v * v * 900;
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
    const geland = this.t - this.landTijd;
    this.wereldGrond.alpha = s.onderweg > 0 ? 0 : Math.min(1, geland / 0.6 + 0.4) * (Math.random() < 0.1 && geland < 1 ? 0.5 : 1);
    this.duister.style.opacity = String(duister);
    // de kleppen: snel weg bij de sprong, rustig uit na de landing
    const klepUit = s.onderweg > 0 ? 1 - (this.t - this.sprongTijd) / 0.4 : (geland - 0.1) / 0.8;
    const klep = Math.max(0, Math.min(1, klepUit));
    this.kleppen.teken(klep * klep * (3 - 2 * klep));

    // schudden
    this.schud = Math.max(0, this.schud - sec * (this.schud > 8 ? 18 : 6));
    const sx = (Math.random() - 0.5) * 2 * this.schud, sy = (Math.random() - 0.5) * 2 * this.schud;
    this.wereld.pivot.set(Math.round(sx / PIXEL) * PIXEL, Math.round(sy / PIXEL) * PIXEL);
    this.fx.werk(sec);

    // de bewerker kan meerdere keren per beeld verven; één keer opnieuw leggen is genoeg
    if (this.terreinVuil) {
      this.terreinVuil = false;
      this.legGrondOpnieuw();
    }
    // F1: raster en hoogtes. Pas tekenen als het aan staat, en opnieuw bij een nieuwe wereld.
    this.debug.visible = this.debugAan && s.onderweg <= 0;
    if (this.debug.visible && this.debugGetekend !== k) {
      tekenDebug(k, this.debug);
      this.debugGetekend = k;
    }

    // water: vier beelden per seconde is genoeg, en pixelart hoort een beetje te haperen
    const beeld = Math.floor(this.t * 4);
    if (beeld !== this.golfBeeld) {
      this.golfBeeld = beeld;
      for (const g of this.golven) g.s.texture = this.cel(g.set, g.cel(beeld));
    }

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

  // Even schudden (bv. als er iets zwaars neerploft).
  schudden(n: number): void {
    this.schud = Math.max(this.schud, n);
  }

  // Weg ermee (sprite plus gloed).
  weg(st: Stuk): void {
    for (const d of st.delen) d.destroy();
  }

  // Eenheden krijgen alleen de scherpe gloed: honderden wazige brilletjes worden één groene mist.
  maak(naam: string, eenheid = false): Stuk {
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

  wissel(st: Stuk, naam: string): void {
    st.naam = naam;
    st.delen[0].texture = this.texturen.get(naam)!;
    const gloed = this.texturen.get(`${naam}-gloed`);
    for (const d of st.delen.slice(1)) {
      d.visible = !!gloed;
      if (gloed) d.texture = gloed;
    }
  }

  // Gebouw of grondstof: anker op de achterhoek van tegel (x, y). Tekenvolgorde op de voorste hoek.
  zetGebouw(st: Stuk, x: number, y: number, tegels: number, spiegel: 1 | -1): void {
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
  zetEenheid(st: Stuk, x: number, y: number, kijkt: 1 | -1, hup: number): void {
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

const grijs = (f: number) => {
  const w = Math.round(f * 255);
  return (w << 16) | (w << 8) | w;
};
const ruit = (x: number, y: number) => [x, y - TEGEL_H / 2, x + TEGEL_B / 2, y, x, y + TEGEL_H / 2, x - TEGEL_B / 2, y];

// Hoogtelijnen, zoals op een wandelkaart: een dunne lijn waar de grond een heel niveau passeert. Die loopt altijd langs een
// tegelrand of de knik in een tegel, waar twee hoeken even hoog zijn; tussen twee vlakke tegels is er geen lijn.
// En een donkerder lijn langs de rand van een tegel waar het land erachter lager ligt: daar staat een wand die van je af
// kijkt, en zo zie je toch dat de grond er ophoudt. Wat achter een heuvel verdwijnt, tekenen we niet.
function tekenHoogtelijnen(k: Kaart): Graphics {
  const g = new Graphics();
  const { breed, diep } = k;
  const land = (x: number, y: number) => x >= 0 && y >= 0 && x < breed && y < diep && k.soort[y * breed + x] === TEGEL_LAND && !opSchijf(k, x, y) && !opKlep(k, x, y);
  const vlak = (c: { a: number; r: number; v: number; l: number }) => c.a === c.r && c.a === c.v && c.a === c.l;
  const zacht: number[] = [], hard: number[] = [];
  const lijn = (naar: number[], x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, kol: number, rij: number) => {
    const p = naarScherm(x0, y0, z0), q = naarScherm(x1, y1, z1);
    const t = tegelOnder(k, (p.x + q.x) / 2, (p.y + q.y) / 2);
    if (Math.abs(t.kol - kol) > 1.5 || Math.abs(t.rij - rij) > 1.5) return; // verborgen achter iets dat ervoor staat
    naar.push(p.x, p.y, q.x, q.y);
  };
  for (let y = 0; y < diep; y++)
    for (let x = 0; x < breed; x++) {
      if (!land(x, y)) continue;
      const c = hoeken(k, x, y);
      // de knik in de tegel, als die op één hoogte ligt
      if (!vlak(c)) {
        if (knikLinksRechts(c.a, c.r, c.v, c.l)) {
          if (c.r === c.l) lijn(zacht, x + 0.5, y - 0.5, c.r, x - 0.5, y + 0.5, c.l, x, y);
        } else if (c.a === c.v) lijn(zacht, x - 0.5, y - 0.5, c.a, x + 0.5, y + 0.5, c.v, x, y);
      }
      // de twee achterranden: [buur, eigen hoogtes links en rechts, die van de buur, de twee roosterpunten]
      const randen: [number, number, number, number, number, number, number, number, number, number][] = [
        [x - 1, y, c.l, c.a, 0, 0, x - 0.5, y + 0.5, x - 0.5, y - 0.5],
        [x, y - 1, c.a, c.r, 0, 0, x - 0.5, y - 0.5, x + 0.5, y - 0.5],
      ];
      randen.forEach(([bx, by, e1, e2, , , x0, y0, x1, y1], i) => {
        if (bx < 0 || by < 0) return;
        const n = hoeken(k, bx, by);
        const n1 = i === 0 ? n.v : n.l, n2 = i === 0 ? n.r : n.v;
        if (e1 === n1 && e2 === n2) {
          if (e1 === e2 && land(bx, by) && !(vlak(c) && vlak(n))) lijn(zacht, x0, y0, e1, x1, y1, e2, x, y);
        } else if (e1 >= n1 && e2 >= n2 && !opSchijf(k, bx, by)) lijn(hard, x0, y0, e1, x1, y1, e2, x, y);
      });
    }
  for (let i = 0; i < zacht.length; i += 4) g.moveTo(zacht[i], zacht[i + 1]).lineTo(zacht[i + 2], zacht[i + 3]);
  g.stroke({ width: PIXEL, color: 0x000000, alpha: 0.15 });
  for (let i = 0; i < hard.length; i += 4) g.moveTo(hard[i], hard[i + 1]).lineTo(hard[i + 2], hard[i + 3]);
  g.stroke({ width: PIXEL, color: 0x000000, alpha: 0.55 });
  return g;
}

// De rand aarde en rots aan de voorkant van de wereld.
function tekenRand(k: Kaart, wereld: DimensieWereld): Graphics {
  const g = new Graphics();
  const { breed, diep } = k;
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
  return g;
}

// Je eigen schijf: grauwe tegels, grof afgebroken rand die boven de wereld uitsteekt (rotswand aan de voorkant,
// slagschaduw op de wereld), een naad, brokken die eraf vallen en roestige klemmen. De ring er matte verf op.
// Hij ligt echt één blok hoger dan de wereld: alles hieronder wordt op z = 0 getekend en de hele schijf dan opgetild.
function tekenSchijf(k: Kaart): Container {
  const c = new Container();
  c.y = -SCHIJF_HOOGTE * HOOGTE_PX;
  const schaduw = new Graphics();
  const wand = new Graphics();
  const top = new Graphics();
  const naad = new Graphics();
  const WAND = SCHIJF_HOOGTE * HOOGTE_PX; // de wand loopt van de bovenkant tot de grond
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

// De kleppen rond de schijf. Tijdens de sprong zitten ze weggeschoven en zie je ze niet; bij de landing schuiven ze onder de
// rand uit tot een helling naar de grond. Het schuiven is alleen beeld: voor de spelregels liggen ze er altijd (tijdens de
// sprong loopt toch niemand).
// Elke klep is een stuk vervormend staal, dus dit kan geen sprite zijn.
class Kleppen {
  readonly g = new Graphics();
  private stand = -1;
  private lijst: { kol: number; rij: number; z: number[]; h: number }[] = [];

  constructor(k: Kaart) {
    const r0 = Math.ceil(k.ring.r + 5);
    for (let rij = Math.floor(k.ring.y - r0); rij <= k.ring.y + r0; rij++)
      for (let kol = Math.floor(k.ring.x - r0); kol <= k.ring.x + r0; kol++)
        if (opKlep(k, kol, rij)) this.lijst.push({ kol, rij, z: klepHoeken(k, kol, rij), h: hash01(rij * 1000 + kol + 5) });
    this.lijst.sort((a, b) => a.kol + a.rij - (b.kol + b.rij)); // van achter naar voor
  }

  // stand: 0 = weggeschoven, 1 = helemaal uit.
  teken(stand: number): void {
    if (stand === this.stand) return;
    this.stand = stand;
    const g = this.g.clear();
    if (stand <= 0) return;
    const HOEK = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const { kol, rij, z, h } of this.lijst) {
      const uit = HOEK.map(([di, dj], i) => naarScherm(kol + di - 0.5, rij + dj - 0.5, z[i]));
      const pt = z.map((zi, i) => {
        if (zi > 0) return uit[i];
        // een lage hoek schuift uit de dichtstbijzijnde hoge hoek naar de grond: de buur langs de rand, anders de overkant
        const van = uit[[(i + 1) & 3, (i + 3) & 3, (i + 2) & 3].find((j) => z[j] > 0) as number];
        return { x: van.x + (uit[i].x - van.x) * stand, y: van.y + (uit[i].y - van.y) * stand };
      });
      const [a, r, v, l] = pt;
      // licht van linksvoor: een helling die daarheen kijkt is lichter
      const naarX = (z[1] + z[2] - z[0] - z[3]) / 2, naarY = (z[2] + z[3] - z[0] - z[1]) / 2;
      const kleur = staal(1 + (naarX - naarY) * 0.22 + (h - 0.5) * 0.1);
      const drie = knikLinksRechts(z[0], z[1], z[2], z[3]) ? [[a, r, l], [v, l, r]] : [[a, r, v], [a, v, l]];
      for (const [p, q, s] of drie) g.poly([p.x, p.y, q.x, q.y, s.x, s.y]).fill(kleur);
      // de vier randen: scharnier bovenaan donker, naden tussen de platen, gele lip waar de klep op de grond komt
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) & 3, p = pt[i], q = pt[j];
        if (z[i] === 0 && z[j] === 0) g.moveTo(p.x, p.y).lineTo(q.x, q.y).stroke({ width: PIXEL, color: 0x8c7420, alpha: 0.9 });
        else if (z[i] > 0 && z[j] > 0) g.moveTo(p.x, p.y).lineTo(q.x, q.y).stroke({ width: PIXEL, color: 0x0a0908, alpha: 0.9 });
        else g.moveTo(p.x, p.y).lineTo(q.x, q.y).stroke({ width: 1, color: 0x0a0908, alpha: 0.5 });
      }
    }
  }
}
const staal = (f: number) => {
  const d = (c: number) => Math.max(0, Math.min(255, Math.round(c * f)));
  return (d(0x48) << 16) | (d(0x4a) << 8) | d(0x48);
};

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
  return { x: p.x, y: p.y - 460 - SCHIJF_HOOGTE * HOOGTE_PX };
}
function ringPunt(k: Kaart, hoek: number): Pt {
  return naarScherm(k.ring.x + Math.cos(hoek) * k.ring.r, k.ring.y + Math.sin(hoek) * k.ring.r, SCHIJF_HOOGTE);
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
