// Visuele proto van de muizen: een stukje muizenindustrie op het eiland. Open met ?proto=muizen.
// Alleen om de stijl te beoordelen, geen spelregels. Scrollen zoomt in hele stappen (blijft pixelscherp).
import { Application, Assets, Container, Sprite, Text, type Texture } from 'pixi.js';
import { naarScherm, tekenVeld, TEGEL_H } from '../kern/iso';
import { MUIZEN_SPRITES, type MuizenSprite } from './sprites';

const PIXEL = 2; // één pixelmaat: elke sprite-pixel is 2 schermpixels bij zoom 1

const bestanden = import.meta.glob('../../assets/muizen/*.png', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>;

function url(naam: MuizenSprite): string {
  const sleutel = Object.keys(bestanden).find((k) => k.endsWith(`/${naam}.png`));
  if (!sleutel) throw new Error(`sprite ontbreekt: ${naam}`);
  return bestanden[sleutel];
}

interface Plek {
  naam: MuizenSprite;
  kol: number;
  rij: number;
  spiegel?: boolean; // band en kabels: kol-richting wordt rij-richting
}

// Een productieketen: dynamo -> masten -> fabriek -> loopband -> pers, met een mech op wacht.
const SCENE: Plek[] = [
  { naam: 'fabriek', kol: 1, rij: 1 },
  { naam: 'band', kol: 3, rij: 2 },
  { naam: 'band', kol: 4, rij: 2 },
  { naam: 'pers', kol: 5, rij: 2 },
  { naam: 'mast', kol: 1, rij: 4 },
  { naam: 'mast', kol: 1, rij: 6 },
  { naam: 'kabels', kol: 1, rij: 4, spiegel: true },
  { naam: 'dynamo', kol: 2, rij: 6 },
  { naam: 'mast', kol: 7, rij: 1 },
  { naam: 'mast', kol: 7, rij: 3 },
  { naam: 'kabels', kol: 7, rij: 1, spiegel: true },
  { naam: 'mast', kol: 5, rij: 1 },
  { naam: 'kabels', kol: 5, rij: 1 },
  { naam: 'mech', kol: 6, rij: 6 },
  { naam: 'muis-monteur', kol: 5.6, rij: 3.6 },
  { naam: 'muis', kol: 3.4, rij: 3.5 },
  { naam: 'muis', kol: 2.4, rij: 4.6 },
  { naam: 'muis', kol: 8.2, rij: 5.6 },
  { naam: 'muis-monteur', kol: 5.4, rij: 8.2 },
  { naam: 'muis', kol: 1.7, rij: 8.3 },
];

export async function toonMuizenProto(app: Application): Promise<void> {
  const wereld = new Container();
  app.stage.addChild(wereld);
  wereld.addChild(tekenVeld(10, 10));

  const dingen = new Container();
  dingen.sortableChildren = true;
  wereld.addChild(dingen);

  const texturen = new Map<MuizenSprite, Texture>();
  for (const naam of new Set(SCENE.map((p) => p.naam))) {
    const tex = await Assets.load<Texture>(url(naam));
    tex.source.scaleMode = 'nearest';
    texturen.set(naam, tex);
  }

  const muizen: { s: Sprite; y: number; fase: number }[] = [];
  for (const p of SCENE) {
    const m = MUIZEN_SPRITES[p.naam];
    const s = new Sprite(texturen.get(p.naam)!);
    const r = p.spiegel ? -1 : 1;
    s.scale.set(PIXEL * r, PIXEL);
    let punt = naarScherm(p.kol, p.rij);
    if (m.tegels === 0) {
      // muis: voeten op dit punt (kol/rij mogen kommagetallen zijn)
      s.position.set(punt.x - m.ankerX * PIXEL, punt.y - m.ankerY * PIXEL);
      muizen.push({ s, y: s.y, fase: Math.random() * 10 });
    } else {
      // gebouw: anker op de achterhoek van de tegel
      punt = { x: punt.x, y: punt.y - TEGEL_H / 2 };
      s.position.set(punt.x - m.ankerX * PIXEL * r, punt.y - m.ankerY * PIXEL);
    }
    // tekenvolgorde: verder naar voren = later; kabels boven hun masten
    const voor = m.tegels === 0 ? p.kol + p.rij : p.kol + p.rij + 2 * (m.tegels - 1);
    s.zIndex = voor * 10 + (p.naam === 'kabels' ? 5 : 0) + (m.tegels === 0 ? 3 : 0);
    dingen.addChild(s);
  }

  const titel = new Text({
    text: 'Muizen: visuele proto (scrol = zoom)',
    style: { fill: 0xe8ecf4, fontFamily: 'monospace', fontSize: 18 },
  });
  titel.position.set(16, 12);
  app.stage.addChild(titel);

  let zoom = app.screen.width > 1500 ? 2 : 1;
  const plaats = () => {
    wereld.scale.set(zoom);
    wereld.position.set(Math.round(app.screen.width / 2), Math.round(app.screen.height / 2 - 150 * zoom));
  };
  plaats();
  app.renderer.on('resize', plaats);
  window.addEventListener('wheel', (e) => {
    zoom = Math.min(4, Math.max(1, zoom + (e.deltaY < 0 ? 1 : -1)));
    plaats();
  });

  // muizen huppen af en toe één pixel op
  let t = 0;
  app.ticker.add((tk) => {
    t += tk.deltaMS / 1000;
    for (const m of muizen) m.s.y = m.y - (Math.sin(t * 6 + m.fase) > 0.8 ? PIXEL : 0);
  });
}
