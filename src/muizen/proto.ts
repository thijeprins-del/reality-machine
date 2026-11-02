// Visuele proto van de muizen: een stukje grauwe muizenindustrie op het eiland. Open met ?proto=muizen.
// Alleen om de stijl te beoordelen, geen spelregels. Scrollen zoomt in hele stappen (blijft pixelscherp).
// Neon gloeit echt: elke sprite heeft een <naam>-gloed.png met alleen de neonpixels. Die leggen we additief
// over de wereld, één keer scherp en twee keer wazig (de gloed), en laten we zacht flikkeren.
import { Application, Assets, BlurFilter, ColorMatrixFilter, Container, Sprite, Text, type Texture } from 'pixi.js';
import { naarScherm, tekenVeld, TEGEL_H } from '../kern/iso';
import { MUIZEN_SPRITES, type MuizenSprite } from './sprites';

const PIXEL = 2; // één pixelmaat: elke sprite-pixel is 2 schermpixels bij zoom 1

const bestanden = import.meta.glob('../../assets/muizen/*.png', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>;

function url(bestand: string): string {
  const sleutel = Object.keys(bestanden).find((k) => k.endsWith(`/${bestand}.png`));
  if (!sleutel) throw new Error(`sprite ontbreekt: ${bestand}`);
  return bestanden[sleutel];
}

async function laad(bestand: string): Promise<Texture> {
  const tex = await Assets.load<Texture>(url(bestand));
  tex.source.scaleMode = 'nearest';
  return tex;
}

interface Plek {
  naam: MuizenSprite;
  kol: number;
  rij: number;
  spiegel?: boolean; // band en kabels: kol-richting wordt rij-richting
}

// Een productieketen: fabriek -> band -> pers, dynamo en masten met kabels, een sjouwbot en een mech op wacht.
const SCENE: Plek[] = [
  { naam: 'fabriek', kol: 1, rij: 1 },
  { naam: 'band', kol: 3, rij: 2 },
  { naam: 'band', kol: 4, rij: 2 },
  { naam: 'pers', kol: 5, rij: 2 },
  { naam: 'mast', kol: 1, rij: 4 },
  { naam: 'mast', kol: 1, rij: 6 },
  { naam: 'kabels', kol: 1, rij: 4, spiegel: true },
  { naam: 'dynamo', kol: 2, rij: 6 },
  { naam: 'mast', kol: 8, rij: 1 },
  { naam: 'mast', kol: 8, rij: 3 },
  { naam: 'kabels', kol: 8, rij: 1, spiegel: true },
  { naam: 'mast', kol: 6, rij: 1 },
  { naam: 'kabels', kol: 6, rij: 1 },
  { naam: 'sjouwbot', kol: 6, rij: 4 },
  { naam: 'mech', kol: 5, rij: 6 },
  { naam: 'muis-monteur', kol: 5.6, rij: 3.6 },
  { naam: 'muis', kol: 3.4, rij: 3.5 },
  { naam: 'muis', kol: 2.4, rij: 4.6 },
  { naam: 'muis', kol: 8.4, rij: 6.2 },
  { naam: 'muis-monteur', kol: 4.6, rij: 8.6 },
  { naam: 'muis', kol: 1.7, rij: 8.3 },
];

export async function toonMuizenProto(app: Application): Promise<void> {
  app.renderer.background.color = 0x07080a;
  const wereld = new Container();
  app.stage.addChild(wereld);

  // grond: grauw en donker (de kern tekent groen gras, hier filteren we dat weg)
  const veld = tekenVeld(10, 10);
  const grauw = new ColorMatrixFilter();
  grauw.desaturate();
  const donker = new ColorMatrixFilter();
  donker.brightness(0.32, false);
  veld.filters = [grauw, donker];
  wereld.addChild(veld);

  const dingen = new Container();
  dingen.sortableChildren = true;
  wereld.addChild(dingen);

  // gloedlagen: scherp, wazig en heel wazig, allemaal additief
  const scherp = new Container();
  const waas = new Container();
  const blur = new BlurFilter({ strength: 7, quality: 3 });
  // de wazige lagen worden opgehelderd, anders verdunt het weinige neon tot niets
  const fel = (f: number) => {
    const cm = new ColorMatrixFilter();
    cm.brightness(f, false);
    return cm;
  };
  waas.filters = [blur, fel(3)];
  waas.blendMode = 'add';
  const waas2 = new Container();
  const blur2 = new BlurFilter({ strength: 22, quality: 4 });
  waas2.filters = [blur2, fel(6)];
  waas2.blendMode = 'add';
  waas2.alpha = 0.8;
  wereld.addChild(waas2, waas, scherp);

  const texturen = new Map<string, Texture>();
  for (const naam of new Set(SCENE.map((p) => p.naam))) {
    texturen.set(naam, await laad(naam));
    if (MUIZEN_SPRITES[naam].gloed) texturen.set(`${naam}-gloed`, await laad(`${naam}-gloed`));
  }

  const muizen: { delen: Sprite[]; y: number; fase: number }[] = [];
  for (const p of SCENE) {
    const m = MUIZEN_SPRITES[p.naam];
    const r = p.spiegel ? -1 : 1;
    let punt = naarScherm(p.kol, p.rij);
    let x: number, y: number;
    if (m.tegels === 0) {
      // muis: voeten op dit punt (kol/rij mogen kommagetallen zijn)
      x = punt.x - m.ankerX * PIXEL;
      y = punt.y - m.ankerY * PIXEL;
    } else {
      // gebouw: anker op de achterhoek van de tegel
      punt = { x: punt.x, y: punt.y - TEGEL_H / 2 };
      x = punt.x - m.ankerX * PIXEL * r;
      y = punt.y - m.ankerY * PIXEL;
    }
    const maak = (tex: Texture) => {
      const s = new Sprite(tex);
      s.scale.set(PIXEL * r, PIXEL);
      s.position.set(x, y);
      return s;
    };
    const s = maak(texturen.get(p.naam)!);
    // tekenvolgorde: verder naar voren = later; kabels boven hun masten
    const voor = m.tegels === 0 ? p.kol + p.rij : p.kol + p.rij + 2 * (m.tegels - 1);
    s.zIndex = voor * 10 + (p.naam === 'kabels' ? 5 : 0) + (m.tegels === 0 ? 3 : 0);
    dingen.addChild(s);
    const delen = [s];
    if (m.gloed) {
      const gt = texturen.get(`${p.naam}-gloed`)!;
      for (const laag of [scherp, waas, waas2]) {
        const g = maak(gt);
        if (laag === scherp) g.blendMode = 'add';
        laag.addChild(g);
        delen.push(g);
      }
    }
    if (m.tegels === 0) muizen.push({ delen, y, fase: Math.random() * 10 });
  }

  const titel = new Text({
    text: 'Muizen: visuele proto (scrol = zoom)',
    style: { fill: 0x8a8f94, fontFamily: 'monospace', fontSize: 16 },
  });
  titel.position.set(16, 12);
  app.stage.addChild(titel);

  let zoom = app.screen.width > 1500 ? 2 : 1;
  const plaats = () => {
    wereld.scale.set(zoom);
    blur.strength = 7 * zoom;
    blur2.strength = 22 * zoom;
    // ruime rand, anders snijdt het filter de gloed recht af
    blur.padding = 30 * zoom;
    blur2.padding = 90 * zoom;
    wereld.position.set(Math.round(app.screen.width / 2), Math.round(app.screen.height / 2 - 150 * zoom));
  };
  plaats();
  app.renderer.on('resize', plaats);
  window.addEventListener('wheel', (e) => {
    zoom = Math.min(4, Math.max(1, zoom + (e.deltaY < 0 ? 1 : -1)));
    plaats();
  });

  // neon flikkert zacht (en soms even hard), muizen huppen af en toe één pixel op
  let t = 0;
  app.ticker.add((tk) => {
    t += tk.deltaMS / 1000;
    const hapering = Math.random() < 0.015 ? 0.35 : 1;
    waas.alpha = (0.85 + 0.15 * Math.sin(t * 2.1) * Math.sin(t * 7.3)) * hapering;
    for (const m of muizen) {
      const dy = Math.sin(t * 6 + m.fase) > 0.8 ? PIXEL : 0;
      for (const d of m.delen) d.y = m.y - dy;
    }
  });
}
