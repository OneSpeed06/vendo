/* =====================================================================
 * Vendo — gedeelde UI-bouwstenen (app + dashboard)
 * Kleuren staan hier als volledige Tailwind-klassen zodat de build ze vindt.
 * ===================================================================== */
(function (global) {
  'use strict';
  const { esc } = global.Vendo.util;

  const TONES = {
    emerald: { badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', ring: 'border-emerald-400 bg-emerald-500' },
    amber:   { badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',       dot: 'bg-amber-500',   bar: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',   ring: 'border-amber-300 bg-amber-500' },
    yellow:  { badge: 'bg-yellow-400/10 text-yellow-700 dark:text-yellow-300 border-yellow-400/40',   dot: 'bg-yellow-400',  bar: 'bg-yellow-400',  text: 'text-yellow-700 dark:text-yellow-300', ring: 'border-yellow-200 bg-yellow-400' },
    rose:    { badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30',           dot: 'bg-rose-500',    bar: 'bg-rose-500',    text: 'text-rose-600 dark:text-rose-400',     ring: 'border-rose-300 bg-rose-500' },
    sky:     { badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30',               dot: 'bg-sky-500',     bar: 'bg-sky-500',     text: 'text-sky-600 dark:text-sky-400',       ring: 'border-sky-300 bg-sky-500' },
    slate:   { badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',       dot: 'bg-slate-400',   bar: 'bg-slate-400',   text: 'text-slate-500 dark:text-slate-400',   ring: 'border-slate-300 bg-slate-500' },
    brand:   { badge: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/30',       dot: 'bg-brand-500',   bar: 'bg-brand-500',   text: 'text-brand-600 dark:text-brand-400',   ring: 'border-brand-400 bg-brand-500' },
  };
  const tone = (c) => TONES[c] || TONES.slate;
  // Basis-URL van de site (map boven /shared), zodat afbeeldingen werken vanuit /app en /dashboard
  const BASE = (() => { try { return new URL('../', document.currentScript.src).href; } catch (e) { return '../'; } })();

  function badge(text, color, extra = '') {
    return `<span class="badge ${tone(color).badge} ${extra}">${text}</span>`;
  }

  function fillColor(pct) { return pct < 15 ? 'rose' : pct < global.Vendo.CONFIG.lowFillPercent ? 'yellow' : 'emerald'; }

  function fillBar(pct, opts = {}) {
    const color = opts.color || fillColor(pct);
    const w = opts.width || 'w-16';
    return `<div class="flex items-center gap-1.5" title="Vulgraad ${pct}%">
      <div class="${w} h-1.5 overflow-hidden rounded-full bg-line/60"><div class="h-full rounded-full ${tone(color).bar}" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>
      ${opts.hideLabel ? '' : `<span class="text-[10px] font-bold tabular-nums">${pct}%</span>`}
    </div>`;
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg, kind = 'ok') {
    let el = document.getElementById('vendoToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'vendoToast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.className = 'fixed left-1/2 top-4 z-[100] -translate-x-1/2 max-w-[92vw]';
      document.body.appendChild(el);
    }
    const icon = kind === 'error' ? '<i class="fa-solid fa-circle-exclamation text-rose-400"></i>' : kind === 'info' ? '<i class="fa-solid fa-circle-info text-sky-400"></i>' : '<i class="fa-solid fa-circle-check text-emerald-400"></i>';
    el.innerHTML = `<div class="pop flex items-center gap-2 rounded-full border ${kind === 'error' ? 'border-rose-500/60' : 'border-brand-500/60'} bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-2xl">${icon}<span>${esc(msg)}</span></div>`;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  // ---------- Thema ----------
  function applyTheme(theme) {
    const root = document.documentElement;
    root.classList.toggle('theme-dark', theme === 'dark');
    root.classList.toggle('theme-light', theme === 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#131b2e' : '#ffffff');
  }
  function initTheme(key) {
    let t = null;
    try { t = localStorage.getItem(key); } catch (e) { /* noop */ }
    if (!t) t = 'dark'; // zelfde standaard als het prototype
    applyTheme(t);
    return t;
  }
  function toggleTheme(key) {
    const next = document.documentElement.classList.contains('theme-dark') ? 'light' : 'dark';
    try { localStorage.setItem(key, next); } catch (e) { /* noop */ }
    applyTheme(next);
    return next;
  }

  // ---------- Logo ----------
  const logo = (cls = 'w-9 h-9') => `
    <div class="${cls} shrink-0 rounded-xl bg-slate-900 border border-brand-500/40 flex items-center justify-center p-1 shadow-lg shadow-brand-500/20">
      <svg class="w-full h-full" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M20 37C20 37 33 25.5 33 14C33 6.82 27.18 1 20 1C12.82 1 7 6.82 7 14C7 25.5 20 37 20 37Z" fill="url(#vg)" stroke="#FF6B00" stroke-width="1.5"/>
        <path d="M12 11L20 23L28 11H23.5L20 16.5L16.5 11H12Z" fill="#0B0F19"/>
        <rect x="14" y="22" width="12" height="2.5" rx="1.25" fill="#FF6B00"/>
        <circle cx="20" cy="7.5" r="2.2" fill="#10B981"/>
        <defs><linearGradient id="vg" x1="7" y1="1" x2="33" y2="37" gradientUnits="userSpaceOnUse"><stop stop-color="#FF6B00"/><stop offset="1" stop-color="#F59E0B"/></linearGradient></defs>
      </svg>
    </div>`;

  // ---------- Plattegrond ----------
  /**
   * Tekent de plattegrond van één verdiep met pins.
   * opts: { campusId, floor, machines, dimIds:Set, selectedId, me:{x,y}|null,
   *         onPin(id), onBackground(x,y), showLegend, audience:'app'|'dashboard' }
   * Verdiepen met een `image` (echt grondplan) tonen die afbeelding; anders de schematische zones.
   */
  function renderFloorplan(el, opts) {
    const V = global.Vendo;
    const campus = V.get.campus(opts.campusId);
    const floor = campus && campus.floors.find((f) => f.id === opts.floor);
    if (!floor) { el.innerHTML = '<p class="p-4 text-sm text-muted">Geen plattegrond beschikbaar.</p>'; return; }
    const dim = opts.dimIds || new Set();

    const audience = opts.audience || 'dashboard';
    const [aw, ah] = String(floor.aspect || '4 / 3').split('/').map(Number);
    const wide = !!floor.image && aw / ah > 1.8;
    const zones = floor.image
      ? `<img src="${BASE + floor.image}" alt="Grondplan ${esc(campus.name)}, ${esc(floor.name)}" draggable="false" class="pointer-events-none absolute inset-0 h-full w-full select-none dark:invert dark:hue-rotate-180">`
      : (floor.zones || []).map((zn) => `
      <div class="pointer-events-none absolute flex items-start gap-1 rounded-xl border border-dashed border-muted/40 bg-muted/5 p-1.5" style="left:${zn.x}%;top:${zn.y}%;width:${zn.w}%;height:${zn.h}%">
        <span class="text-[11px] leading-none opacity-70">${zn.icon}</span>
        <span class="text-[8px] font-bold uppercase tracking-wide text-muted leading-tight">${esc(zn.label)}</span>
      </div>`).join('');
    const pinSize = floor.image ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm';

    const pins = opts.machines.map((m) => {
      const st = V.derive.machineState(m, audience);
      const isSel = m.id === opts.selectedId;
      const isDim = dim.has(m.id);
      return `
      <button type="button" data-pin="${m.id}" aria-label="Automaat ${esc(m.code)}, ${st.label}"
        class="group absolute z-10 -translate-x-1/2 -translate-y-1/2 focus:outline-none ${isDim ? 'opacity-30 grayscale' : ''}" style="left:${m.x}%;top:${m.y}%">
        <span class="relative flex flex-col items-center">
          ${isSel ? '<span class="absolute -inset-1.5 rounded-full border-2 border-brand-500 animate-ping opacity-60"></span>' : ''}
          <span class="flex ${pinSize} items-center justify-center rounded-full border-2 ${tone(st.color).ring} shadow-lg transition-transform group-hover:scale-110 ${isSel ? 'scale-125 ring-4 ring-brand-500/40' : ''}">${V.MACHINE_TYPES[m.type].icon}</span>
          <span class="mt-0.5 rounded bg-slate-900/90 px-1.5 py-px text-[9px] font-bold text-white shadow">${esc(m.code)}</span>
        </span>
      </button>`;
    }).join('');

    const me = opts.me ? `
      <div class="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2" style="left:${opts.me.x}%;top:${opts.me.y}%">
        <div class="me-pulse h-4 w-4 rounded-full border-2 border-white bg-blue-500"></div>
        <div class="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded bg-blue-500 px-1.5 text-[9px] font-bold text-white">Jij</div>
      </div>` : '';

    const legend = opts.showLegend === false ? '' : `
        <div class="pointer-events-none mt-1.5 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] font-semibold text-muted">
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-emerald-500"></span>Werkt</span>
          ${audience === 'app' ? '' : '<span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-yellow-400"></span>Bijna leeg</span>'}
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-amber-500"></span>Storing gemeld</span>
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-rose-500"></span>Defect</span>
          ${opts.me ? '<span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-blue-500"></span>Jij</span>' : ''}
        </div>`;
    el.innerHTML = `
      <div data-scroller class="${wide ? 'overflow-x-auto rounded-2xl' : ''}">
      <div data-plan class="relative ${wide ? 'min-w-[640px]' : ''} w-full overflow-hidden rounded-2xl border-2 border-line bg-sub ${opts.onBackground ? 'cursor-crosshair' : ''}" style="aspect-ratio:${floor.aspect || '4 / 3'}">
        ${floor.image ? '' : `<svg class="pointer-events-none absolute inset-0 h-full w-full text-muted opacity-20" aria-hidden="true"><defs><pattern id="grid-${opts.campusId}" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0L0 0 0 20" fill="none" stroke="currentColor" stroke-width=".5"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid-${opts.campusId})"/></svg>`}
        ${zones}${pins}${me}
      </div></div>${legend}`;

    // brede plattegrond op gsm: scroll naar de geselecteerde automaat of naar "jij"
    const sc = el.querySelector('[data-scroller]');
    const focus = opts.machines.find((m) => m.id === opts.selectedId) || opts.me;
    if (wide && sc && focus) requestAnimationFrame(() => { sc.scrollLeft = Math.max(0, (sc.scrollWidth * focus.x) / 100 - sc.clientWidth / 2); });

    el.querySelectorAll('[data-pin]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      opts.onPin && opts.onPin(b.dataset.pin);
    }));
    if (opts.onBackground) {
      const plan = el.querySelector('[data-plan]');
      plan.addEventListener('click', (e) => {
        const r = plan.getBoundingClientRect();
        const x = Math.round(((e.clientX - r.left) / r.width) * 100);
        const y = Math.round(((e.clientY - r.top) / r.height) * 100);
        opts.onBackground(Math.max(2, Math.min(98, x)), Math.max(2, Math.min(98, y)));
      });
    }
  }

  global.VendoUI = { tone, badge, fillBar, fillColor, toast, initTheme, toggleTheme, applyTheme, logo, renderFloorplan };
})(window);
