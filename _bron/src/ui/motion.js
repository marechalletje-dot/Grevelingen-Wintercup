// v53: beweging in Apple-stijl. Een kritisch gedempte veer (damping 1, response ~0,35 s) die altijd vanaf de
// huidige waarde en snelheid verder gaat, dus onderbreekbaar is; plus de schuivende markering onder de actieve tab.
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Veer voor één getal. set(target) start of stuurt bij vanaf de actuele waarde/snelheid; jump(v) zonder animatie. */
export function spring(onUpdate, { response = 0.35, damping = 1, value = 0 } = {}) {
  const w = 2 * Math.PI / response; let x = value, v = 0, target = value, raf = 0, last = 0;
  const step = t => {
    const dt = Math.min(0.032, (t - (last || t)) / 1000); last = t;
    // semi-impliciete Euler in kleine stapjes (stabiel bij lage framerates)
    for (let i = 0, n = 4; i < n; i++) { const h = dt / n; v += (-w * w * (x - target) - 2 * damping * w * v) * h; x += v * h; }
    if (Math.abs(x - target) < 0.05 && Math.abs(v) < 0.05) { x = target; v = 0; onUpdate(x); raf = 0; last = 0; return; }
    onUpdate(x); raf = requestAnimationFrame(step);
  };
  return {
    set(t) { target = t; if (reduced()) return this.jump(t); if (!raf) { last = 0; raf = requestAnimationFrame(step); } },
    jump(t) { target = x = t; v = 0; if (raf) cancelAnimationFrame(raf); raf = 0; onUpdate(x); },
    get value() { return x; },
  };
}

/** Schuivende "pil" achter de actieve tab; volgt aria-selected en meeschalen bij resize/scroll van de tabbalk. */
export function initTabIndicator(nav) {
  if (!nav) return;
  const ind = document.createElement('span'); ind.className = 'tabind'; ind.setAttribute('aria-hidden', 'true'); nav.prepend(ind);
  let L = 0, T = 0, W = 0, H = 0;
  const draw = () => { ind.style.transform = `translate(${L}px,${T}px)`; ind.style.width = W + 'px'; ind.style.height = H + 'px'; };
  const S = [v => { L = v; draw(); }, v => { T = v; draw(); }, v => { W = v; draw(); }, v => { H = v; draw(); }].map(f => spring(f));
  let first = true;
  function place() {
    const b = nav.querySelector('button[aria-selected="true"]'); if (!b || !b.offsetWidth) { ind.style.opacity = '0'; return; }
    ind.style.opacity = '1';
    const x = b.offsetLeft, y = b.offsetTop, w = b.offsetWidth, h = b.offsetHeight;
    // x en y elk een eigen veer (ook als de tabbalk over meer regels loopt)
    [x, y, w, h].forEach((v, i) => (first ? S[i].jump(v) : S[i].set(v))); first = false;
  // actieve tab in beeld houden op smalle schermen
    const r = nav.getBoundingClientRect(), br = b.getBoundingClientRect();
    if (br.left < r.left || br.right > r.right) nav.scrollTo({ left: x - (nav.clientWidth - w) / 2, behavior: reduced() ? 'auto' : 'smooth' });
  }
  new MutationObserver(place).observe(nav, { subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
  addEventListener('resize', () => { first = true; place(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { first = true; place(); });
  place();
}

export function initMotion() {
  // iOS Safari toont :active pas met een touchstart-luisteraar: zo is de druk-feedback direct bij aanraken
  document.addEventListener('touchstart', () => {}, { passive: true });
  initTabIndicator(document.querySelector('nav.tabs'));
}
