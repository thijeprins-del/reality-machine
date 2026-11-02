import { Application } from 'pixi.js';
import { MUIZEN } from './data/muizen';
import { maakBesturing } from './kern/besturing';
import { versieTekst } from './kern/omgeving';
import { kiesFactie, maakBalk } from './kern/scherm';
import { nieuwSpel, restTijd, seedUitAdres, stap, stream, type SpelStaat } from './kern/spel';
import type { Factie, FactieBeeld, FactieId } from './kern/types';
import { stuur } from './kern/werkers';
import { WereldBeeld } from './kern/wereldbeeld';
import { muizenBeeld } from './muizen/beeld';

declare global {
  interface Window {
    SPEL: {
      staat: SpelStaat;
      stap: (sec: number) => void;
      zaai: (seed: number) => void;
      stream: () => void;
      stuur: (ids: number[] | 'alle', kol: number, rij: number) => void;
    };
  }
}

// Speelbare facties. De otters komen erbij zodra Lieuwe src/data/otters.ts en src/otters/ heeft.
const FACTIES: Partial<Record<FactieId, { data: Factie; beeld: () => FactieBeeld }>> = {
  muizen: { data: MUIZEN, beeld: muizenBeeld },
};

async function start(): Promise<void> {
  const app = new Application();
  await app.init({ resizeTo: window, background: 0x07080a, antialias: false });
  document.body.appendChild(app.canvas);
  document.getElementById('versie')!.textContent = versieTekst();

  const adres = new URLSearchParams(location.search);
  // Visuele proto's per factie: ?proto=muizen
  if (adres.get('proto') === 'muizen') {
    const { toonMuizenProto } = await import('./muizen/proto');
    await toonMuizenProto(app);
    return;
  }

  // ?factie=muizen slaat het menu over (handig voor de rooktest)
  let id = adres.get('factie') as FactieId | null;
  if (!id || !FACTIES[id])
    id = await kiesFactie([
      { id: 'muizen', naam: 'Muizen', regel: 'Honderden muizen, gigantische machines.', speelbaar: !!FACTIES.muizen },
      { id: 'otters', naam: 'Otters', regel: FACTIES.otters ? 'Lieuwe' : 'Nog in de maak (Lieuwe).', speelbaar: !!FACTIES.otters },
    ]);
  const factie = FACTIES[id]!;

  let staat = nieuwSpel(seedUitAdres(), factie.data);
  window.SPEL = {
    get staat() {
      return staat;
    },
    stap: (sec) => stap(staat, factie.data, sec),
    zaai: (seed) => {
      staat = nieuwSpel(seed, factie.data);
    },
    stream: () => stream(staat, factie.data),
    stuur: (ids, kol, rij) => stuur(staat, ids === 'alle' ? staat.werkers.map((w) => w.id) : ids, kol, rij),
  };

  const beeld = new WereldBeeld(staat, factie.beeld());
  await beeld.laad();
  app.stage.addChild(beeld.wereld);
  const besturing = maakBesturing(app, beeld.wereld, () => staat, (z) => beeld.zoom(z), (ids, kol, rij) =>
    stuur(staat, ids, kol, rij),
  );
  const balk = maakBalk();

  app.ticker.add((t) => {
    const sec = Math.min(0.1, t.deltaMS / 1000);
    stap(staat, factie.data, sec);
    besturing.werk(sec);
    beeld.werk(sec, besturing.selectie);
    const rest = Math.ceil(restTijd(staat));
    const v = staat.voorraad;
    const bezig = staat.werkers.filter((w) => w.taak !== 'rust').length;
    balk.zet([
      `Dimensie ${staat.dimensie} · stream over ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`,
      `Machine: energie ${staat.machine.energie}/${staat.machine.maxEnergie}`,
      `Opslag: schroot ${v.schroot ?? 0} · hout ${v.hout ?? 0} · kristal ${v.kristal ?? 0}`,
      `${factie.data.naam}: ${staat.werkers.length} (${bezig} aan het werk) · geselecteerd ${besturing.selectie.size}`,
    ]);
  });
}

start();
