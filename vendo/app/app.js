/* =====================================================================
 * Vendo — studenten- en personeelsapp (PWA)
 * Tabs: Ontdek (zoeken + lijst/kaart) · Reservaties · Ideeën · Profiel
 * ===================================================================== */
(function () {
  'use strict';
  const V = window.Vendo, U = window.VendoUI;
  const { esc, euro, timeAgo, clock } = V.util;
  const $ = (sel, root = document) => root.querySelector(sel);
  const root = $('#app');

  // ---------- Lokale voorkeuren (per toestel) ----------
  const PREF = { campus: 'vendo.app.campus', me: 'vendo.app.me', view: 'vendo.app.view', theme: 'vendo.theme' };
  const readPref = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } };
  const writePref = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* noop */ } };

  U.initTheme(PREF.theme);

  // ---------- UI-toestand ----------
  const ui = {
    tab: 'ontdek',
    campusId: readPref(PREF.campus, 'groenplaats'),
    view: readPref(PREF.view, 'list'),       // 'list' | 'map'
    floor: 'all',                             // lijstfilter: 'all' of verdiep-id
    mapFloor: null,                           // verdiep dat op de kaart staat
    type: 'all',                              // 'all' | 'drank' | 'snack' | 'koffie'
    tags: [],                                 // dieetfilters
    onlyWorking: true,
    query: '',
    selectedPin: null,
    showUnavailable: false,
    sheet: null,                              // { kind, ...props }
    sheetTag: 'all',
    loginError: '',
  };
  if (!V.get.campus(ui.campusId)) ui.campusId = V.get.state().campuses[0].id;

  const TYPE_FILTERS = [
    { id: 'all', label: 'Alles', short: 'Alles', icon: '' },
    { id: 'drank', label: 'Drank', short: 'Drank', icon: '🥤', cats: ['drank'] },
    { id: 'snack', label: 'Snacks', short: 'Snacks', icon: '🍫', cats: ['snack', 'gezond'] },
    { id: 'koffie', label: 'Koffie & warm', short: 'Warm', icon: '☕', cats: ['koffie'] },
  ];

  // ---------- Positie van de gebruiker ----------
  function me() {
    const all = readPref(PREF.me, {});
    const campus = V.get.campus(ui.campusId);
    const saved = all[ui.campusId];
    const ent = campus.entrance || { floor: campus.floors[0].id, x: 50, y: 50 };
    return { campusId: ui.campusId, floor: saved ? saved.floor : ent.floor, x: saved ? saved.x : ent.x, y: saved ? saved.y : ent.y, set: !!saved };
  }
  function setMe(floor, x, y) {
    const all = readPref(PREF.me, {});
    all[ui.campusId] = { floor, x, y };
    writePref(PREF.me, all);
  }

  const user = () => V.auth.currentUser('app');

  // =====================================================================
  //  LOGIN
  // =====================================================================
  function renderLogin() {
    root.innerHTML = `
      <div class="flex flex-1 flex-col justify-between overflow-y-auto p-6">
        <div class="pt-8">
          <div class="flex items-center gap-3">
            ${U.logo('w-12 h-12')}
            <div>
              <h1 class="bg-gradient-to-r from-brand-500 to-amber-500 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">Vendo</h1>
              <span class="badge border-rose-500/30 bg-rose-500/15 text-rose-500 dark:text-rose-400">KdG EDITION</span>
            </div>
          </div>
          <p class="mt-6 text-xl font-extrabold leading-snug">Weet waar je snack ligt<br>vóór je de trap op loopt.</p>
          <p class="mt-2 text-sm text-muted">Zie welke automaten in de buurt werken, wat erin zit, reserveer je product en meld storingen.</p>

          <form id="loginForm" class="mt-8 space-y-3" novalidate>
            <div>
              <label class="label" for="email">KdG e-mail</label>
              <input id="email" name="email" type="email" autocomplete="username" class="field" placeholder="voornaam.naam@student.kdg.be" required>
            </div>
            <div>
              <label class="label" for="pw">Wachtwoord</label>
              <input id="pw" name="pw" type="password" autocomplete="current-password" class="field" placeholder="••••" required>
            </div>
            ${ui.loginError ? `<p class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400">${esc(ui.loginError)}</p>` : ''}
            <button class="btn-primary w-full py-3 text-sm" type="submit">Inloggen</button>
          </form>

          <div class="mt-6">
            <p class="label text-center">Of probeer een demo-account</p>
            <div class="grid grid-cols-2 gap-2">
              <button class="btn-ghost py-2.5 text-xs" onclick="App.demoLogin('lotte.peeters@student.kdg.be')">🎓 Student</button>
              <button class="btn-ghost py-2.5 text-xs" onclick="App.demoLogin('tom.janssens@kdg.be')">💼 Personeel</button>
            </div>
          </div>
        </div>
        <p class="mt-8 text-center text-[11px] text-muted">Werk je voor de vulploeg? <a class="font-bold text-brand-500 underline" href="../dashboard/">Naar het dashboard</a></p>
      </div>`;
    $('#loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const res = V.auth.login('app', $('#email').value, $('#pw').value);
      ui.loginError = res.ok ? '' : res.error;
      if (!res.ok) render();
    });
  }

  // =====================================================================
  //  SHELL
  // =====================================================================
  function renderShell() {
    root.innerHTML = `
      <header class="z-30 shrink-0 border-b border-line bg-card px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            ${U.logo()}
            <div>
              <div class="flex items-center gap-1.5">
                <h1 class="bg-gradient-to-r from-brand-500 to-amber-500 bg-clip-text text-lg font-extrabold tracking-tight text-transparent">Vendo</h1>
                <span class="rounded border border-rose-500/30 bg-rose-500/15 px-1.5 text-[9px] font-black tracking-wider text-rose-500 dark:text-rose-400">KdG</span>
              </div>
              <p class="text-[10px] font-medium text-muted">Automaten op je campus</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <button onclick="App.toggleTheme()" aria-label="Wissel thema" class="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-sub text-amber-500"><i id="themeIcon" class="fa-solid fa-sun text-xs"></i></button>
            <button onclick="App.openSheet('notifications')" aria-label="Meldingen" class="relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-sub text-muted">
              <i class="fa-regular fa-bell text-sm"></i>
              <span id="bellCount" class="absolute -right-0.5 -top-0.5 hidden min-w-[18px] rounded-full bg-brand-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white"></span>
            </button>
          </div>
        </div>
        ${V.get.state().campuses.length === 1 ? `
        <p class="mt-2.5 flex items-center gap-2 rounded-xl border border-line bg-sub px-3 py-2 text-xs font-semibold"><i class="fa-solid fa-graduation-cap text-brand-500"></i>${esc(V.get.state().campuses[0].name)} <span class="font-normal text-muted">· ${esc(V.get.state().campuses[0].street)}</span></p>` : `
        <div class="relative mt-2.5">
          <label for="campusSelect" class="sr-only">Kies campus</label>
          <i class="fa-solid fa-graduation-cap pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-brand-500"></i>
          <select id="campusSelect" onchange="App.setCampus(this.value)" class="field appearance-none py-2 pl-8 pr-8 text-xs font-semibold">
            ${V.get.state().campuses.map((c) => `<option value="${c.id}" ${c.id === ui.campusId ? 'selected' : ''}>${esc(c.name)} (${esc(c.street)})</option>`).join('')}
          </select>
          <i class="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-brand-500"></i>
        </div>`}
      </header>

      <main id="view" class="flex-1 overflow-y-auto"></main>

      <nav class="z-30 flex shrink-0 justify-around border-t border-line bg-card px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2" aria-label="Hoofdmenu">
        ${navBtn('ontdek', 'fa-cubes-stacked', 'Ontdek')}
        ${navBtn('reservaties', 'fa-ticket', 'Reservaties')}
        ${navBtn('ideeen', 'fa-lightbulb', 'Ideeën')}
        ${navBtn('profiel', 'fa-id-card', 'Profiel')}
      </nav>
      <div id="sheetRoot"></div>`;
    updateThemeIcon();
  }

  function navBtn(id, icon, label) {
    return `<button onclick="App.setTab('${id}')" data-tab="${id}" class="relative flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-muted transition-colors">
      <i class="fa-solid ${icon} text-base"></i><span class="text-[10px] font-semibold">${label}</span>
      <span data-navbadge="${id}" class="absolute right-2 top-0 hidden min-w-[16px] rounded-full bg-brand-500 px-1 text-center text-[9px] font-bold leading-4 text-white"></span>
    </button>`;
  }

  function updateChrome() {
    const u = user();
    document.querySelectorAll('[data-tab]').forEach((b) => {
      const active = b.dataset.tab === ui.tab;
      b.classList.toggle('text-brand-500', active);
      b.classList.toggle('text-muted', !active);
      b.setAttribute('aria-current', active ? 'page' : 'false');
    });
    const unread = V.get.state().notifications.filter((n) => n.userId === u.id && !n.read).length;
    const bell = $('#bellCount');
    if (bell) { bell.textContent = unread; bell.classList.toggle('hidden', unread === 0); }
    const activeRes = V.get.state().reservations.filter((r) => r.userId === u.id && r.status === 'actief').length;
    const b = document.querySelector('[data-navbadge="reservaties"]');
    if (b) { b.textContent = activeRes; b.classList.toggle('hidden', activeRes === 0); }
    const sel = $('#campusSelect');
    if (sel && sel.value !== ui.campusId) sel.value = ui.campusId;
  }

  function updateThemeIcon() {
    const i = $('#themeIcon');
    if (!i) return;
    const dark = document.documentElement.classList.contains('theme-dark');
    i.className = dark ? 'fa-solid fa-sun text-xs' : 'fa-solid fa-moon text-xs text-slate-600';
  }

  // =====================================================================
  //  TAB: ONTDEK
  // =====================================================================
  function renderDiscoverFrame() {
    $('#view').innerHTML = `
      <div class="sticky top-0 z-20 space-y-2 border-b border-line bg-bg/95 px-3 pb-2 pt-3 backdrop-blur">
        <div class="flex items-center gap-2">
          <div class="relative min-w-0 flex-1">
            <i class="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-brand-500"></i>
            <input id="searchInput" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" value="${esc(ui.query)}"
              class="field py-2.5 pl-8 pr-9 text-sm" placeholder="Zoek een product…" aria-label="Zoek product">
            <button id="clearSearch" onclick="App.clearSearch()" aria-label="Wis zoekopdracht" class="absolute right-2 top-1/2 hidden -translate-y-1/2 p-1.5 text-muted hover:text-ink"><i class="fa-solid fa-circle-xmark text-sm"></i></button>
          </div>
          <div id="viewToggle" class="flex shrink-0 rounded-xl border border-line bg-sub p-0.5" role="tablist" aria-label="Weergave"></div>
        </div>
        <div id="discoverControls"></div>
      </div>
      <div id="discoverBody" class="p-3 pb-6"></div>`;
    const input = $('#searchInput');
    input.addEventListener('input', () => { ui.query = input.value; ui.selectedPin = null; renderDiscoverBody(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    renderDiscoverBody();
  }

  function typeMatches(m) {
    if (ui.type === 'all') return true;
    if (m.type === ui.type) return true;
    const cats = TYPE_FILTERS.find((t) => t.id === ui.type).cats;
    return m.slots.some((s) => cats.includes(V.get.product(s.productId)?.category));
  }

  function computeRows() {
    const pos = me();
    const searching = ui.query.trim() !== '' || ui.tags.length > 0;
    const rows = V.get.machinesOfCampus(ui.campusId).filter(typeMatches).map((m) => {
      const st = V.derive.machineState(m, 'app');
      const matches = searching ? V.derive.matchingSlots(m, ui.query, ui.tags) : [];
      const inStock = matches.filter((x) => x.avail > 0);
      return { m, st, matches, inStock, dist: V.derive.distance(pos, m) };
    });
    rows.sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9) || a.m.code.localeCompare(b.m.code));
    return { rows, searching, pos };
  }

  function renderDiscoverBody() {
    const clear = $('#clearSearch');
    if (clear) clear.classList.toggle('hidden', !ui.query);
    const campus = V.get.campus(ui.campusId);
    const { rows, searching, pos } = computeRows();

    // ---- Filters ----
    const favs = (user().favorites || []).map((id) => V.get.product(id)).filter(Boolean);
    const favAvail = (p) => rows.reduce((a, r) => a + (r.st.usable ? r.m.slots.filter((sl) => sl.productId === p.id).reduce((b, sl) => b + V.derive.available(r.m, sl), 0) : 0), 0);
    // Type automaat: één rustige gesegmenteerde balk
    $('#discoverControls').innerHTML = `
      <div class="grid grid-cols-4 rounded-xl border border-line bg-sub p-0.5 text-[11px] font-semibold" role="radiogroup" aria-label="Soort automaat">
        ${TYPE_FILTERS.map((t) => `<button role="radio" aria-checked="${ui.type === t.id}" onclick="App.setType('${t.id}')"
          class="flex items-center justify-center gap-1 rounded-lg py-1.5 transition-colors ${ui.type === t.id ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'}">
          <span class="${t.id === 'all' ? 'hidden' : ''}">${t.icon}</span>${t.short}</button>`).join('')}
      </div>`;
    $('#viewToggle').innerHTML = [['list', 'fa-list-ul', 'Lijst'], ['map', 'fa-map', 'Kaart']].map(([id, icon, label]) => `
      <button role="tab" aria-selected="${ui.view === id}" aria-label="${label}" title="${label}" onclick="App.setView('${id}')"
        class="flex h-9 w-9 items-center justify-center rounded-lg text-sm ${ui.view === id ? 'bg-brand-500 text-white' : 'text-muted hover:text-ink'}"><i class="fa-solid ${icon}"></i></button>`).join('');

    const body = $('#discoverBody');
    if (ui.view === 'map') { renderMapView(body, rows, searching, pos, campus); return; }

    // ---- Lijstweergave ----
    let html = searching ? '' : favoritesStrip(favs, favAvail);
    if (searching) {
      const hits = rows.filter((r) => r.st.usable && r.inStock.length > 0);
      const misses = rows.filter((r) => r.matches.length > 0 && !(r.st.usable && r.inStock.length > 0));
      html += summaryLine(hits.length ? `<span class="text-ink">${hits.length} ${hits.length === 1 ? 'automaat heeft' : 'automaten hebben'} het</span>` : 'Geen resultaten', false);
      if (!hits.length) html += emptyState(misses.length ? 'Nergens op voorraad op deze campus' : 'Niets gevonden', misses.length ? 'Het product zit wel in een automaat, maar is uitverkocht of de automaat is defect.' : 'Probeer een andere zoekterm of stel het product voor.', true);
      html += hits.map((r, i) => machineCard(r, { nearest: i === 0, searching })).join('');
      if (misses.length) {
        html += `<button onclick="App.toggleUnavailable()" class="mt-3 w-full rounded-xl border border-dashed border-line py-2 text-[11px] font-semibold text-muted">
          ${ui.showUnavailable ? 'Verberg' : 'Toon'} ${misses.length} niet-beschikbare ${misses.length === 1 ? 'automaat' : 'automaten'} <i class="fa-solid fa-chevron-${ui.showUnavailable ? 'up' : 'down'} ml-1 text-[9px]"></i></button>`;
        if (ui.showUnavailable) html += `<div class="mt-2 space-y-3 opacity-70">${misses.map((r) => machineCard(r, { searching })).join('')}</div>`;
      }
    } else {
      let list = rows;
      if (ui.onlyWorking) list = list.filter((r) => r.st.usable);
      html += summaryLine(`${list.length} ${list.length === 1 ? 'automaat' : 'automaten'}`, true);
      if (!list.length) html += emptyState('Geen automaten', 'Geen automaten voor deze filters.', false);
      html += list.map((r, i) => machineCard(r, { nearest: i === 0 && r.dist !== null })).join('');
    }
    body.innerHTML = `<div class="space-y-3">${html}</div>`;
  }

  /** Regel boven de resultaten, met de schakelaar "Enkel werkende" */
  /** Favorieten: compacte kaartjes bovenaan de lijst (niet in de vaste balk) */
  function favoritesStrip(favs, favAvail) {
    if (!favs.length) {
      return `<p class="flex items-center gap-2 text-[11px] text-muted"><i class="fa-regular fa-star text-amber-400"></i>Tip: tik op de ster bij een product om het als favoriet te bewaren.</p>`;
    }
    return `<section aria-label="Favorieten">
      <h2 class="mb-1.5 text-[11px] font-bold text-muted"><i class="fa-solid fa-star mr-1 text-amber-400"></i>Favorieten</h2>
      <div class="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3">
        ${favs.map((p) => { const n = favAvail(p);
          return `<button onclick="App.setQuery(${esc(JSON.stringify(p.name))})" class="flex shrink-0 items-center gap-2 rounded-xl border border-line bg-card py-1.5 pl-2 pr-2.5 text-left hover:border-brand-500/50">
            <span class="text-lg leading-none">${p.icon}</span>
            <span><span class="block text-[11px] font-bold leading-tight">${esc(p.name.replace(/\s\d+cl$/, ''))}</span>
            <span class="block text-[10px] font-semibold ${n ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}">${n ? `${n} beschikbaar` : 'Uitverkocht'}</span></span>
          </button>`; }).join('')}
      </div>
    </section>`;
  }

  /** Regel boven de resultaten: aantal + eigen locatie, met de schakelaar "Enkel werkende" */
  function summaryLine(text, withToggle, showLocation = true) {
    const pos = me();
    return `<div class="mb-1 flex items-center justify-between gap-3">
      <p class="min-w-0 text-[11px] font-semibold text-muted">${text}${showLocation ? ` · vanaf <button onclick="App.openSheet('location')" class="font-semibold text-blue-600 hover:underline dark:text-blue-400" aria-label="Wijzig je locatie"><i class="fa-solid fa-location-crosshairs mr-0.5"></i>${esc(V.get.floorName(ui.campusId, pos.floor))}${pos.set ? '' : ' (ingang)'}</button>` : ''}</p>
      ${withToggle ? `<label class="flex shrink-0 cursor-pointer items-center gap-2 text-[11px] font-semibold text-muted">
        Enkel werkende
        <button type="button" role="switch" aria-checked="${ui.onlyWorking}" aria-label="Toon enkel werkende automaten" onclick="App.toggleWorking()"
          class="relative h-5 w-9 rounded-full transition-colors ${ui.onlyWorking ? 'bg-emerald-500' : 'bg-line'}">
          <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${ui.onlyWorking ? 'left-[18px]' : 'left-0.5'}"></span>
        </button></label>` : ''}
    </div>`;
  }

  function emptyState(title, text, suggest) {
    return `<div class="card px-4 py-8 text-center">
      <i class="fa-solid fa-magnifying-glass mb-2 block text-2xl text-muted"></i>
      <h3 class="text-sm font-bold">${esc(title)}</h3>
      <p class="mt-1 text-xs text-muted">${esc(text)}</p>
      <div class="mt-3 flex justify-center gap-2">
        ${ui.query ? '<button onclick="App.clearSearch()" class="btn-ghost px-3 py-1.5 text-xs">Wis zoekopdracht</button>' : ''}
        ${suggest ? `<button onclick="App.openSheet('suggest', { name: ${esc(JSON.stringify(ui.query.trim()))} })" class="btn-primary px-3 py-1.5 text-xs"><i class="fa-solid fa-lightbulb"></i> Stel voor</button>` : ''}
      </div>
    </div>`;
  }

  function machineCard(r, opts = {}) {
    const { m, st } = r;
    const t = V.MACHINE_TYPES[m.type];
    const distTxt = V.derive.distanceLabel(me(), m);
    let middle = '';
    if (opts.searching && r.matches.length) {
      middle = `<div class="mb-2 space-y-1.5">${r.matches.map((x) => `
        <div class="flex items-center justify-between gap-2 rounded-xl border ${x.avail > 0 && st.usable ? 'border-brand-500/40 bg-brand-500/10' : 'border-line bg-sub/60'} px-2.5 py-1.5">
          <div class="min-w-0">
            <p class="truncate text-xs font-bold">${x.product.icon} ${esc(x.product.name)}</p>
            <p class="text-[10px] font-semibold ${x.avail > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}">${x.avail > 0 ? `${x.avail} beschikbaar` : 'Uitverkocht'} · ${euro(x.product.price)}</p>
          </div>
          ${x.avail > 0 && st.usable ? `<button onclick="App.openSheet('reserve', { machineId: '${m.id}', slot: '${x.slot.code}' })" class="btn-primary shrink-0 px-2.5 py-1.5 text-[11px]"><i class="fa-solid fa-bookmark text-[10px]"></i> Reserveer</button>` : ''}
        </div>`).join('')}</div>`;
    } else {
      const favIds = user().favorites || [];
      const chips = m.slots.map((s) => {
        const p = V.get.product(s.productId); const a = V.derive.available(m, s);
        const short = p.name.replace(/\s\d+cl$/, '');
        return `<span class="inline-flex items-center gap-1 rounded-lg border ${favIds.includes(p.id) ? 'border-amber-400/60' : 'border-line'} bg-sub py-0.5 pl-2 pr-1 text-[10px]" title="${esc(p.name)}: ${a} beschikbaar">
          <span class="${a === 0 ? 'text-muted line-through' : ''}">${p.icon} ${esc(short)}</span>
          <span class="rounded-md px-1 font-bold tabular-nums ${a === 0 ? 'bg-rose-500/15 text-rose-500' : a <= 2 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'}">${a}</span></span>`;
      }).join('');
      middle = `<div class="mb-2.5 flex flex-wrap gap-1">${chips}</div>`;
    }
    return `
      <article class="card p-3 transition-colors hover:border-brand-500/50">
        <div class="mb-2 flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="text-sm font-extrabold"><span title="${t.label}">${t.icon}</span> Automaat ${esc(m.code)}</h3>
            <p class="mt-0.5 truncate text-[11px] text-muted">${esc(V.get.floorName(m.campusId, m.floor))} · ${esc(m.location)}</p>
            ${distTxt ? `<p class="mt-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400"><i class="fa-solid fa-person-walking mr-1"></i>${opts.nearest ? 'Dichtstbij · ' : ''}${distTxt}</p>` : ''}
          </div>
          ${U.badge(`${st.dot} ${st.short}`, st.color, 'shrink-0')}
        </div>
        ${middle}
        <div class="grid ${opts.inMap ? 'grid-cols-1' : 'grid-cols-[1fr_auto]'} gap-2">
          <button onclick="App.openSheet('machine', { id: '${m.id}' })" class="btn-primary py-2 text-[11px]">Bekijk inhoud</button>
          ${opts.inMap ? '' : `<button onclick="App.showOnMap('${m.id}')" class="btn-ghost px-3 py-2 text-[11px]" aria-label="Toon ${esc(m.code)} op de kaart"><i class="fa-solid fa-map-location-dot text-brand-500"></i> Op kaart</button>`}
        </div>
      </article>`;
  }

  function renderMapView(body, rows, searching, pos, campus) {
    if (ui.mapFloor === null || !campus.floors.some((f) => f.id === ui.mapFloor)) ui.mapFloor = pos.floor;
    const isHit = (r) => (searching ? r.st.usable && r.inStock.length > 0 : (!ui.onlyWorking || r.st.usable));
    const floorRows = rows.filter((r) => r.m.floor === ui.mapFloor);
    const dim = new Set(floorRows.filter((r) => !isHit(r)).map((r) => r.m.id));
    const counts = {};
    rows.forEach((r) => { if (isHit(r)) counts[r.m.floor] = (counts[r.m.floor] || 0) + 1; });

    body.innerHTML = `
      <div class="no-scrollbar mb-2 flex items-center gap-1.5 overflow-x-auto">
        ${campus.floors.map((f) => `<button class="chip px-2.5 py-1 text-[10px] ${ui.mapFloor === f.id ? 'chip-active' : ''}" onclick="App.setMapFloor(${f.id})">
          ${f.id === pos.floor ? '<i class="fa-solid fa-location-crosshairs"></i>' : ''} ${esc(f.name)}
          <span class="ml-0.5 rounded-full ${ui.mapFloor === f.id ? 'bg-white/25' : 'bg-line'} px-1.5 text-[9px]">${counts[f.id] || 0}</span></button>`).join('')}
      </div>
      ${searching ? '' : summaryLine(`${floorRows.filter(isHit).length} ${floorRows.filter(isHit).length === 1 ? 'automaat' : 'automaten'} op dit verdiep`, true, false)}
      <div id="floorplan"></div>
      <p class="mt-1.5 text-center text-[10px] text-muted"><i class="fa-solid fa-hand-pointer mr-1"></i>Tik op een automaat voor details · tik op een lege plek om je locatie te zetten</p>
      <div id="pinCard" class="mt-2"></div>`;

    U.renderFloorplan($('#floorplan'), {
      audience: 'app', campusId: ui.campusId, floor: ui.mapFloor, machines: floorRows.map((r) => r.m), dimIds: dim,
      selectedId: ui.selectedPin, me: pos.floor === ui.mapFloor ? pos : null,
      onPin: (id) => { ui.selectedPin = id; renderDiscoverBody(); },
      onBackground: (x, y) => { setMe(ui.mapFloor, x, y); U.toast('Je locatie is aangepast'); renderDiscoverBody(); },
    });

    let sel = floorRows.find((r) => r.m.id === ui.selectedPin);
    if (!sel) sel = floorRows.filter(isHit).sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9))[0];
    const card = $('#pinCard');
    if (sel) card.innerHTML = machineCard(sel, { searching, inMap: true });
    else if (searching && Object.keys(counts).length) {
      const other = campus.floors.filter((f) => counts[f.id]);
      card.innerHTML = `<div class="card p-3 text-center text-xs text-muted">Niets op dit verdiep. Wel op: ${other.map((f) => `<button class="font-bold text-brand-500 underline" onclick="App.setMapFloor(${f.id})">${esc(f.name)}</button>`).join(', ')}</div>`;
    } else card.innerHTML = `<div class="card p-3 text-center text-xs text-muted">${searching ? 'Geen automaat met dit product op voorraad.' : 'Geen automaten op dit verdiep.'}</div>`;
  }

  // =====================================================================
  //  TAB: RESERVATIES
  // =====================================================================
  function renderReservations() {
    const u = user();
    const all = V.get.state().reservations.filter((r) => r.userId === u.id);
    const active = all.filter((r) => r.status === 'actief');
    const past = all.filter((r) => r.status !== 'actief').slice(0, 15);
    $('#view').innerHTML = `
      <div class="space-y-4 p-3 pb-6">
        <div>
          <h2 class="text-base font-extrabold">Mijn reservaties</h2>
          <p class="text-xs text-muted">Een reservatie houdt je product ${V.util.duration(V.CONFIG.reservationMinutes)} opzij. Annuleren is gratis tijdens de eerste ${V.CONFIG.freeCancelMinutes} minuten, daarna (of niet ophalen) kost het ${euro(V.CONFIG.cancelFee)}.</p>
        </div>
        ${active.length ? active.map(activeResCard).join('') : `
          <div class="card px-4 py-8 text-center">
            <div class="text-3xl">🔖</div>
            <h3 class="mt-1 text-sm font-bold">Geen actieve reservaties</h3>
            <p class="mt-1 text-xs text-muted">Zoek een product en tik op <b>Reserveer</b>, dan ligt het klaar als je aankomt.</p>
            <button onclick="App.setTab('ontdek')" class="btn-primary mt-3 px-4 py-2 text-xs">Product zoeken</button>
          </div>`}
        ${past.length ? `<div>
          <h3 class="label">Geschiedenis</h3>
          <div class="card divide-y divide-line">
            ${past.map((r) => { const p = V.get.product(r.productId), m = V.get.machine(r.machineId), s = V.RESERVATION_STATUS[r.status];
              return `<div class="flex items-center justify-between gap-2 p-3">
                <div class="min-w-0"><p class="truncate text-xs font-bold">${p?.icon} ${esc(p?.name)}</p><p class="text-[10px] text-muted">${esc(m?.code)} · ${timeAgo(r.createdAt)}</p></div>
                <div class="flex flex-col items-end gap-0.5">${U.badge(s.label, s.color)}${r.fee ? `<span class="text-[10px] font-semibold text-rose-500">kost ${euro(r.fee)}</span>` : ''}</div></div>`; }).join('')}
          </div></div>` : ''}
      </div>`;
  }

  function activeResCard(r) {
    const p = V.get.product(r.productId), m = V.get.machine(r.machineId);
    return `<article class="card overflow-hidden">
      <div class="flex items-start justify-between gap-2 p-3">
        <div class="min-w-0">
          <p class="text-sm font-extrabold">${p.icon} ${esc(p.name)}</p>
          <p class="mt-0.5 text-[11px] text-muted"><i class="fa-solid fa-location-dot mr-1 text-brand-500"></i>Automaat ${esc(m.code)} · vak ${esc(r.slotCode)} · ${esc(V.get.floorName(m.campusId, m.floor))}</p>
          <p class="text-[11px] text-muted">${esc(V.get.campus(m.campusId).short)} · ${esc(m.location)}</p>
        </div>
        <div class="text-right"><p class="text-sm font-extrabold">${euro(r.price)}</p>${r.paid ? U.badge('Betaald', 'emerald') : U.badge('Betaal aan automaat', 'slate')}</div>
      </div>
      <div class="flex items-center justify-between bg-brand-500/10 px-3 py-2.5">
        <div><p class="text-[10px] font-bold uppercase tracking-wider text-muted">Ophaalcode</p><p class="font-mono text-2xl font-extrabold tracking-[0.3em] text-brand-600 dark:text-brand-400">${r.code}</p></div>
        <div class="text-right"><p class="text-[10px] font-bold uppercase tracking-wider text-muted">Nog</p><p class="font-mono text-lg font-extrabold tabular-nums" data-countdown="${r.expiresAt}">--:--:--</p><p class="text-[10px] text-muted">tot ${clock(r.expiresAt)}</p></div>
      </div>
      <div class="grid grid-cols-[1fr_auto] gap-2 p-3">
        <button onclick="App.openSheet('pickup', { id: '${r.id}' })" class="btn-primary py-2 text-xs"><i class="fa-solid fa-hand-holding"></i> Ophalen aan automaat</button>
        <button onclick="App.openSheet('cancel', { id: '${r.id}' })" class="btn-ghost px-3 py-2 text-xs text-muted">Annuleer${V.derive.isFreeCancel(r) ? ' <span class="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">gratis nog <span data-countdown="' + V.derive.freeCancelUntil(r) + '" data-short>--</span></span>' : ''}</button>
      </div>
    </article>`;
  }

  // =====================================================================
  //  TAB: IDEEËN (productsuggesties)
  // =====================================================================
  function renderIdeas() {
    const u = user();
    const campus = V.get.campus(ui.campusId);
    const list = V.get.state().suggestions.filter((s) => s.campusId === ui.campusId)
      .sort((a, b) => b.votes.length - a.votes.length || b.createdAt - a.createdAt);
    $('#view').innerHTML = `
      <div class="space-y-4 p-3 pb-6">
        <div class="card bg-gradient-to-br from-brand-500/15 to-amber-500/5 p-4">
          <h2 class="text-base font-extrabold"><i class="fa-solid fa-lightbulb mr-1 text-amber-500"></i> Wat mis jij op ${esc(campus.short)}?</h2>
          <p class="mt-1 text-xs text-muted">Stel een product voor of stem op het idee van iemand anders. De vulploeg ziet de populairste ideeën eerst.</p>
          <button onclick="App.openSheet('suggest')" class="btn-primary mt-3 w-full py-2.5 text-xs"><i class="fa-solid fa-plus"></i> Nieuw idee</button>
        </div>
        <div>
          <h3 class="label">${list.length} ideeën voor ${esc(campus.name)}</h3>
          <div class="space-y-2">
            ${list.length ? list.map((s) => { const voted = s.votes.includes(u.id); const st = V.SUGGESTION_STATUS[s.status];
              return `<div class="card flex items-center gap-3 p-3">
                <button onclick="App.vote('${s.id}')" aria-pressed="${voted}" aria-label="Stem op ${esc(s.name)}"
                  class="flex w-12 shrink-0 flex-col items-center rounded-xl border py-1.5 ${voted ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-sub text-ink'}">
                  <i class="fa-solid fa-caret-up text-sm"></i><span class="text-sm font-extrabold leading-none">${s.votes.length}</span></button>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1"><p class="text-sm font-bold">${V.CATEGORIES[s.category]?.icon || ''} ${esc(s.name)}</p>${s.userId === u.id ? U.badge('Jouw idee', 'brand') : ''}</div>
                  ${s.note ? `<p class="text-[11px] text-muted">${esc(s.note)}</p>` : ''}
                  <div class="mt-1 flex items-center gap-1.5">${U.badge(st.label, st.color)}<span class="text-[10px] text-muted">${timeAgo(s.createdAt)}</span></div>
                </div>
              </div>`; }).join('') : '<p class="card p-4 text-center text-xs text-muted">Nog geen ideeën. Wees de eerste!</p>'}
          </div>
        </div>
      </div>`;
  }

  // =====================================================================
  //  TAB: PROFIEL
  // =====================================================================
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; if (ui.tab === 'profiel') renderTab(); });

  function renderProfile() {
    const u = user();
    const st = V.get.state();
    const myReports = st.reports.filter((r) => r.userId === u.id).sort((a, b) => b.createdAt - a.createdAt);
    const resCount = st.reservations.filter((r) => r.userId === u.id).length;
    const ideaCount = st.suggestions.filter((s) => s.votes.includes(u.id)).length;
    const initials = u.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    $('#view').innerHTML = `
      <div class="space-y-4 p-3 pb-6">
        <div class="card flex items-center gap-3 p-4">
          <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-amber-500 text-lg font-extrabold text-white">${esc(initials)}</div>
          <div class="min-w-0">
            <p class="truncate text-base font-extrabold">${esc(u.name)}</p>
            <p class="truncate text-xs text-muted">${esc(u.email)}</p>
            <div class="mt-1">${U.badge(V.ROLES[u.role].label, 'brand')}</div>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center">
          ${[['Reservaties', resCount], ['Meldingen', myReports.length], ['Ideeën', ideaCount]].map(([l, n]) => `<div class="card p-3"><p class="text-xl font-extrabold">${n}</p><p class="text-[10px] font-semibold text-muted">${l}</p></div>`).join('')}
        </div>

        <div>
          <h3 class="label"><i class="fa-solid fa-star text-amber-400"></i> Mijn favorieten</h3>
          <div class="card p-3">
            ${(u.favorites || []).length ? `<div class="flex flex-wrap gap-1.5">${u.favorites.map((id) => V.get.product(id)).filter(Boolean).map((p) => `
              <span class="chip pr-1.5">${p.icon} ${esc(p.name)}<button onclick="App.toggleFav('${p.id}')" aria-label="Verwijder ${esc(p.name)} uit favorieten" class="ml-1 text-muted hover:text-rose-500"><i class="fa-solid fa-xmark"></i></button></span>`).join('')}</div>`
            : '<p class="text-xs text-muted">Nog geen favorieten.</p>'}
            <p class="mt-2 text-[11px] text-muted">Voeg toe met <i class="fa-regular fa-star"></i> in de inhoud van een automaat. Je favorieten staan bovenaan bij Ontdek, met hoeveel er nog beschikbaar zijn.</p>
          </div>
        </div>
        <div>
          <h3 class="label">Mijn storingsmeldingen</h3>
          <div class="card divide-y divide-line">
            ${myReports.length ? myReports.slice(0, 10).map((r) => { const m = V.get.machine(r.machineId), s = V.REPORT_STATUS[r.status];
              return `<div class="flex items-center justify-between gap-2 p-3"><div class="min-w-0"><p class="truncate text-xs font-bold">${V.ISSUE_TYPES[r.issue].icon} ${esc(m.code)} · ${esc(V.ISSUE_TYPES[r.issue].label)}</p><p class="text-[10px] text-muted">${timeAgo(r.createdAt)}</p></div>${U.badge(s.label, s.color)}</div>`; }).join('')
              : '<p class="p-3 text-xs text-muted">Je hebt nog niets gemeld.</p>'}
          </div>
        </div>

        <div>
          <h3 class="label">Instellingen</h3>
          <div class="card divide-y divide-line text-sm">
            <button onclick="App.openSheet('location')" class="flex w-full items-center justify-between p-3 text-left"><span><i class="fa-solid fa-location-crosshairs mr-2 w-4 text-blue-500"></i>Mijn locatie op de campus</span><i class="fa-solid fa-chevron-right text-xs text-muted"></i></button>
            <button onclick="App.toggleTheme()" class="flex w-full items-center justify-between p-3 text-left"><span><i class="fa-solid fa-circle-half-stroke mr-2 w-4 text-amber-500"></i>Licht / donker thema</span><i class="fa-solid fa-chevron-right text-xs text-muted"></i></button>
            ${standalone ? '' : installPrompt
              ? `<button onclick="App.install()" class="flex w-full items-center justify-between p-3 text-left"><span><i class="fa-solid fa-mobile-screen mr-2 w-4 text-brand-500"></i>Installeer als app</span><i class="fa-solid fa-download text-xs text-brand-500"></i></button>`
              : `<div class="p-3"><p><i class="fa-solid fa-mobile-screen mr-2 w-4 text-brand-500"></i>Installeer als app</p><p class="mt-1 pl-6 text-[11px] text-muted">${isIOS ? 'Tik in Safari op <i class="fa-solid fa-arrow-up-from-bracket"></i> Deel → <b>Zet op beginscherm</b>.' : 'Open het browsermenu (⋮) → <b>App installeren</b> of <b>Toevoegen aan startscherm</b>.'}</p></div>`}
            <a href="../dashboard/" class="flex w-full items-center justify-between p-3"><span><i class="fa-solid fa-gauge mr-2 w-4 text-sky-500"></i>Dashboard vulploeg (demo)</span><i class="fa-solid fa-arrow-up-right-from-square text-xs text-muted"></i></a>
            <button onclick="App.resetDemo()" class="flex w-full items-center justify-between p-3 text-left text-muted"><span><i class="fa-solid fa-rotate-left mr-2 w-4"></i>Demo-data resetten</span></button>
          </div>
        </div>
        <button onclick="App.logout()" class="btn-ghost w-full py-2.5 text-xs text-rose-500"><i class="fa-solid fa-right-from-bracket"></i> Uitloggen</button>
        <p class="text-center text-[10px] text-muted">Vendo MVP · Team Error 707 · KdG · demodata</p>
      </div>`;
  }

  // =====================================================================
  //  SHEETS (onderste panelen)
  // =====================================================================
  function sheetFrame(inner, opts = {}) {
    return `<div class="fade-in absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm" data-backdrop>
      <div class="sheet-up max-h-[92%] overflow-y-auto rounded-t-[28px] border-t border-line bg-card p-4 pt-3 shadow-2xl" role="dialog" aria-modal="true" aria-label="${esc(opts.label || '')}">
        <div class="mx-auto mb-3 h-1 w-12 rounded-full bg-line"></div>
        ${inner}
      </div></div>`;
  }
  const sheetHeader = (title, sub) => `
    <div class="mb-3 flex items-start justify-between gap-3">
      <div class="min-w-0"><h2 class="text-base font-extrabold">${title}</h2>${sub ? `<p class="text-xs text-muted">${sub}</p>` : ''}</div>
      <button onclick="App.closeSheet()" aria-label="Sluiten" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sub text-muted hover:text-ink"><i class="fa-solid fa-xmark"></i></button>
    </div>`;

  function renderSheet() {
    const el = $('#sheetRoot');
    if (!el) return;
    const s = ui.sheet;
    if (!s) { el.innerHTML = ''; return; }
    const fn = SHEETS[s.kind];
    el.innerHTML = sheetFrame(fn(s), { label: s.kind });
    const bd = el.querySelector('[data-backdrop]');
    bd.addEventListener('click', (e) => { if (e.target === bd) closeSheet(); });
    if (s.after) s.after();
    s.after = null;
    const af = el.querySelector('[autofocus]'); if (af) setTimeout(() => af.focus(), 50);
  }

  const SHEETS = {
    machine(s) {
      const m = V.get.machine(s.id);
      const st = V.derive.machineState(m, 'app');
      const t = V.MACHINE_TYPES[m.type];
      const campus = V.get.campus(m.campusId);
      const open = V.get.openReports(m.id);
      const q = ui.query.trim();
      let items = m.slots.map((sl) => ({ sl, p: V.get.product(sl.productId), a: V.derive.available(m, sl), r: V.derive.reservedCount(m.id, sl.code) }));
      const dist = V.derive.distanceLabel(me(), m);
      return `
        <div class="mb-2 flex flex-wrap gap-1">${U.badge(`${st.dot} ${st.label}`, st.color)}${U.badge(`${t.icon} ${t.label}`, 'slate')}</div>
        ${sheetHeader(`Automaat ${esc(m.code)}`, `${esc(campus.name)} · ${esc(V.get.floorName(m.campusId, m.floor))} · ${esc(m.location)}`)}
        ${dist ? `<p class="-mt-2 mb-3 text-[11px] font-semibold text-blue-600 dark:text-blue-400"><i class="fa-solid fa-person-walking mr-1"></i>${dist}</p>` : ''}
        ${st.key === 'defect' ? `<div class="mb-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400"><i class="fa-solid fa-ban mr-1"></i> Deze automaat is defect. De vulploeg is op de hoogte. Reserveren kan niet.</div>` : ''}
        ${st.key !== 'defect' && open.length ? `<div class="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400"><p class="font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Storing gemeld door andere gebruikers</p><p class="mt-0.5">${open.map((r) => esc(V.ISSUE_TYPES[r.issue].label)).join(' · ')}</p></div>` : ''}
        <p class="mb-3 text-[11px] text-muted"><i class="fa-solid fa-truck-ramp-box mr-1"></i>Laatst bijgevuld ${timeAgo(m.lastRefill)} · voorraad wordt live bijgewerkt</p>
        <div class="mb-2 flex items-center justify-between"><h3 class="text-xs font-bold uppercase tracking-wider">Inhoud & prijzen</h3><span class="text-[10px] text-muted">${items.length} producten</span></div>
        <div class="grid grid-cols-2 gap-2">
          ${items.length ? items.map(({ sl, p, a, r }) => {
            const hit = q && V.derive.matchProduct(p, q, []);
            return `<div class="flex flex-col justify-between rounded-xl border ${hit ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-line'} bg-sub p-2.5">
              <div>
                <div class="flex items-center justify-between"><span class="text-lg">${p.icon}</span>
                  <span class="flex items-center gap-1.5"><span class="text-xs font-extrabold">${euro(p.price)}</span>
                  <button onclick="App.toggleFav('${p.id}')" aria-pressed="${(user().favorites || []).includes(p.id)}" aria-label="${(user().favorites || []).includes(p.id) ? 'Verwijder uit' : 'Bewaar als'} favoriet" class="p-0.5 text-sm ${(user().favorites || []).includes(p.id) ? 'text-amber-400' : 'text-muted hover:text-amber-400'}"><i class="fa-${(user().favorites || []).includes(p.id) ? 'solid' : 'regular'} fa-star"></i></button></span></div>
                <h4 class="mt-1 text-xs font-bold leading-tight">${esc(p.name)}</h4>
              </div>
              <div class="mt-2 border-t border-line pt-1.5">
                <div class="flex items-center justify-between text-[10px]"><span class="text-muted">Vak ${esc(sl.code)}</span><span class="font-bold ${a > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}">${a > 0 ? `${a} beschikbaar` : 'Uitverkocht'}</span></div>
                ${r ? `<p class="text-right text-[9px] text-muted">${r} gereserveerd</p>` : ''}
                <button ${a > 0 && st.usable ? '' : 'disabled'} onclick="App.openSheet('reserve', { machineId: '${m.id}', slot: '${sl.code}' })" class="btn-primary mt-1.5 w-full py-1.5 text-[11px]"><i class="fa-solid fa-bookmark text-[10px]"></i> Reserveer</button>
              </div>
            </div>`; }).join('') : '<p class="col-span-2 py-4 text-center text-xs text-muted">Geen producten voor dit filter.</p>'}
        </div>
        <div class="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3">
          <button onclick="App.openSheet('report', { machineId: '${m.id}' })" class="btn-ghost py-2.5 text-xs text-amber-600 dark:text-amber-500"><i class="fa-solid fa-triangle-exclamation"></i> Meld storing</button>
          <button onclick="App.openSheet('suggest')" class="btn bg-gradient-to-r from-brand-500 to-amber-500 py-2.5 text-xs text-white"><i class="fa-solid fa-lightbulb"></i> Stel product voor</button>
        </div>`;
    },

    reserve(s) {
      const m = V.get.machine(s.machineId); const sl = m.slots.find((x) => x.code === s.slot); const p = V.get.product(sl.productId);
      const a = V.derive.available(m, sl);
      return `${sheetHeader('Product reserveren', `We leggen het ${V.util.duration(V.CONFIG.reservationMinutes)} voor je opzij.`)}
        <div class="flex items-center gap-3 rounded-2xl border border-line bg-sub p-3">
          <div class="flex h-14 w-14 items-center justify-center rounded-xl bg-card text-3xl">${p.icon}</div>
          <div class="min-w-0 flex-1"><p class="text-sm font-extrabold">${esc(p.name)}</p><p class="text-[11px] text-muted">Automaat ${esc(m.code)} · vak ${esc(sl.code)} · ${esc(V.get.floorName(m.campusId, m.floor))}</p><p class="text-[11px] text-muted">${esc(m.location)}</p></div>
          <p class="text-base font-extrabold">${euro(p.price)}</p>
        </div>
        <p class="mt-2 text-[11px] font-semibold ${a > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}">${a > 0 ? `Nog ${a} beschikbaar` : 'Net uitverkocht'}</p>
        <fieldset class="mt-3 space-y-2">
          <legend class="label">Betalen</legend>
          <label class="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-sub p-3 has-[:checked]:border-brand-500">
            <input type="radio" name="pay" value="machine" checked class="accent-brand-500"><span class="text-xs"><b>Aan de automaat</b><br><span class="text-muted">Tik je code in en betaal met kaart of Payconiq.</span></span></label>
          <label class="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-sub p-3 has-[:checked]:border-brand-500">
            <input type="radio" name="pay" value="now" class="accent-brand-500"><span class="text-xs"><b>Nu online betalen</b> <span class="badge border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400">demo</span><br><span class="text-muted">Code intikken en het product valt meteen. Niet opgehaald? Terugbetaling.</span></span></label>
        </fieldset>
        <p class="mt-3 flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-800 dark:text-amber-300"><i class="fa-solid fa-circle-info mt-0.5"></i><span>Het product wordt voor jou opzijgelegd. Van gedachten veranderd? <b>Annuleren is gratis tijdens de eerste ${V.CONFIG.freeCancelMinutes} minuten.</b> Daarna, of als je het niet ophaalt binnen ${V.util.duration(V.CONFIG.reservationMinutes)}, betaal je ${euro(V.CONFIG.cancelFee)}.</span></p>
        <button ${a > 0 ? '' : 'disabled'} onclick="App.confirmReserve('${m.id}', '${sl.code}')" class="btn-primary mt-4 w-full py-3 text-sm"><i class="fa-solid fa-bookmark"></i> Reserveer voor ${euro(p.price)}</button>
        <button onclick="App.openSheet('machine', { id: '${m.id}' })" class="mt-2 w-full py-2 text-xs font-semibold text-muted">Terug naar automaat</button>`;
    },

    reserved(s) {
      const r = V.get.state().reservations.find((x) => x.id === s.id);
      if (!r) return sheetHeader('Reservatie', '');
      const p = V.get.product(r.productId), m = V.get.machine(r.machineId);
      return `<div class="pop text-center">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">✅</div>
          <h2 class="mt-2 text-lg font-extrabold">Gereserveerd!</h2>
          <p class="text-xs text-muted">${p.icon} ${esc(p.name)} ligt klaar in <b>${esc(m.code)}</b> (${esc(V.get.floorName(m.campusId, m.floor))}, ${esc(m.location)}).</p>
          <div class="mx-auto mt-4 max-w-[260px] rounded-2xl border-2 border-dashed border-brand-500/60 bg-brand-500/10 p-4">
            <p class="text-[10px] font-bold uppercase tracking-wider text-muted">Jouw ophaalcode</p>
            <p class="font-mono text-4xl font-extrabold tracking-[0.3em] text-brand-600 dark:text-brand-400">${r.code}</p>
            <p class="mt-1 text-xs text-muted">Geldig nog <b class="font-mono tabular-nums text-ink" data-countdown="${r.expiresAt}">--:--:--</b> (tot ${clock(r.expiresAt)})</p>
          </div>
          ${r.paid ? `<p class="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400"><i class="fa-solid fa-circle-check"></i> ${euro(r.price)} betaald (demo)</p>` : ''}
          <div class="mt-4 grid grid-cols-2 gap-2">
            <button onclick="App.closeSheet(); App.setTab('reservaties')" class="btn-ghost py-2.5 text-xs">Mijn reservaties</button>
            <button onclick="App.closeSheet()" class="btn-primary py-2.5 text-xs">Oké, ik ga!</button>
          </div></div>`;
    },

    pickup(s) {
      const r = V.get.state().reservations.find((x) => x.id === s.id);
      if (!r || r.status !== 'actief') {
        return `<div class="pop text-center">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">🎉</div>
          <h2 class="mt-2 text-lg font-extrabold">${r && r.status === 'opgehaald' ? 'Smakelijk!' : 'Reservatie niet meer actief'}</h2>
          <p class="text-xs text-muted">${r && r.status === 'opgehaald' ? 'Het product is uit de automaat. De voorraad is bijgewerkt.' : 'Deze reservatie is verlopen of geannuleerd.'}</p>
          <button onclick="App.closeSheet()" class="btn-primary mt-4 w-full py-2.5 text-xs">Sluiten</button></div>`;
      }
      const p = V.get.product(r.productId), m = V.get.machine(r.machineId);
      return `${sheetHeader('Ophalen aan de automaat', 'Simulatie van het toetsenbord op de automaat')}
        <div class="rounded-2xl border-4 border-slate-700 bg-slate-900 p-4 text-white">
          <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400"><span>${esc(m.code)}</span><span>Vak ${esc(r.slotCode)}</span></div>
          <p class="mt-1 text-sm font-bold">${p.icon} ${esc(p.name)}</p>
          <form id="pickupForm" class="mt-3">
            <label for="pickupCode" class="text-[10px] text-slate-400">Geef je 4-cijferige code in</label>
            <input id="pickupCode" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="one-time-code" autofocus
              class="mt-1 w-full rounded-xl border border-slate-600 bg-black/40 p-3 text-center font-mono text-3xl font-extrabold tracking-[0.5em] text-brand-400 focus:border-brand-500 focus:outline-none" placeholder="····">
            <p id="pickupError" class="mt-1 hidden text-xs font-semibold text-rose-400"></p>
            <button class="btn-primary mt-3 w-full py-3 text-sm" type="submit"><i class="fa-solid fa-unlock"></i> ${r.paid ? 'Ontgrendel' : `Betaal ${euro(r.price)} & ontgrendel`}</button>
          </form>
        </div>
        <p class="mt-2 text-center text-[11px] text-muted">Jouw code: <b class="font-mono text-ink">${r.code}</b></p>`;
    },

    cancel(s) {
      const r = V.get.state().reservations.find((x) => x.id === s.id);
      if (!r || r.status !== 'actief') return `${sheetHeader('Reservatie annuleren', '')}<p class="text-sm text-muted">Deze reservatie is niet meer actief.</p>`;
      const p = V.get.product(r.productId), m = V.get.machine(r.machineId);
      const free = V.derive.isFreeCancel(r);
      const fee = free ? 0 : V.CONFIG.cancelFee;
      return `${sheetHeader('Reservatie annuleren?', `${p.icon} ${esc(p.name)} in ${esc(m.code)}`)}
        <div class="space-y-2 rounded-2xl border border-line bg-sub p-3 text-sm">
          ${free ? `<p class="flex items-start gap-2 font-semibold text-emerald-600 dark:text-emerald-400"><i class="fa-solid fa-circle-check mt-1"></i><span>Gratis: je reservatie is jonger dan ${V.CONFIG.freeCancelMinutes} minuten. Nog <span class="tabular-nums" data-countdown="${V.derive.freeCancelUntil(r)}" data-short>--</span> om gratis te annuleren.</span></p>` : ''}
          <div class="flex justify-between"><span class="text-muted">Annulatiekost${free ? '' : ' (product lag opzij)'}</span><b>${euro(fee)}</b></div>
          ${r.paid ? `<div class="flex justify-between"><span class="text-muted">Al betaald</span><span>${euro(r.price)}</span></div>
          <div class="flex justify-between border-t border-line pt-2"><span class="font-semibold">Je krijgt terug</span><b class="text-emerald-600 dark:text-emerald-400">${euro(r.price - fee)}</b></div>`
          : (fee ? `<p class="text-[11px] text-muted">De ${euro(fee)} wordt aangerekend op je KdG-account (demo).</p>` : '')}
        </div>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <button onclick="App.closeSheet()" class="btn-ghost py-2.5 text-xs">Toch houden</button>
          <button onclick="App.cancelReservation('${r.id}')" class="btn-danger py-2.5 text-xs">${fee ? `Annuleer voor ${euro(fee)}` : 'Gratis annuleren'}</button>
        </div>`;
    },

    report(s) {
      const m = V.get.machine(s.machineId);
      return `${sheetHeader('<i class="fa-solid fa-triangle-exclamation mr-1 text-amber-500"></i> Meld een storing', `Automaat ${esc(m.code)} · ${esc(m.location)}`)}
        <form id="reportForm" class="space-y-3">
          <fieldset class="space-y-1.5"><legend class="label">Wat is het probleem?</legend>
            ${Object.entries(V.ISSUE_TYPES).map(([k, v], i) => `
              <label class="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-sub p-2.5 has-[:checked]:border-brand-500">
                <input type="radio" name="issue" value="${k}" ${i === 0 ? 'checked' : ''} class="accent-brand-500"><span class="text-xs">${v.icon} ${esc(v.label)}</span></label>`).join('')}
          </fieldset>
          <div><label class="label" for="reportNote">Toelichting (optioneel)</label>
            <textarea id="reportNote" maxlength="500" class="field h-20 resize-none text-xs" placeholder="Bv. blikje bleef hangen in vak A1…"></textarea></div>
          <button class="btn-danger w-full py-3 text-sm" type="submit"><i class="fa-solid fa-paper-plane"></i> Verstuur melding</button>
          <p class="text-center text-[10px] text-muted">De vulploeg ziet je melding meteen. Je krijgt bericht als het opgelost is.</p>
        </form>`;
    },

    suggest(s) {
      return `${sheetHeader('<i class="fa-solid fa-lightbulb mr-1 text-amber-500"></i> Stel een product voor', `Wat mis jij in de automaten van ${esc(V.get.campus(ui.campusId).name)}?`)}
        <form id="suggestForm" class="space-y-3">
          <div><label class="label" for="sugName">Productnaam</label>
            <input id="sugName" required maxlength="60" class="field text-sm" value="${esc(s.name || '')}" placeholder="Bv. Kombucha, Nimm2, proteïnereep…" autofocus></div>
          <div><label class="label" for="sugCat">Categorie</label>
            <select id="sugCat" class="field text-sm">${Object.entries(V.CATEGORIES).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select></div>
          <div><label class="label" for="sugNote">Waarom? (optioneel)</label>
            <input id="sugNote" maxlength="200" class="field text-sm" placeholder="Bv. gezonder alternatief"></div>
          <button class="btn-primary w-full py-3 text-sm" type="submit"><i class="fa-solid fa-paper-plane"></i> Verstuur idee</button>
          <p class="text-center text-[10px] text-muted">Bestaat het idee al? Dan tellen we jouw stem erbij.</p>
        </form>`;
    },

    notifications() {
      const u = user();
      const list = V.get.state().notifications.filter((n) => n.userId === u.id).slice(0, 30);
      return `${sheetHeader('Meldingen', 'Updates over je reservaties, meldingen en ideeën')}
        <div class="space-y-2">${list.length ? list.map((n) => `
          <div class="flex gap-3 rounded-xl border ${n.read ? 'border-line bg-sub/50' : 'border-brand-500/40 bg-brand-500/10'} p-3">
            <span class="text-lg">${n.icon}</span>
            <div class="min-w-0"><p class="text-xs ${n.read ? '' : 'font-semibold'}">${esc(n.text)}</p><p class="mt-0.5 text-[10px] text-muted">${timeAgo(n.createdAt)}</p></div>
          </div>`).join('') : '<p class="py-6 text-center text-xs text-muted">Nog geen meldingen.</p>'}</div>`;
    },

    location(s) {
      const campus = V.get.campus(ui.campusId);
      const pos = me();
      const fl = s.floor ?? pos.floor;
      return `${sheetHeader('<i class="fa-solid fa-location-crosshairs mr-1 text-blue-500"></i> Waar ben je?', 'Zo tonen we de dichtstbijzijnde automaten eerst.')}
        <p class="label">Verdiep op ${esc(campus.name)}</p>
        <div class="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
          ${campus.floors.map((f) => `<button onclick="App.locFloor(${f.id})" class="chip ${fl === f.id ? 'chip-active' : ''}">${esc(f.name)}</button>`).join('')}
        </div>
        <div id="locPlan"></div>
        <p class="mt-2 text-center text-[11px] text-muted"><i class="fa-solid fa-hand-pointer mr-1"></i>Tik op de plattegrond waar je nu staat</p>
        <button onclick="App.closeSheet()" class="btn-primary mt-3 w-full py-2.5 text-xs">Klaar</button>`;
    },
  };

  // na het tekenen van bepaalde sheets: formulieren koppelen
  function wireSheet() {
    const s = ui.sheet; if (!s) return;
    if (s.kind === 'report') {
      $('#reportForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const issue = new FormData(e.target).get('issue');
        const res = V.actions.reportIssue(user().id, s.machineId, issue, $('#reportNote').value);
        if (!res.ok) return U.toast(res.error, 'error');
        closeSheet(); U.toast('Bedankt! Je melding is doorgestuurd naar de vulploeg.');
      });
    }
    if (s.kind === 'suggest') {
      $('#suggestForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const res = V.actions.addSuggestion(user().id, ui.campusId, $('#sugName').value, $('#sugCat').value, $('#sugNote').value);
        if (!res.ok) return U.toast(res.error, 'error');
        closeSheet();
        U.toast(res.merged ? `"${res.suggestion.name}" bestond al, je stem is toegevoegd!` : 'Bedankt voor je idee!');
        if (ui.tab === 'ideeen') renderTab();
      });
    }
    if (s.kind === 'pickup' && $('#pickupForm')) {
      $('#pickupForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const res = V.actions.pickupReservation(s.id, $('#pickupCode').value);
        if (!res.ok) { const er = $('#pickupError'); er.textContent = res.error; er.classList.remove('hidden'); return; }
        renderSheet(); wireSheet();
      });
    }
    if (s.kind === 'location') {
      const pos = me();
      const fl = s.floor ?? pos.floor;
      U.renderFloorplan($('#locPlan'), {
        audience: 'app', campusId: ui.campusId, floor: fl, machines: V.get.machinesOfCampus(ui.campusId).filter((m) => m.floor === fl),
        me: pos.floor === fl ? pos : null, showLegend: false,
        onPin: () => {}, onBackground: (x, y) => { setMe(fl, x, y); ui.mapFloor = fl; renderSheet(); wireSheet(); renderTab(); },
      });
    }
    tickCountdowns();
  }

  function openSheet(kind, props = {}) {
    if (kind === 'machine' && (!ui.sheet || ui.sheet.kind !== 'machine' || ui.sheet.id !== props.id)) ui.sheetTag = 'all';
    ui.sheet = { kind, ...props };
    renderSheet(); wireSheet();
    if (kind === 'notifications') V.actions.markNotificationsRead(user().id);
  }
  function closeSheet() { ui.sheet = null; renderSheet(); }

  // Live-update van sheets die enkel data tonen (geen formulier)
  const LIVE_SHEETS = ['machine', 'reserved', 'notifications'];

  // =====================================================================
  //  RENDER-LUS
  // =====================================================================
  function renderTab() {
    if (ui.tab === 'ontdek') { if (!$('#discoverBody')) renderDiscoverFrame(); else renderDiscoverBody(); }
    if (ui.tab === 'reservaties') renderReservations();
    if (ui.tab === 'ideeen') renderIdeas();
    if (ui.tab === 'profiel') renderProfile();
    updateChrome();
    tickCountdowns();
  }

  let shellFor = null;
  function render() {
    const u = user();
    if (!u) { shellFor = null; ui.sheet = null; renderLogin(); return; }
    if (shellFor !== u.id || !$('#view')) { shellFor = u.id; renderShell(); }
    renderTab();
  }

  function onStoreChange() {
    const u = user();
    if (!u || shellFor !== u.id) { render(); return; }
    renderTab();
    if (ui.sheet && LIVE_SHEETS.includes(ui.sheet.kind)) {
      const sc = document.querySelector('[role="dialog"]'); const top = sc ? sc.scrollTop : 0;
      renderSheet(); wireSheet();
      const sc2 = document.querySelector('[role="dialog"]'); if (sc2) { sc2.classList.remove('sheet-up'); sc2.parentElement.classList.remove('fade-in'); sc2.scrollTop = top; }
    }
  }

  // Afteltimers voor reservaties
  function tickCountdowns() {
    let expired = false;
    document.querySelectorAll('[data-countdown]').forEach((el) => {
      const left = Math.max(0, Number(el.dataset.countdown) - Date.now());
      if (left === 0) expired = true;
      const hh = Math.floor(left / 3600000), mm = Math.floor((left % 3600000) / 60000), ss = Math.floor((left % 60000) / 1000);
      if (el.hasAttribute('data-short')) {
        el.textContent = `${Math.floor(left / 60000)}:${String(ss).padStart(2, '0')}`;
        if (left === 0 && !el.dataset.done) { el.dataset.done = '1'; setTimeout(() => { renderTab(); if (ui.sheet && ui.sheet.kind === 'cancel') { renderSheet(); } }, 0); }
        return;
      }
      el.textContent = [hh, mm, ss].map((n) => String(n).padStart(2, '0')).join(':');
      el.classList.toggle('text-rose-500', left < 15 * 60000);
    });
    if (expired) V.tick();
  }
  setInterval(tickCountdowns, 1000);

  // =====================================================================
  //  PUBLIEKE ACTIES (vanuit onclick)
  // =====================================================================
  window.App = {
    demoLogin(email) { const r = V.auth.login('app', email, 'demo'); if (!r.ok) U.toast(r.error, 'error'); else U.toast(`Welkom ${r.user.name.split(' ')[0]}!`); },
    logout() { V.auth.logout('app'); },
    setTab(t) { ui.tab = t; ui.sheet = null; renderSheet(); renderTab(); $('#view').scrollTop = 0; },
    setCampus(id) { ui.campusId = id; ui.mapFloor = null; ui.floor = 'all'; ui.selectedPin = null; writePref(PREF.campus, id); renderTab(); U.toast(V.get.campus(id).name, 'info'); },
    setQuery(q) { ui.query = q; ui.selectedPin = null; const i = $('#searchInput'); if (i) i.value = q; renderDiscoverBody(); },
    clearSearch() { ui.query = ''; ui.tags = []; ui.selectedPin = null; const i = $('#searchInput'); if (i) i.value = ''; renderDiscoverBody(); },
    setType(t) { ui.type = t; ui.selectedPin = null; renderDiscoverBody(); },
    toggleWorking() { ui.onlyWorking = !ui.onlyWorking; renderDiscoverBody(); },
    toggleUnavailable() { ui.showUnavailable = !ui.showUnavailable; renderDiscoverBody(); },
    setView(v) { ui.view = v; writePref(PREF.view, v); renderDiscoverBody(); },
    showOnMap(id) {
      const m = V.get.machine(id);
      ui.view = 'map'; ui.mapFloor = m.floor; ui.selectedPin = id; writePref(PREF.view, 'map');
      ui.sheet = null; renderSheet();
      renderDiscoverBody();
      const v = $('#view'); if (v) v.scrollTop = 0;
    },
    setMapFloor(f) { ui.mapFloor = f; ui.selectedPin = null; renderDiscoverBody(); },
    openSheet, closeSheet,
    locFloor(f) { ui.sheet.floor = f; renderSheet(); wireSheet(); },
    confirmReserve(machineId, slot) {
      const pay = (document.querySelector('input[name="pay"]:checked') || {}).value;
      const res = V.actions.reserve(user().id, machineId, slot, { payNow: pay === 'now' });
      if (!res.ok) return U.toast(res.error, 'error');
      openSheet('reserved', { id: res.reservation.id });
    },
    cancelReservation(id) {
      const res = V.actions.cancelReservation(id, user().id);
      closeSheet();
      if (!res.ok) return U.toast(res.error, 'error');
      if (!res.fee) U.toast(res.paid ? `Gratis geannuleerd, ${euro(res.refund)} terugbetaald` : 'Gratis geannuleerd');
      else U.toast(res.paid ? `Geannuleerd: ${euro(res.refund)} terugbetaald (${euro(res.fee)} kost)` : `Geannuleerd: ${euro(res.fee)} annulatiekost`);
    },
    toggleFav(pid) {
      const r = V.actions.toggleFavorite(user().id, pid);
      if (r.ok) U.toast(r.favorite ? 'Toegevoegd aan favorieten' : 'Verwijderd uit favorieten', 'info');
    },
    vote(id) { const r = V.actions.toggleVote(id, user().id); if (r.ok) U.toast(r.voted ? 'Gestemd!' : 'Stem ingetrokken', 'info'); },
    toggleTheme() { U.toggleTheme(PREF.theme); updateThemeIcon(); },
    async install() { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; renderTab(); },
    resetDemo() {
      // dubbel tikken ter bevestiging (confirm() werkt niet overal, bv. in ingesloten previews)
      if (!this._resetArmed) { this._resetArmed = true; setTimeout(() => { this._resetArmed = false; }, 3000); return U.toast('Tik nog eens om alle demodata te resetten', 'info'); }
      this._resetArmed = false; V.actions.resetDemo(); U.toast('Demodata hersteld');
    },
  };

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.sheet) closeSheet(); });

  V.subscribe(onStoreChange);
  render();

  // ---------- PWA: service worker ----------
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* bv. in een preview zonder SW-ondersteuning */ });
  }
})();
