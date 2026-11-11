// Prestatiemeting: laadtijden, beelden per seconde, zwaarste beeld en hoe lang het maken van een wereld duurt.
// Overlay met F3 (of ?perf). `window.PERF.rapport()` geeft alles als gegevens, voor `npm run prestatie`.
// Dit is alleen meten: het verandert niets aan de spelregels.

// Grenzen waarboven de overlay rood wordt. Op een gewone laptop; in een headless browser zonder GPU zijn de FPS niet eerlijk.
export const BUDGET = { eersteBeeldMs: 4000, frameP95Ms: 33.4, logicaMs: 8, kaartMs: 500, grondMs: 800 };

interface Meting { laatste: number; max: number; n: number }

const markeringen: Record<string, number> = {};
const metingen: Record<string, Meting> = {};
const frames: number[] = [];
let logicaSom = 0;
let logicaN = 0;
const logicaRecent: number[] = [];
let extra: () => Record<string, number | string> = () => ({});

// Een moment in het laden: milliseconden sinds het openen van de pagina.
export function markeer(naam: string): void {
  if (!(naam in markeringen)) markeringen[naam] = Math.round(performance.now());
}

// Meet hoe lang iets duurt (bv. een wereld maken). Bewaart het laatste en het langste.
export function meet<T>(naam: string, werk: () => T): T {
  const t = performance.now();
  const uit = werk();
  const ms = performance.now() - t;
  const m = (metingen[naam] ??= { laatste: 0, max: 0, n: 0 });
  m.laatste = ms;
  m.max = Math.max(m.max, ms);
  m.n++;
  return uit;
}

export function zetExtra(f: () => Record<string, number | string>): void {
  extra = f;
}

// Elk beeld: hoe lang sinds het vorige, en hoeveel daarvan de spelregels en besturing kostten.
export function beeldKlaar(deltaMs: number, logicaMs: number): void {
  frames.push(deltaMs);
  if (frames.length > 180) frames.shift();
  logicaSom += logicaMs;
  logicaN++;
  logicaRecent.push(logicaMs);
  if (logicaRecent.length > 180) logicaRecent.shift();
}

function frameCijfers() {
  if (!frames.length) return { fps: 0, gemMs: 0, p95Ms: 0, slechtsteMs: 0 };
  const gem = frames.reduce((a, b) => a + b, 0) / frames.length;
  const s = [...frames].sort((a, b) => a - b);
  return { fps: 1000 / gem, gemMs: gem, p95Ms: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))], slechtsteMs: s[s.length - 1] };
}

export function rapport() {
  const f = frameCijfers();
  const logica = logicaN ? logicaSom / logicaN : 0;
  const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  const overschrijdingen: string[] = [];
  const eerste = markeringen['first frame'];
  if (eerste !== undefined && eerste > BUDGET.eersteBeeldMs) overschrijdingen.push(`first frame ${eerste} ms > ${BUDGET.eersteBeeldMs}`);
  if (frames.length >= 60 && f.p95Ms > BUDGET.frameP95Ms) overschrijdingen.push(`frame p95 ${f.p95Ms.toFixed(1)} ms > ${BUDGET.frameP95Ms}`);
  if (logica > BUDGET.logicaMs) overschrijdingen.push(`logic ${logica.toFixed(1)} ms > ${BUDGET.logicaMs}`);
  const kaart = metingen['generate map']?.max;
  if (kaart !== undefined && kaart > BUDGET.kaartMs) overschrijdingen.push(`generate map ${kaart.toFixed(0)} ms > ${BUDGET.kaartMs}`);
  const grond = metingen['build ground']?.max;
  if (grond !== undefined && grond > BUDGET.grondMs) overschrijdingen.push(`build ground ${grond.toFixed(0)} ms > ${BUDGET.grondMs}`);
  return {
    laden: { ...markeringen },
    metingen: Object.fromEntries(Object.entries(metingen).map(([k, m]) => [k, { laatsteMs: +m.laatste.toFixed(1), maxMs: +m.max.toFixed(1), keer: m.n }])),
    frames: { fps: +f.fps.toFixed(1), gemMs: +f.gemMs.toFixed(1), p95Ms: +f.p95Ms.toFixed(1), slechtsteMs: +f.slechtsteMs.toFixed(1), aantal: frames.length },
    logicaMs: +logica.toFixed(2),
    logicaMaxMs: +Math.max(0, ...logicaRecent).toFixed(1),
    heapMB: heap ? Math.round(heap.usedJSHeapSize / 1e6) : null,
    ...extra(),
    overschrijdingen,
  };
}

// De overlay: een tekstvlak rechtsboven. Verversen twee keer per seconde.
export function maakOverlay(): { zet(aan: boolean): void } {
  const el = document.createElement('pre');
  Object.assign(el.style, {
    position: 'fixed', top: '8px', right: '236px', zIndex: '30', margin: '0', padding: '8px 10px', display: 'none',
    background: '#07080aee', color: '#c8ccd2', border: '1px solid #3d4143', font: '12px monospace', pointerEvents: 'none',
  });
  document.body.appendChild(el);
  let aan = new URLSearchParams(location.search).has('perf');
  const teken = () => {
    el.style.display = aan ? 'block' : 'none';
    if (!aan) return;
    const r = rapport() as ReturnType<typeof rapport> & { kaart?: string; brokken?: string; muizen?: number };
    const l = r.laden;
    const m = r.metingen;
    const regels = [
      `FPS ${r.frames.fps}  (avg ${r.frames.gemMs} ms · p95 ${r.frames.p95Ms} ms · worst ${r.frames.slechtsteMs} ms)`,
      `logic ${r.logicaMs} ms per frame (worst of last 180: ${r.logicaMaxMs} ms)`,
      `load: renderer ${l['renderer ready'] ?? '?'} · assets+ground ${l['world ready'] ?? '?'} · ui ${l['ui ready'] ?? '?'} · first frame ${l['first frame'] ?? '?'} ms`,
      `generate map ${m['generate map']?.laatsteMs ?? '?'} ms · build ground ${m['build ground']?.laatsteMs ?? '?'} ms`,
      `map ${r.kaart ?? '?'} · chunks drawn ${r.brokken ?? '?'} · mice ${r.muizen ?? '?'}`,
      `heap ${r.heapMB ?? '?'} MB`,
      r.overschrijdingen.length ? 'SLOW: ' + r.overschrijdingen.join('; ') : 'within budget',
    ];
    el.textContent = regels.join('\n');
    el.style.color = r.overschrijdingen.length ? '#ff9a7a' : '#c8ccd2';
  };
  setInterval(teken, 500);
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'F3') return;
    e.preventDefault();
    aan = !aan;
    teken();
  });
  teken();
  return { zet: (v) => { aan = v; teken(); } };
}
