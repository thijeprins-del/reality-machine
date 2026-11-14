import { Application } from 'pixi.js';
import { dimensieKleur } from './data/dimensies';
import { MUIZEN } from './data/muizen';
import { maakBesturing } from './kern/besturing';
import { versieTekst } from './kern/omgeving';
import { beeldKlaar, markeer, maakOverlay, rapport, zetExtra } from './kern/prestatie';
import { kiesFactie, maakBalk } from './kern/scherm';
import { nieuwSpel, restTijd, seedUitAdres, startUitAdres, stap, stream, type SpelStaat } from './kern/spel';
import { WRATH_MAX, WRATH_STADIA } from './data/wrath';
import { landSprites } from './land/beeld';
import { geefWrath, overval, stadium, stadiumNummer } from './land/wrath';
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
      wrath: (n: number) => void; // zet Wrath (0-100)
      overval: (n?: number) => void; // laat nu een overval komen
      terrein: () => string;
      laadTerrein: (json: string) => void;
      stream: () => void;
      stuur: (ids: number[] | 'alle', kol: number, rij: number) => void;
    };
    PERF: { rapport: typeof rapport };
  }
}

// Speelbare facties. De otters komen erbij zodra Lieuwe src/data/otters.ts en src/otters/ heeft.
// `paneel`: eigen bediening van een factie over de wereld (muizen: het stroomnet). Elke factie mag iets anders hebben.
// Het paneel krijgt ook het wereldbeeld, zodat een factie eigen dingen in de wereld kan tekenen en neerzetten.
type Paneel = (staat: () => SpelStaat, beeld: WereldBeeld) => { werk(sec: number): void };
const FACTIES: Partial<Record<FactieId, { data: Factie; beeld: () => FactieBeeld; paneel?: () => Promise<Paneel> }>> = {
  muizen: { data: MUIZEN, beeld: muizenBeeld, paneel: async () => (await import('./muizen/paneel')).maakPaneel },
};

async function start(): Promise<void> {
  window.PERF = { rapport };
  const app = new Application();
  await app.init({ resizeTo: window, background: 0x07080a, antialias: false });
  markeer('renderer ready');
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
      { id: 'muizen', naam: 'Mice', regel: 'Hundreds of mice, gigantic machines.', speelbaar: !!FACTIES.muizen },
      { id: 'otters', naam: 'Otters', regel: FACTIES.otters ? 'Lieuwe' : 'Still being made (Lieuwe).', speelbaar: !!FACTIES.otters },
    ]);
  const factie = FACTIES[id]!;

  const start = startUitAdres();
  let staat = nieuwSpel(seedUitAdres(), factie.data, start);
  window.SPEL = {
    get staat() {
      return staat;
    },
    stap: (sec) => stap(staat, factie.data, sec),
    zaai: (seed) => {
      staat = nieuwSpel(seed, factie.data, start);
    },
    stream: () => stream(staat, factie.data),
    wrath: (n) => geefWrath(staat, n),
    overval: (n = 3) => overval(staat, n),
    terrein: () => beeld.bewerker.alsJson(),
    laadTerrein: (json) => beeld.bewerker.laadJson(json),
    stuur: (ids, kol, rij) => stuur(staat, ids === 'alle' ? staat.werkers.map((w) => w.id) : ids, kol, rij),
  };

  const fb = factie.beeld();
  const beeld = new WereldBeeld(staat, { ...fb, sprites: { ...fb.sprites, ...landSprites() } });
  await beeld.laad();
  markeer('world ready');
  app.stage.addChild(beeld.wereld);
  const besturing = maakBesturing(app, beeld.wereld, () => staat, (z) => beeld.zoom(z), (ids, kol, rij) =>
    stuur(staat, ids, kol, rij),
  beeld.bewerker,
  );
  const balk = maakBalk();
  const paneel = factie.paneel ? (await factie.paneel())(() => staat, beeld) : null;

  markeer('ui ready');
  maakOverlay();
  zetExtra(() => ({ ...beeld.statistiek(), muizen: staat.werkers.length }));
  app.ticker.add((t) => {
    const t0 = performance.now();
    const sec = Math.min(0.1, t.deltaMS / 1000);
    stap(staat, factie.data, sec);
    besturing.werk(sec);
    beeld.werk(sec, besturing.selectie);
    paneel?.werk(sec);
    const rest = Math.ceil(restTijd(staat));
    const v = staat.voorraad;
    const bezig = staat.werkers.filter((w) => w.taak !== 'rust').length;
    balk.zet([
      staat.onderweg > 0
        ? `In the void · on the way to ${dimensieKleur(staat.dimensie).naam}`
        : `Dimension ${staat.dimensie} · ${dimensieKleur(staat.dimensie).naam} · stream in ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`,
      wrathRegel(staat),
      `Machine: power ${Math.floor((100 * staat.machine.energie) / staat.machine.maxEnergie)}% (needs 100% at the stream)${staat.gemist ? ` · stream missed ${staat.gemist}×` : ''}`,
      `Stock: scrap ${Math.floor(v.schroot ?? 0)} · wood ${Math.floor(v.hout ?? 0)} · crystal ${Math.floor(v.kristal ?? 0)}`,
      `${factie.data.naam}: ${staat.werkers.length} (${bezig} working) · selected ${besturing.selectie.size}`,
    ]);
    markeer('first frame');
    beeldKlaar(t.deltaMS, performance.now() - t0);
  });
}

const wrathRegel = (s: SpelStaat): string => {
  const l = s.land, st = stadium(l.wrath), nr = stadiumNummer(l.wrath);
  const vak = WRATH_STADIA.map((x, i) => {
    const volle = Math.max(0, Math.min(1, (l.wrath - x.vanaf) / ((WRATH_STADIA[i + 1]?.vanaf ?? WRATH_MAX) - x.vanaf)));
    return `<span style="display:inline-block;width:26px;height:8px;margin-right:2px;background:#2a2c28"><span style="display:block;height:8px;width:${Math.round(volle * 26)}px;background:${x.kleur}"></span></span>`;
  }).join('');
  const raid = st.raid && s.onderweg <= 0 ? ` · raid in ${Math.max(0, Math.ceil(l.raidIn))}s` : '';
  const hier = l.raiders.length ? ` · <b style="color:${st.kleur}">${l.raiders.length} raider${l.raiders.length > 1 ? 's' : ''} coming</b>` : '';
  return `Wrath ${vak} <b style="color:${st.kleur}">${Math.floor(l.wrath)} ${st.naam}</b> (${nr + 1}/5)${raid}${hier}`;
};

start();
