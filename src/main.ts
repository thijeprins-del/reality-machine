import { Application } from 'pixi.js';
import { dimensieKleur } from './data/dimensies';
import { RATTEN } from './data/ratten';
import { maakBesturing } from './kern/besturing';
import { versieTekst } from './kern/omgeving';
import { beeldKlaar, markeer, maakOverlay, rapport, zetExtra } from './kern/prestatie';
import { maakBalk } from './kern/scherm';
import { maakWeer } from './kern/weer';
import { regelVan } from './land/wrath';
import { nieuwSpel, kanVroegSpringen, machineKlaar, restTijd, seedUitAdres, startUitAdres, stap, stream, vroegStream, type SpelStaat } from './kern/spel';
import { FINALE, RUN_SHIFTS } from './data/run';
import { WRATH_MAX, WRATH_STADIA } from './data/wrath';
import { landSprites } from './land/beeld';
import { geefWrath, overval, stadium, stadiumNummer } from './land/wrath';
import { stuur } from './kern/werkers';
import { WereldBeeld } from './kern/wereldbeeld';
import { rattenBeeld } from './ratten/beeld';

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

// Er is één soort: de pack rats. Het spel begint meteen (in het niets, op weg naar de eerste wereld).

async function start(): Promise<void> {
  window.PERF = { rapport };
  const app = new Application();
  await app.init({ resizeTo: window, background: 0x07080a, antialias: false });
  markeer('renderer ready');
  document.body.appendChild(app.canvas);
  document.getElementById('versie')!.textContent = versieTekst();

  const adres = new URLSearchParams(location.search);
  // Visuele proto: ?proto=ratten
  if (adres.get('proto') === 'ratten') {
    const { toonMuizenProto } = await import('./ratten/proto');
    await toonMuizenProto(app);
    return;
  }

  const start = startUitAdres();
  let staat = nieuwSpel(seedUitAdres(), RATTEN, start);
  window.SPEL = {
    get staat() {
      return staat;
    },
    stap: (sec) => stap(staat, RATTEN, sec),
    zaai: (seed) => {
      staat = nieuwSpel(seed, RATTEN, start);
    },
    stream: () => stream(staat, RATTEN),
    wrath: (n) => geefWrath(staat, n),
    overval: (n = 3) => overval(staat, n),
    terrein: () => beeld.bewerker.alsJson(),
    laadTerrein: (json) => beeld.bewerker.laadJson(json),
    stuur: (ids, kol, rij) => stuur(staat, ids === 'alle' ? staat.werkers.map((w) => w.id) : ids, kol, rij),
  };

  const fb = rattenBeeld();
  const beeld = new WereldBeeld(staat, { ...fb, sprites: { ...fb.sprites, ...landSprites() } });
  await beeld.laad();
  markeer('world ready');
  app.stage.addChild(beeld.wereld);
  const besturing = maakBesturing(app, beeld.wereld, () => staat, (z) => beeld.zoom(z), (ids, kol, rij) =>
    stuur(staat, ids, kol, rij),
  beeld.bewerker,
  );
  let eind: HTMLElement | null = null;
  const balk = maakBalk();
  // SHIFT: spring nu al. Is de machine niet klaar, dan eerst een tweede klik (anders ben je de run kwijt).
  const shift = document.createElement('button');
  shift.id = 'shiftknop';
  document.body.append(shift);
  let gewapend = 0;
  shift.addEventListener('click', () => {
    if (!machineKlaar(staat) && performance.now() > gewapend) { gewapend = performance.now() + 3000; return; }
    gewapend = 0;
    vroegStream(staat);
  });
  const paneel = (await import('./ratten/paneel')).maakPaneel(() => staat, beeld);

  markeer('ui ready');
  maakOverlay();
  const weer = maakWeer();
  zetExtra(() => ({ ...beeld.statistiek(), muizen: staat.werkers.length }));
  app.ticker.add((t) => {
    const t0 = performance.now();
    const sec = Math.min(0.1, t.deltaMS / 1000);
    stap(staat, RATTEN, sec);
    besturing.werk(sec);
    beeld.werk(sec, besturing.selectie);
    weer.werk(staat, sec);
    paneel.werk(sec);
    const rest = Math.ceil(restTijd(staat));
    const kan = kanVroegSpringen(staat);
    const klaar = machineKlaar(staat);
    const wapen = performance.now() < gewapend && !klaar;
    shift.disabled = !kan;
    shift.className = klaar ? '' : 'nietklaar';
    shift.textContent = wapen ? 'NOT READY: CLICK AGAIN TO LOSE' : staat.dimensie >= FINALE ? 'SHIFT (END RUN)' : 'SHIFT NOW';
    shift.title = 'Jump to the next dimension now instead of waiting for the stream. Same rules: the machine needs full power and enough integrity.';
    shift.style.left = `${document.getElementById('balk')!.offsetWidth + 8}px`;
    const bezig = staat.werkers.filter((w) => w.taak !== 'rust').length;
    balk.zet([
      staat.dimensie >= FINALE ? '<b style="color:#ff3030">FINALE</b> · hold out until the machine charges one last time' : `Run: shift ${staat.dimensie} of ${RUN_SHIFTS} + finale`,
      staat.onderweg > 0
        ? `In the void · on the way to ${dimensieKleur(staat.dimensie).naam}`
        : `Dimension ${staat.dimensie} · ${dimensieKleur(staat.dimensie).naam} · stream in ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`,
      regelRegel(staat),
      wrathRegel(staat),
      `Machine: power ${Math.floor((100 * staat.machine.energie) / staat.machine.maxEnergie)}% · integrity ${Math.floor(staat.machine.heelheid)}%${rest <= 60 && staat.onderweg <= 0 && !staat.start?.gratisStroom && (staat.machine.energie < staat.machine.maxEnergie || staat.machine.heelheid < 50) ? ' · <b style="color:#ff3030">NOT READY FOR THE STREAM: you lose if it comes now</b>' : ' (needs 100% power and 50% integrity at the stream)'}`,
      `${RATTEN.naam}: ${staat.werkers.length} (${bezig} working) · selected ${besturing.selectie.size}`,
    ]);
    if (staat.uitkomst && !eind) eind = toonEinde(staat);
    markeer('first frame');
    beeldKlaar(t.deltaMS, performance.now() - t0);
  });
}

// Het eind van de run: gewonnen of verloren, met een knop voor een nieuwe run.
function toonEinde(s: SpelStaat): HTMLElement {
  const u = s.uitkomst!;
  const d = document.createElement('div');
  d.id = 'eind';
  d.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(5,6,8,.88);color:#e8e8e0;font:16px monospace;text-align:center;padding:24px;z-index:50';
  d.innerHTML = `<h1 style="margin:0;font-size:40px;color:${u.gewonnen ? '#6fcf6f' : '#ff3030'}">${u.gewonnen ? 'YOU MADE IT' : 'RUN OVER'}</h1>
    <p style="max-width:520px;margin:0">${u.reden}</p>
    <p style="margin:0;color:#9a9a90">Reached ${s.dimensie >= FINALE ? 'the finale' : `shift ${s.dimensie} of ${RUN_SHIFTS}`} · ${s.land.dim.naam}</p>`;
  const b = document.createElement('button');
  b.textContent = 'NEW RUN';
  b.style.cssText = 'font:inherit;padding:10px 24px;background:#1d1e1c;color:#9dff2e;border:2px solid #9dff2e;cursor:pointer';
  b.onclick = () => { const p = new URLSearchParams(location.search); p.delete('seed'); p.delete('shift'); location.search = p.toString(); };
  d.appendChild(b);
  document.body.appendChild(d);
  return d;
}

const regelRegel = (s: SpelStaat): string => {
  const r = regelVan(s);
  return r && s.onderweg <= 0 ? `Rule <b style="color:${r.kleur}">${r.naam}</b> · ${r.tekst}` : '';
};

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
