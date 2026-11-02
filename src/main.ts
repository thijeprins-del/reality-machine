import { Application, Assets, Sprite, Text } from 'pixi.js';
import { naarScherm, tekenVeld } from './kern/iso';
import { versieTekst } from './kern/omgeving';
import { nieuwSpel, restTijd, seedUitAdres, stap, stream, type SpelStaat } from './kern/spel';
import muisUrl from '../assets/muizen/muis.svg?url';

declare global {
  interface Window {
    SPEL: {
      staat: SpelStaat;
      stap: (sec: number) => void;
      zaai: (seed: number) => void;
      stream: () => void;
    };
  }
}

async function start(): Promise<void> {
  const app = new Application();
  await app.init({ resizeTo: window, background: 0x10131c, antialias: false });
  document.body.appendChild(app.canvas);

  let staat = nieuwSpel(seedUitAdres());
  window.SPEL = {
    get staat() {
      return staat;
    },
    stap: (sec) => stap(staat, sec),
    zaai: (seed) => {
      staat = nieuwSpel(seed);
    },
    stream: () => stream(staat),
  };

  // Visuele proto's per factie: ?proto=muizen
  if (new URLSearchParams(location.search).get('proto') === 'muizen') {
    const { toonMuizenProto } = await import('./muizen/proto');
    await toonMuizenProto(app);
    return;
  }

  const veld = tekenVeld(8, 8);
  app.stage.addChild(veld);

  const tex = await Assets.load(muisUrl);
  tex.source.scaleMode = 'nearest';
  const muis = new Sprite(tex);
  muis.anchor.set(0.5, 1);
  muis.scale.set(2);
  const plek = naarScherm(3, 4);
  muis.position.set(plek.x, plek.y + 4);
  veld.addChild(muis);

  const titel = new Text({
    text: 'Reality Machine',
    style: { fill: 0xe8ecf4, fontFamily: 'monospace', fontSize: 28 },
  });
  const klok = new Text({ text: '', style: { fill: 0x9fb4d8, fontFamily: 'monospace', fontSize: 16 } });
  app.stage.addChild(titel, klok);

  const plaats = () => {
    veld.position.set(app.screen.width / 2, app.screen.height / 2 - 100);
    titel.position.set(16, 12);
    klok.position.set(16, 48);
  };
  plaats();
  app.renderer.on('resize', plaats);

  app.ticker.add((t) => {
    stap(staat, t.deltaMS / 1000);
    const rest = Math.ceil(restTijd(staat));
    const mm = Math.floor(rest / 60);
    const ss = String(rest % 60).padStart(2, '0');
    klok.text = `Dimensie ${staat.dimensie}  ·  stream over ${mm}:${ss}`;
  });

  document.getElementById('versie')!.textContent = versieTekst();
}

start();
