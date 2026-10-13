/* =====================================================================
 * Vendo Beheer — dashboard voor de vulploeg / externe firma
 * Pagina's: Overzicht · Automaten · Bijvullijst · Meldingen · Reservaties
 *           · Ideeën · Producten · Kaart
 * ===================================================================== */
(function () {
  'use strict';
  const V = window.Vendo, U = window.VendoUI;
  const { esc, euro, timeAgo, dateTime, clock } = V.util;
  const $ = (sel, root = document) => root.querySelector(sel);
  const root = $('#dash');
  const THEME_KEY = 'vendo.theme';
  U.initTheme(THEME_KEY);

  const ui = {
    page: (location.hash || '#overzicht').slice(1),
    campus: 'all',
    machineStatus: 'all',
    machineSearch: '',
    reportTab: 'open',
    resFilter: 'actief',
    drawer: null,      // machineId
    mapCampus: V.get.state().campuses[0].id,
    mapFloor: 0,
    loginError: '',
    navOpen: false,
    productPrefill: '',
    refillAll: false,
    mapMode: 'view',   // 'view' | 'move' | 'add'
    draft: null,       // {x, y} voor een nieuwe automaat
  };

  const PAGES = [
    { id: 'overzicht',   label: 'Overzicht',   icon: 'fa-chart-pie' },
    { id: 'automaten',   label: 'Automaten',   icon: 'fa-cubes-stacked' },
    { id: 'bijvullen',   label: 'Bijvullijst', icon: 'fa-dolly' },
    { id: 'meldingen',   label: 'Meldingen',   icon: 'fa-triangle-exclamation' },
    { id: 'reservaties', label: 'Reservaties', icon: 'fa-ticket' },
    { id: 'ideeen',      label: 'Productideeën', icon: 'fa-lightbulb' },
    { id: 'producten',   label: 'Producten',   icon: 'fa-tags' },
    { id: 'kaart',       label: 'Kaart',       icon: 'fa-map-location-dot' },
  ];
  if (!PAGES.some((p) => p.id === ui.page)) ui.page = 'overzicht';

  const user = () => V.auth.currentUser('dashboard');
  const S = () => V.get.state();
  const machines = () => V.get.machinesOfCampus(ui.campus);
  const inCampus = (machineId) => ui.campus === 'all' || V.get.machine(machineId)?.campusId === ui.campus;
  const campusShort = (id) => V.get.campus(id)?.short || id;

  function needsRefill(m) { return m.slots.reduce((a, s) => a + (s.capacity - s.qty), 0); }
  /** Dringend = vulgraad onder de drempel, of een vak leeg / bijna op */
  function urgent(m) { return m.status !== 'defect' && (V.derive.fillPercent(m) < V.CONFIG.lowFillPercent || V.derive.emptySlots(m) > 0 || V.derive.lowSlots(m) > 0); }
  const unit = (pid) => (V.get.product(pid)?.category === 'koffie' ? 'porties' : 'st.');

  // =====================================================================
  //  LOGIN
  // =====================================================================
  function renderLogin() {
    root.innerHTML = `
      <div class="flex min-h-screen items-center justify-center p-4">
        <div class="card w-full max-w-sm p-6 shadow-2xl">
          <div class="flex items-center gap-3">${U.logo('w-11 h-11')}<div><h1 class="text-xl font-extrabold">Vendo <span class="text-brand-500">Beheer</span></h1><p class="text-xs text-muted">Dashboard voor de vulploeg</p></div></div>
          <form id="loginForm" class="mt-6 space-y-3" novalidate>
            <div><label class="label" for="email">E-mail</label><input id="email" type="email" autocomplete="username" class="field" placeholder="naam@vulploeg.be"></div>
            <div><label class="label" for="pw">Wachtwoord</label><input id="pw" type="password" autocomplete="current-password" class="field" placeholder="••••"></div>
            ${ui.loginError ? `<p class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400">${esc(ui.loginError)}</p>` : ''}
            <button class="btn-primary w-full py-2.5 text-sm" type="submit">Inloggen</button>
          </form>
          <button onclick="Dash.demoLogin()" class="btn-ghost mt-3 w-full py-2.5 text-xs">🚚 Demo-account vulploeg</button>
          <p class="mt-5 text-center text-[11px] text-muted">Student of personeel? <a href="../app/" class="font-bold text-brand-500 underline">Open de Vendo-app</a></p>
        </div>
      </div>`;
    $('#loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const r = V.auth.login('dashboard', $('#email').value, $('#pw').value);
      ui.loginError = r.ok ? '' : r.error;
      if (!r.ok) renderLogin();
    });
  }

  // =====================================================================
  //  SHELL
  // =====================================================================
  function counts() {
    const st = S();
    return {
      meldingen: st.reports.filter((r) => r.status !== 'opgelost' && inCampus(r.machineId)).length,
      reservaties: st.reservations.filter((r) => r.status === 'actief' && inCampus(r.machineId)).length,
      ideeen: st.suggestions.filter((s) => s.status === 'nieuw' && (ui.campus === 'all' || s.campusId === ui.campus)).length,
      bijvullen: machines().filter(urgent).length,
    };
  }

  function renderShell() {
    const u = user();
    const c = counts();
    const page = PAGES.find((p) => p.id === ui.page);
    root.innerHTML = `
      <div class="lg:flex">
        <aside class="no-print border-b border-line bg-card lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-60 lg:flex-col lg:border-b-0 lg:border-r">
          <div class="flex items-center justify-between gap-2 p-4">
            <div class="flex items-center gap-2.5">${U.logo()}<div><p class="text-base font-extrabold leading-none">Vendo <span class="text-brand-500">Beheer</span></p><p class="mt-0.5 text-[10px] text-muted">KdG automaten</p></div></div>
            <button class="btn-ghost h-9 w-9 lg:hidden" onclick="Dash.toggleNav()" aria-label="Menu" aria-expanded="${ui.navOpen}"><i class="fa-solid fa-bars"></i></button>
          </div>
          <nav class="${ui.navOpen ? '' : 'hidden'} space-y-0.5 px-3 pb-3 lg:block lg:flex-1 lg:overflow-y-auto" aria-label="Hoofdmenu">
            ${PAGES.map((p) => { const n = c[p.id]; const active = p.id === ui.page;
              return `<a href="#${p.id}" class="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold ${active ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' : 'text-muted hover:bg-sub hover:text-ink'}" ${active ? 'aria-current="page"' : ''}>
                <span><i class="fa-solid ${p.icon} mr-2 w-4 text-center"></i>${p.label}</span>
                ${n ? `<span class="rounded-full ${active ? 'bg-white/25' : 'bg-brand-500/15 text-brand-600 dark:text-brand-400'} px-2 text-[10px] font-bold">${n}</span>` : ''}</a>`; }).join('')}
          </nav>
          <div class="${ui.navOpen ? '' : 'hidden'} space-y-2 border-t border-line p-3 lg:block">
            <p class="label">Demo-tools</p>
            <button onclick="Dash.simulate()" class="btn-ghost w-full py-2 text-xs"><i class="fa-solid fa-cart-shopping"></i> Simuleer 5 verkopen</button>
            <a href="../app/" target="_blank" rel="noopener" class="btn-ghost w-full py-2 text-xs"><i class="fa-solid fa-mobile-screen"></i> Open studenten-app</a>
            <button onclick="Dash.reset()" class="w-full py-1 text-[11px] font-semibold text-muted hover:text-rose-500"><i class="fa-solid fa-rotate-left"></i> Demo-data resetten</button>
          </div>
        </aside>

        <div class="min-w-0 flex-1 lg:pl-60">
          <header class="no-print sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:px-8">
            <div>
              <h1 class="text-lg font-extrabold">${page.label}</h1>
              <p class="flex items-center gap-1.5 text-[11px] text-muted"><span class="relative flex h-2 w-2"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span></span>Live gekoppeld met de app · ${clock(Date.now())}</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              ${S().campuses.length === 1 ? `<span class="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-xs font-semibold"><i class="fa-solid fa-building text-brand-500"></i>${esc(S().campuses[0].name)}</span>` : `
              <label class="sr-only" for="campusFilter">Campus</label>
              <select id="campusFilter" onchange="Dash.setCampus(this.value)" class="field w-auto py-2 text-xs font-semibold">
                <option value="all">Alle campussen</option>
                ${S().campuses.map((cp) => `<option value="${cp.id}" ${ui.campus === cp.id ? 'selected' : ''}>${esc(cp.name)}</option>`).join('')}
              </select>`}
              <button onclick="Dash.toggleTheme()" class="btn-ghost h-9 w-9" aria-label="Wissel thema"><i class="fa-solid fa-circle-half-stroke text-amber-500"></i></button>
              <div class="hidden items-center gap-2 rounded-xl border border-line bg-card py-1 pl-1 pr-2 sm:flex">
                <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-amber-500 text-[11px] font-extrabold text-white">${esc(u.name.split(' ').map((w) => w[0]).join('').slice(0, 2))}</div>
                <div class="leading-tight"><p class="text-xs font-bold">${esc(u.name)}</p><p class="text-[10px] text-muted">${V.ROLES[u.role].label}</p></div>
              </div>
              <button onclick="Dash.logout()" class="btn-ghost h-9 w-9" aria-label="Uitloggen"><i class="fa-solid fa-right-from-bracket"></i></button>
            </div>
          </header>
          <main id="page" class="p-4 lg:p-8"></main>
        </div>
      </div>`;
  }

  // =====================================================================
  //  PAGINA: OVERZICHT
  // =====================================================================
  function kpi(label, value, sub, icon, color, page) {
    return `<a href="#${page}" class="card block p-4 transition-colors hover:border-brand-500/50">
      <div class="flex items-start justify-between gap-2"><p class="min-w-0 text-[11px] font-bold uppercase leading-tight tracking-wider text-muted">${label}</p><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${U.tone(color).badge} border">${icon}</span></div>
      <p class="mt-2 text-3xl font-extrabold tabular-nums">${value}</p><p class="text-[11px] text-muted">${sub}</p></a>`;
  }

  function pageOverview() {
    const st = S();
    const ms = machines();
    const states = ms.map((m) => ({ m, s: V.derive.machineState(m) }));
    const working = states.filter((x) => x.s.key !== 'defect').length;
    const defect = states.filter((x) => x.s.key === 'defect');
    const low = states.filter((x) => urgent(x.m));
    const c = counts();
    const avgFill = ms.length ? Math.round(ms.reduce((a, m) => a + V.derive.fillPercent(m), 0) / ms.length) : 0;

    // Actie nodig: defect > gemelde storing > leeg
    const actions = [];
    defect.forEach(({ m, s }) => actions.push({ m, prio: 0, icon: '🔴', title: `${m.code} is defect`, text: `${s.open} open melding(en) · ${m.location}`, btn: 'Bekijk' }));
    states.filter((x) => x.s.key === 'gemeld').forEach(({ m }) => {
      const r = V.get.openReports(m.id);
      actions.push({ m, prio: 1, icon: '🟠', title: `${m.code}: storing gemeld`, text: r.map((x) => V.ISSUE_TYPES[x.issue].label).join(', '), btn: 'Bekijk' });
    });
    low.forEach(({ m, s }) => actions.push({ m, prio: 2, icon: '📦', title: `${m.code} bijvullen`, text: `${s.fill}% gevuld · ${V.derive.emptySlots(m)} leeg vak(ken) · ${m.location}`, btn: 'Bijvullen' }));
    actions.sort((a, b) => a.prio - b.prio || V.derive.fillPercent(a.m) - V.derive.fillPercent(b.m));

    const fills = [...ms].sort((a, b) => V.derive.fillPercent(a) - V.derive.fillPercent(b));

    $('#page').innerHTML = `
      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        ${kpi('Werkend', `${working}/${ms.length}`, 'automaten bruikbaar', '<i class="fa-solid fa-circle-check"></i>', 'emerald', 'automaten')}
        ${kpi('Defect', defect.length, 'buiten gebruik', '<i class="fa-solid fa-ban"></i>', 'rose', 'automaten')}
        ${kpi('Bij te vullen', low.length, `gem. vulgraad ${avgFill}%`, '<i class="fa-solid fa-dolly"></i>', 'yellow', 'bijvullen')}
        ${kpi('Open meldingen', c.meldingen, 'van gebruikers', '<i class="fa-solid fa-triangle-exclamation"></i>', 'amber', 'meldingen')}
        ${kpi('Reservaties', c.reservaties, `nu actief · ${euro(st.reservations.reduce((t, r) => t + (r.fee || 0), 0))} annulatiekost`, '<i class="fa-solid fa-ticket"></i>', 'sky', 'reservaties')}
        ${kpi('Nieuwe ideeën', c.ideeen, `${st.salesToday || 0} verkopen vandaag`, '<i class="fa-solid fa-lightbulb"></i>', 'brand', 'ideeen')}
      </div>

      <div class="mt-6 grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
        <section class="card p-4 xl:col-span-2">
          <div class="mb-3 flex items-center justify-between"><h2 class="font-extrabold"><i class="fa-solid fa-bolt mr-1.5 text-brand-500"></i>Actie nodig</h2><span class="text-xs text-muted">${actions.length} items</span></div>
          <div class="divide-y divide-line">
            ${actions.length ? actions.slice(0, 10).map((a) => `
              <div class="flex items-center justify-between gap-3 py-2.5">
                <div class="flex min-w-0 items-center gap-3"><span class="text-lg">${a.icon}</span><div class="min-w-0"><p class="text-sm font-bold">${esc(a.title)} <span class="text-xs font-normal text-muted">· ${esc(campusShort(a.m.campusId))}</span></p><p class="truncate text-xs text-muted">${esc(a.text)}</p></div></div>
                <button onclick="Dash.openMachine('${a.m.id}')" class="btn-ghost shrink-0 px-3 py-1.5 text-xs">${a.btn}</button>
              </div>`).join('') : '<p class="py-6 text-center text-sm text-muted">Alles in orde 🎉</p>'}
          </div>
        </section>

        <section class="card p-4">
          <h2 class="mb-3 font-extrabold"><i class="fa-solid fa-clock-rotate-left mr-1.5 text-brand-500"></i>Recente activiteit</h2>
          <ol class="space-y-2.5">
            ${st.activity.slice(0, 9).map((a) => `<li class="flex gap-2.5"><span>${a.icon}</span><div class="min-w-0"><p class="text-xs">${esc(a.text)}</p><p class="text-[10px] text-muted">${timeAgo(a.ts)}</p></div></li>`).join('')}
          </ol>
        </section>
      </div>

      <section class="card mt-6 p-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 class="font-extrabold"><i class="fa-solid fa-battery-half mr-1.5 text-brand-500"></i>Vulgraad per automaat</h2><span class="text-xs text-muted">laagste eerst · rood &lt; 15% · geel &lt; ${V.CONFIG.lowFillPercent}%</span></div>
        <div class="grid gap-x-8 gap-y-2 md:grid-cols-2">
          ${fills.map((m) => { const p = V.derive.fillPercent(m); const s = V.derive.machineState(m);
            return `<button onclick="Dash.openMachine('${m.id}')" class="grid grid-cols-[72px_1fr_44px] items-center gap-3 rounded-lg px-1 py-0.5 text-left hover:bg-sub">
              <span class="text-xs font-bold">${esc(m.code)} ${s.key === 'defect' ? '🔴' : ''}</span>
              <span class="h-2.5 overflow-hidden rounded-full bg-line/60"><span class="block h-full rounded-full ${U.tone(U.fillColor(p)).bar}" style="width:${p}%"></span></span>
              <span class="text-right text-xs font-bold tabular-nums">${p}%</span></button>`; }).join('')}
        </div>
      </section>`;
  }

  // =====================================================================
  //  PAGINA: AUTOMATEN
  // =====================================================================
  function pageMachines() {
    const filters = [['all', 'Alle'], ['ok', 'Werkt'], ['laag', 'Bijna leeg'], ['gemeld', 'Gemeld'], ['defect', 'Defect']];
    const q = V.util.norm(ui.machineSearch);
    let rows = machines().map((m) => ({ m, s: V.derive.machineState(m) }));
    const cnt = (k) => rows.filter((x) => k === 'all' || x.s.key === k).length;
    if (ui.machineStatus !== 'all') rows = rows.filter((x) => x.s.key === ui.machineStatus);
    if (q) rows = rows.filter(({ m }) => V.util.norm(`${m.code} ${m.location} ${campusShort(m.campusId)}`).includes(q));

    $('#page').innerHTML = `
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="no-scrollbar flex gap-1.5 overflow-x-auto">${filters.map(([k, l]) => `<button onclick="Dash.setMachineStatus('${k}')" class="chip ${ui.machineStatus === k ? 'chip-active' : ''}">${l} <span class="opacity-70">${cnt(k)}</span></button>`).join('')}</div>
        <div class="relative w-full sm:w-64"><i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted"></i><input id="machineSearch" value="${esc(ui.machineSearch)}" oninput="Dash.searchMachines(this.value)" class="field py-2 pl-8 text-xs" placeholder="Zoek code of locatie…" aria-label="Zoek automaat"></div>
      </div>
      <div class="card overflow-x-auto">
        <table class="w-full min-w-[820px] text-left text-sm">
          <thead class="border-b border-line text-[10px] uppercase tracking-wider text-muted"><tr>
            <th class="p-3">Automaat</th><th class="p-3">Locatie</th><th class="p-3">Type</th><th class="p-3">Status</th><th class="p-3">Vulgraad</th><th class="p-3 text-center">Lege vakken</th><th class="p-3 text-center">Meldingen</th><th class="p-3">Bijgevuld</th><th class="p-3"></th></tr></thead>
          <tbody class="divide-y divide-line">
            ${rows.length ? rows.map(({ m, s }) => `<tr class="cursor-pointer hover:bg-sub/60" onclick="Dash.openMachine('${m.id}')">
              <td class="p-3 font-extrabold">${esc(m.code)}</td>
              <td class="p-3"><p class="text-xs font-semibold">${esc(campusShort(m.campusId))} · ${esc(V.get.floorName(m.campusId, m.floor))}</p><p class="text-[11px] text-muted">${esc(m.location)}</p></td>
              <td class="p-3 text-xs">${V.MACHINE_TYPES[m.type].icon} ${V.MACHINE_TYPES[m.type].label}</td>
              <td class="p-3">${U.badge(`${s.dot} ${s.label}`, s.color)}</td>
              <td class="p-3">${U.fillBar(s.fill, { width: 'w-20' })}</td>
              <td class="p-3 text-center text-xs font-bold ${V.derive.emptySlots(m) ? 'text-rose-500' : 'text-muted'}">${V.derive.emptySlots(m)}</td>
              <td class="p-3 text-center text-xs font-bold ${s.open ? 'text-amber-500' : 'text-muted'}">${s.open}</td>
              <td class="p-3 text-xs text-muted">${timeAgo(m.lastRefill)}</td>
              <td class="p-3 text-right"><span class="btn-ghost px-3 py-1.5 text-xs">Beheer</span></td></tr>`).join('')
              : '<tr><td colspan="9" class="p-8 text-center text-sm text-muted">Geen automaten voor deze filter.</td></tr>'}
          </tbody>
        </table>
      </div>`;
  }

  // =====================================================================
  //  DRAWER: AUTOMAAT BEHEREN
  // =====================================================================
  function renderDrawer() {
    const el = $('#drawerRoot');
    if (!ui.drawer || !user()) { el.innerHTML = ''; return; }
    const m = V.get.machine(ui.drawer);
    if (!m) { ui.drawer = null; el.innerHTML = ''; return; }
    const s = V.derive.machineState(m);
    const open = V.get.openReports(m.id);
    const activeRes = S().reservations.filter((r) => r.machineId === m.id && r.status === 'actief');
    const products = S().products.filter((p) => p.active);
    const prevScroll = el.querySelector('[data-drawer]')?.scrollTop || 0;
    const isNew = !el.querySelector('[data-drawer]');

    el.innerHTML = `
      <div class="${isNew ? 'fade-in' : ''} fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" data-backdrop></div>
      <aside data-drawer class="${isNew ? 'drawer-in' : ''} fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-line bg-card shadow-2xl" role="dialog" aria-modal="true" aria-label="Automaat ${esc(m.code)} beheren">
        <div class="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-card p-4">
          <div>
            <div class="mb-1 flex flex-wrap gap-1">${U.badge(`${s.dot} ${s.label}`, s.color)}${U.badge(`${V.MACHINE_TYPES[m.type].icon} ${V.MACHINE_TYPES[m.type].label}`, 'slate')}</div>
            <h2 class="text-xl font-extrabold">Automaat ${esc(m.code)}</h2>
            <p class="text-xs text-muted">${esc(V.get.campus(m.campusId).name)} · ${esc(V.get.floorName(m.campusId, m.floor))} · ${esc(m.location)}</p>
          </div>
          <button onclick="Dash.closeMachine()" class="btn-ghost h-9 w-9 shrink-0" aria-label="Sluiten"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="space-y-5 p-4">
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            ${[['Vulgraad', s.fill + '%'], ['Lege vakken', V.derive.emptySlots(m)], ['Reservaties', activeRes.length], ['Bijgevuld', timeAgo(m.lastRefill)]].map(([l, v]) => `<div class="rounded-xl border border-line bg-sub p-2.5"><p class="text-[10px] font-bold uppercase text-muted">${l}</p><p class="text-sm font-extrabold">${v}</p></div>`).join('')}
          </div>

          <details class="rounded-xl border border-line bg-sub/50 p-3" ${m.slots.length ? '' : 'open'}>
            <summary class="cursor-pointer text-xs font-bold"><i class="fa-solid fa-pen mr-1 text-brand-500"></i>Gegevens & plaats</summary>
            <div class="mt-3 grid gap-2 sm:grid-cols-2">
              <div class="sm:col-span-2"><label class="label" for="mLoc">Locatie</label><input id="mLoc" class="field py-1.5 text-xs" maxlength="80" value="${esc(m.location)}"></div>
              <div><label class="label" for="mType">Type</label><select id="mType" class="field py-1.5 text-xs">${Object.entries(V.MACHINE_TYPES).map(([k, v]) => `<option value="${k}" ${k === m.type ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}</select></div>
              <div><label class="label" for="mFloor">Verdiep</label><select id="mFloor" class="field py-1.5 text-xs">${V.get.campus(m.campusId).floors.map((f) => `<option value="${f.id}" ${f.id === m.floor ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></div>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <button onclick="Dash.saveMachineInfo('${m.id}')" class="btn-primary px-3 py-1.5 text-xs">Opslaan</button>
              <button onclick="Dash.showOnMap('${m.id}')" class="btn-ghost px-3 py-1.5 text-xs"><i class="fa-solid fa-map-location-dot"></i> Op kaart</button>
              <button onclick="Dash.removeMachine('${m.id}')" class="btn-ghost ml-auto px-3 py-1.5 text-xs text-rose-500"><i class="fa-solid fa-trash"></i> Verwijderen</button>
            </div>
          </details>

          <div>
            <p class="label">Status van de automaat</p>
            <div class="grid grid-cols-2 gap-2">
              <button onclick="Dash.machineStatus('${m.id}','ok')" class="btn py-2.5 text-xs ${m.status === 'ok' ? 'bg-emerald-500 text-white' : 'border border-line bg-sub text-ink'}"><i class="fa-solid fa-circle-check"></i> Werkt</button>
              <button onclick="Dash.machineStatus('${m.id}','defect')" class="btn py-2.5 text-xs ${m.status === 'defect' ? 'bg-rose-500 text-white' : 'border border-line bg-sub text-ink'}"><i class="fa-solid fa-ban"></i> Defect</button>
            </div>
            <p class="mt-1 text-[11px] text-muted">Op "Defect" zetten verbergt de automaat in de app en annuleert actieve reservaties.</p>
          </div>

          ${open.length ? `<div>
            <p class="label">Open meldingen (${open.length})</p>
            <div class="space-y-2">${open.map(reportCard).join('')}</div></div>` : ''}

          <div>
            <div class="mb-2 flex items-center justify-between"><p class="label mb-0">Vakken & voorraad</p>
              <button onclick="Dash.refillMachine('${m.id}')" class="btn-primary px-3 py-1.5 text-xs"><i class="fa-solid fa-fill-drip"></i> Alles bijvullen</button></div>
            <div class="overflow-x-auto rounded-xl border border-line">
              <table class="w-full min-w-[480px] text-left text-xs">
                <thead class="bg-sub text-[10px] uppercase tracking-wider text-muted"><tr><th class="p-2">Vak</th><th class="p-2">Product</th><th class="p-2 text-center">Voorraad</th><th class="p-2 text-center">Res.</th><th class="p-2"></th></tr></thead>
                <tbody class="divide-y divide-line">
                ${m.slots.map((sl) => { const p = V.get.product(sl.productId); const r = V.derive.reservedCount(m.id, sl.code); const pct = Math.round((sl.qty / sl.capacity) * 100);
                  return `<tr>
                    <td class="p-2 font-mono font-bold">${esc(sl.code)}</td>
                    <td class="p-2"><select aria-label="Product in vak ${esc(sl.code)}" onchange="Dash.slotProduct('${m.id}','${sl.code}',this.value)" class="field w-full py-1.5 text-xs">${products.map((pp) => `<option value="${pp.id}" ${pp.id === sl.productId ? 'selected' : ''}>${pp.icon} ${esc(pp.name)}</option>`).join('')}</select></td>
                    <td class="p-2"><div class="flex items-center justify-center gap-1">
                      <button onclick="Dash.slotQty('${m.id}','${sl.code}',${sl.qty - 1})" class="btn-ghost h-7 w-7 text-xs" aria-label="Eén minder"><i class="fa-solid fa-minus"></i></button>
                      <span class="w-14 text-center font-bold tabular-nums ${sl.qty === 0 ? 'text-rose-500' : pct < 30 ? 'text-yellow-600 dark:text-yellow-300' : ''}">${sl.qty}/${sl.capacity}</span>
                      <button onclick="Dash.slotQty('${m.id}','${sl.code}',${sl.qty + 1})" class="btn-ghost h-7 w-7 text-xs" aria-label="Eén meer"><i class="fa-solid fa-plus"></i></button></div></td>
                    <td class="p-2 text-center font-bold ${r ? 'text-sky-500' : 'text-muted'}">${r}</td>
                    <td class="p-2 text-right"><button ${sl.qty >= sl.capacity ? 'disabled' : ''} onclick="Dash.refillSlot('${m.id}','${sl.code}')" class="btn-ghost px-2 py-1 text-[11px]">Vul</button></td></tr>`; }).join('')}
                </tbody>
              </table>
            </div>
            <form id="addSlotForm" class="mt-2 flex flex-wrap items-end gap-2">
              <div class="min-w-[180px] flex-1"><label class="label" for="newSlotProduct">Nieuw vak</label><select id="newSlotProduct" class="field py-1.5 text-xs">${products.map((pp) => `<option value="${pp.id}">${pp.icon} ${esc(pp.name)}</option>`).join('')}</select></div>
              <div class="w-24"><label class="label" for="newSlotCap">Capaciteit</label><input id="newSlotCap" type="number" min="1" max="200" value="8" class="field py-1.5 text-xs"></div>
              <button class="btn-ghost px-3 py-2 text-xs" type="submit"><i class="fa-solid fa-plus"></i> Vak toevoegen</button>
            </form>
          </div>

          ${activeRes.length ? `<div><p class="label">Actieve reservaties</p><div class="divide-y divide-line rounded-xl border border-line">
            ${activeRes.map((r) => `<div class="flex items-center justify-between p-2.5 text-xs"><span><b class="font-mono">${r.code}</b> · ${esc(V.get.product(r.productId)?.name)} · vak ${esc(r.slotCode)}</span><span class="text-muted">${esc(V.get.user(r.userId)?.name || '')}</span></div>`).join('')}</div></div>` : ''}
        </div>
      </aside>`;
    el.querySelector('[data-backdrop]').addEventListener('click', closeMachine);
    el.querySelector('[data-drawer]').scrollTop = prevScroll;
    $('#addSlotForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const r = V.actions.addSlot(m.id, $('#newSlotProduct').value, $('#newSlotCap').value);
      U.toast(r.ok ? 'Vak toegevoegd' : r.error, r.ok ? 'ok' : 'error');
    });
  }
  function closeMachine() { ui.drawer = null; renderDrawer(); }

  function reportCard(r) {
    const m = V.get.machine(r.machineId); const u = V.get.user(r.userId); const st = V.REPORT_STATUS[r.status]; const it = V.ISSUE_TYPES[r.issue];
    return `<div class="rounded-xl border border-line bg-sub/50 p-3">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0"><p class="text-sm font-bold">${it.icon} ${esc(it.label)}</p>
          <p class="text-[11px] text-muted"><button class="font-bold text-brand-500 hover:underline" onclick="Dash.openMachine('${m.id}')">${esc(m.code)}</button> · ${esc(campusShort(m.campusId))} · ${esc(m.location)}</p></div>
        ${U.badge(st.label, st.color)}
      </div>
      ${r.note ? `<p class="mt-2 rounded-lg bg-card p-2 text-xs italic">“${esc(r.note)}”</p>` : ''}
      <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p class="text-[10px] text-muted">Door ${esc(u?.name || 'onbekend')} (${esc(V.ROLES[u?.role]?.label || '')}) · ${timeAgo(r.createdAt)}</p>
        <div class="flex flex-wrap gap-1.5">
          ${r.status === 'open' ? `<button onclick="Dash.reportStatus('${r.id}','behandeling')" class="btn-ghost px-2.5 py-1 text-[11px]"><i class="fa-solid fa-wrench"></i> In behandeling</button>` : ''}
          ${r.status !== 'opgelost' && m.status !== 'defect' ? `<button onclick="Dash.machineStatus('${m.id}','defect')" class="btn-ghost px-2.5 py-1 text-[11px] text-rose-500"><i class="fa-solid fa-ban"></i> Zet defect</button>` : ''}
          ${r.status !== 'opgelost' ? `<button onclick="Dash.reportStatus('${r.id}','opgelost')" class="btn px-2.5 py-1 text-[11px] bg-emerald-500 text-white"><i class="fa-solid fa-check"></i> Opgelost</button>` : ''}
        </div>
      </div>
    </div>`;
  }

  // =====================================================================
  //  PAGINA: BIJVULLIJST
  // =====================================================================
  function pageRefill() {
    const list = machines().filter((m) => m.status !== 'defect' && needsRefill(m) > 0 && (ui.refillAll || urgent(m)))
      .sort((a, b) => V.derive.fillPercent(a) - V.derive.fillPercent(b));
    const totals = new Map();
    list.forEach((m) => m.slots.forEach((s) => { const n = s.capacity - s.qty; if (n > 0) totals.set(s.productId, (totals.get(s.productId) || 0) + n); }));
    const defect = machines().filter((m) => m.status === 'defect');

    $('#page').innerHTML = `
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-muted">${list.length} automaten ${ui.refillAll ? 'met lege plaatsen' : 'die <b class="text-ink">dringend</b> bijgevuld moeten worden (vulgraad &lt; ' + V.CONFIG.lowFillPercent + '% of een vak leeg/bijna op)'}${ui.campus !== 'all' ? ` op ${esc(V.get.campus(ui.campus).name)}` : ''}.</p>
        <div class="no-print flex gap-2">
          <button onclick="Dash.toggleRefillAll()" class="chip ${ui.refillAll ? 'chip-active' : ''}">${ui.refillAll ? '<i class="fa-solid fa-check"></i> ' : ''}Toon ook niet-dringende</button>
          <button onclick="window.print()" class="btn-ghost px-3 py-2 text-xs"><i class="fa-solid fa-print"></i> Afdrukken</button>
        </div>
      </div>
      <div class="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
        <section class="card h-fit p-4">
          <h2 class="mb-3 font-extrabold"><i class="fa-solid fa-truck mr-1.5 text-brand-500"></i>Laadlijst bestelwagen</h2>
          <div class="divide-y divide-line">
            ${totals.size ? [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([pid, n]) => { const p = V.get.product(pid);
              return `<div class="flex items-center justify-between py-2 text-sm"><span>${p.icon} ${esc(p.name)}</span><b class="tabular-nums">${n} <span class="text-[10px] font-semibold text-muted">${unit(pid)}</span></b></div>`; }).join('') : '<p class="py-4 text-center text-sm text-muted">Niets bij te vullen 🎉</p>'}
          </div>
          ${defect.length ? `<p class="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400"><i class="fa-solid fa-ban"></i> Defect, niet in lijst: ${defect.map((m) => esc(m.code)).join(', ')}</p>` : ''}
        </section>
        <section class="space-y-3 xl:col-span-2">
          ${list.map((m) => { const p = V.derive.fillPercent(m);
            return `<div class="card p-4">
              <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div><p class="font-extrabold">${esc(m.code)} <span class="text-xs font-normal text-muted">· ${esc(campusShort(m.campusId))} · ${esc(V.get.floorName(m.campusId, m.floor))} · ${esc(m.location)}</span></p></div>
                <div class="flex items-center gap-3">${U.fillBar(p, { width: 'w-24' })}<button onclick="Dash.refillMachine('${m.id}')" class="no-print btn-primary px-3 py-1.5 text-xs"><i class="fa-solid fa-check"></i> Bijgevuld</button></div>
              </div>
              <div class="grid gap-1.5 sm:grid-cols-2">
                ${m.slots.filter((s) => s.qty < s.capacity).map((s) => { const pr = V.get.product(s.productId);
                  return `<div class="flex items-center justify-between rounded-lg bg-sub px-2.5 py-1.5 text-xs"><span><span class="font-mono font-bold text-muted">${esc(s.code)}</span> ${pr.icon} ${esc(pr.name)}</span><span class="tabular-nums ${s.qty === 0 ? 'font-bold text-rose-500' : 'text-muted'}">${s.qty}/${s.capacity} → <b class="text-ink">+${s.capacity - s.qty}</b></span></div>`; }).join('')}
              </div></div>`; }).join('')}
        </section>
      </div>`;
  }

  // =====================================================================
  //  PAGINA: MELDINGEN
  // =====================================================================
  function pageReports() {
    const all = S().reports.filter((r) => inCampus(r.machineId)).sort((a, b) => b.createdAt - a.createdAt);
    const tabs = Object.entries(V.REPORT_STATUS);
    const list = all.filter((r) => r.status === ui.reportTab);
    $('#page').innerHTML = `
      <div class="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
        ${tabs.map(([k, v]) => `<button onclick="Dash.setReportTab('${k}')" class="chip ${ui.reportTab === k ? 'chip-active' : ''}">${v.label} <span class="opacity-70">${all.filter((r) => r.status === k).length}</span></button>`).join('')}
      </div>
      <div class="grid gap-3 lg:grid-cols-2">
        ${list.length ? list.map(reportCard).join('') : `<p class="card p-8 text-center text-sm text-muted lg:col-span-2">Geen meldingen met status "${V.REPORT_STATUS[ui.reportTab].label}".</p>`}
      </div>`;
  }

  // =====================================================================
  //  PAGINA: RESERVATIES
  // =====================================================================
  function pageReservations() {
    const all = S().reservations.filter((r) => inCampus(r.machineId)).sort((a, b) => b.createdAt - a.createdAt);
    const list = ui.resFilter === 'all' ? all : all.filter((r) => r.status === ui.resFilter);
    const opts = [['actief', 'Actief'], ['opgehaald', 'Opgehaald'], ['verlopen', 'Verlopen'], ['geannuleerd', 'Geannuleerd'], ['all', 'Alle']];
    $('#page').innerHTML = `
      <div class="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
        ${opts.map(([k, l]) => `<button onclick="Dash.setResFilter('${k}')" class="chip ${ui.resFilter === k ? 'chip-active' : ''}">${l} <span class="opacity-70">${k === 'all' ? all.length : all.filter((r) => r.status === k).length}</span></button>`).join('')}
      </div>
      <div class="card overflow-x-auto">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="border-b border-line text-[10px] uppercase tracking-wider text-muted"><tr><th class="p-3">Code</th><th class="p-3">Product</th><th class="p-3">Automaat</th><th class="p-3">Gebruiker</th><th class="p-3">Betaling</th><th class="p-3">Tijd</th><th class="p-3">Status</th><th class="p-3"></th></tr></thead>
          <tbody class="divide-y divide-line">
          ${list.length ? list.map((r) => { const p = V.get.product(r.productId), m = V.get.machine(r.machineId), u = V.get.user(r.userId), st = V.RESERVATION_STATUS[r.status];
            return `<tr>
              <td class="p-3 font-mono font-extrabold">${r.code}</td>
              <td class="p-3 text-xs">${p?.icon} ${esc(p?.name)} <span class="text-muted">· ${euro(r.price)}</span></td>
              <td class="p-3 text-xs"><button class="font-bold text-brand-500 hover:underline" onclick="Dash.openMachine('${m.id}')">${esc(m.code)}</button> <span class="text-muted">vak ${esc(r.slotCode)}</span></td>
              <td class="p-3 text-xs">${esc(u?.name || '')}</td>
              <td class="p-3">${r.paid ? U.badge('Online betaald', 'emerald') : U.badge('Aan automaat', 'slate')}${r.fee ? `<p class="mt-0.5 text-[10px] font-semibold text-rose-500">+ ${euro(r.fee)} annulatiekost</p>` : ''}</td>
              <td class="p-3 text-xs text-muted">${dateTime(r.createdAt)}${r.status === 'actief' ? `<br>tot <b class="text-ink">${clock(r.expiresAt)}</b>` : ''}</td>
              <td class="p-3">${U.badge(st.label, st.color)}</td>
              <td class="p-3 text-right">${r.status === 'actief' ? `<button onclick="Dash.cancelRes('${r.id}')" class="btn-ghost px-2.5 py-1 text-[11px]">Annuleer</button>` : ''}</td></tr>`; }).join('')
            : '<tr><td colspan="8" class="p-8 text-center text-sm text-muted">Geen reservaties.</td></tr>'}
          </tbody>
        </table>
      </div>
      <p class="mt-3 text-xs text-muted"><i class="fa-solid fa-circle-info"></i> Gereserveerde producten worden in de app niet meer als beschikbaar getoond. Een reservatie blijft ${V.util.duration(V.CONFIG.reservationMinutes)} geldig. Annuleert de gebruiker of haalt hij niet op, dan betaalt hij ${euro(V.CONFIG.cancelFee)} (het product lag opzij). Annuleer jij als vulploeg, dan is dat gratis voor de gebruiker.</p>`;
  }

  // =====================================================================
  //  PAGINA: IDEEËN
  // =====================================================================
  function pageIdeas() {
    const list = S().suggestions.filter((s) => ui.campus === 'all' || s.campusId === ui.campus).sort((a, b) => b.votes.length - a.votes.length || b.createdAt - a.createdAt);
    $('#page').innerHTML = `
      <p class="mb-4 text-sm text-muted">Productideeën van studenten en personeel, gesorteerd op aantal stemmen. Wie stemde, krijgt een bericht als je de status aanpast.</p>
      <div class="card overflow-x-auto">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="border-b border-line text-[10px] uppercase tracking-wider text-muted"><tr><th class="p-3 text-center">Stemmen</th><th class="p-3">Idee</th><th class="p-3">Campus</th><th class="p-3">Ingediend</th><th class="p-3">Status</th><th class="p-3"></th></tr></thead>
          <tbody class="divide-y divide-line">
          ${list.length ? list.map((s) => `<tr>
            <td class="p-3 text-center"><span class="inline-flex min-w-[40px] flex-col items-center rounded-lg bg-brand-500/10 py-1 font-extrabold text-brand-600 dark:text-brand-400"><i class="fa-solid fa-caret-up text-xs"></i>${s.votes.length}</span></td>
            <td class="p-3"><p class="font-bold">${V.CATEGORIES[s.category]?.icon || ''} ${esc(s.name)}</p>${s.note ? `<p class="text-xs text-muted">${esc(s.note)}</p>` : ''}</td>
            <td class="p-3 text-xs">${esc(campusShort(s.campusId))}</td>
            <td class="p-3 text-xs text-muted">${esc(V.get.user(s.userId)?.name || '')}<br>${timeAgo(s.createdAt)}</td>
            <td class="p-3"><select aria-label="Status van ${esc(s.name)}" onchange="Dash.suggestionStatus('${s.id}', this.value)" class="field w-auto py-1.5 text-xs">${Object.entries(V.SUGGESTION_STATUS).map(([k, v]) => `<option value="${k}" ${s.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></td>
            <td class="p-3 text-right"><button onclick="Dash.makeProduct(${esc(JSON.stringify(s.name))})" class="btn-ghost px-2.5 py-1 text-[11px]"><i class="fa-solid fa-plus"></i> Als product</button></td></tr>`).join('')
            : '<tr><td colspan="6" class="p-8 text-center text-sm text-muted">Nog geen ideeën.</td></tr>'}
          </tbody>
        </table>
      </div>`;
  }

  // =====================================================================
  //  PAGINA: PRODUCTEN
  // =====================================================================
  function pageProducts() {
    const list = [...S().products].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    $('#page').innerHTML = `
      <div class="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
        <div class="card overflow-x-auto xl:col-span-2">
          <table class="w-full min-w-[640px] text-left text-sm">
            <thead class="border-b border-line text-[10px] uppercase tracking-wider text-muted"><tr><th class="p-3">Product</th><th class="p-3">Categorie</th><th class="p-3">Prijs</th><th class="p-3 text-center">Automaten</th><th class="p-3">Voorraad</th></tr></thead>
            <tbody class="divide-y divide-line">
            ${list.map((p) => { const st = V.derive.productStats(p.id); const pct = st.capacity ? Math.round((st.stock / st.capacity) * 100) : 0;
              return `<tr>
                <td class="p-3"><p class="font-bold">${p.icon} ${esc(p.name)}</p></td>
                <td class="p-3 text-xs">${V.CATEGORIES[p.category]?.label}</td>
                <td class="p-3"><div class="relative w-24"><span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">€</span><input aria-label="Prijs ${esc(p.name)}" class="field py-1.5 pl-6 text-xs" inputmode="decimal" value="${(p.price / 100).toFixed(2).replace('.', ',')}" onchange="Dash.price('${p.id}', this.value)"></div></td>
                <td class="p-3 text-center text-xs font-bold">${st.machines}</td>
                <td class="p-3">${st.machines ? U.fillBar(pct, { width: 'w-20' }) + `<p class="text-[10px] text-muted">${st.stock}/${st.capacity} st.</p>` : '<span class="text-xs text-muted">niet geplaatst</span>'}</td></tr>`; }).join('')}
            </tbody>
          </table>
        </div>
        <form id="productForm" class="card h-fit space-y-3 p-4">
          <h2 class="font-extrabold"><i class="fa-solid fa-plus mr-1.5 text-brand-500"></i>Nieuw product</h2>
          <div class="grid grid-cols-[64px_1fr] gap-2">
            <div><label class="label" for="pIcon">Icoon</label><input id="pIcon" maxlength="4" class="field text-center text-lg" value="🛒"></div>
            <div><label class="label" for="pName">Naam</label><input id="pName" class="field text-sm" value="${esc(ui.productPrefill)}" placeholder="Bv. Kombucha 33cl"></div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div><label class="label" for="pCat">Categorie</label><select id="pCat" class="field text-sm">${Object.entries(V.CATEGORIES).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select></div>
            <div><label class="label" for="pPrice">Prijs (€)</label><input id="pPrice" inputmode="decimal" class="field text-sm" placeholder="1,80"></div>
          </div>
          <button class="btn-primary w-full py-2.5 text-sm" type="submit">Product toevoegen</button>
          <p class="text-[11px] text-muted">Daarna kan je het product in een vak plaatsen via <b>Automaten → Beheer</b>.</p>
        </form>
      </div>`;
    ui.productPrefill = '';
    $('#productForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const r = V.actions.saveProduct({ name: $('#pName').value, icon: $('#pIcon').value.trim(), category: $('#pCat').value, price: $('#pPrice').value, tags: [] });
      U.toast(r.ok ? 'Product toegevoegd' : r.error, r.ok ? 'ok' : 'error');
    });
  }

  // =====================================================================
  //  PAGINA: KAART
  // =====================================================================
  function pageMap() {
    if (ui.campus !== 'all') ui.mapCampus = ui.campus;
    const campus = V.get.campus(ui.mapCampus);
    if (!campus.floors.some((f) => f.id === ui.mapFloor)) ui.mapFloor = campus.floors.some((f) => f.id === 0) ? 0 : campus.floors[0].id;
    const ms = V.get.machinesOfCampus(campus.id);
    const onFloor = ms.filter((m) => m.floor === ui.mapFloor);
    const modes = [
      ['view', 'fa-eye', 'Bekijken', 'Klik op een automaat om hem te beheren.'],
      ['move', 'fa-up-down-left-right', 'Verplaatsen', 'Sleep een automaat naar zijn juiste plek. De app past zich meteen aan.'],
      ['add', 'fa-plus', 'Automaat toevoegen', 'Klik op de plek waar de nieuwe automaat staat en vul de gegevens in.'],
    ];
    const hint = modes.find((x) => x[0] === ui.mapMode)[3];
    const draft = ui.mapMode === 'add' && ui.draft && ui.draft.floor === ui.mapFloor ? ui.draft : null;

    $('#page').innerHTML = `
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div class="no-scrollbar flex flex-wrap items-center gap-2">
          ${ui.campus === 'all' && S().campuses.length > 1 ? S().campuses.map((c) => `<button onclick="Dash.mapCampus('${c.id}')" class="chip ${ui.mapCampus === c.id ? 'chip-active' : ''}">${esc(c.short)}</button>`).join('') + '<span class="mx-1 h-5 w-px bg-line"></span>' : ''}
          ${campus.floors.map((f) => { const n = ms.filter((m) => m.floor === f.id); const bad = n.filter((m) => V.derive.machineState(m).key !== 'ok').length;
            return `<button onclick="Dash.mapFloor(${f.id})" class="chip ${ui.mapFloor === f.id ? 'chip-active' : ''}">${esc(f.name)} <span class="opacity-70">${n.length}</span>${bad ? '<span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>' : ''}</button>`; }).join('')}
        </div>
        <div class="flex rounded-xl border border-line bg-sub p-0.5 text-xs font-bold" role="radiogroup" aria-label="Kaartmodus">
          ${modes.map(([id, icon, label]) => `<button role="radio" aria-checked="${ui.mapMode === id}" onclick="Dash.setMapMode('${id}')" class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${ui.mapMode === id ? 'bg-brand-500 text-white' : 'text-muted hover:text-ink'}"><i class="fa-solid ${icon}"></i>${label}</button>`).join('')}
        </div>
      </div>
      <p class="mb-3 flex items-center gap-2 rounded-xl border ${ui.mapMode === 'view' ? 'border-line bg-card text-muted' : 'border-brand-500/40 bg-brand-500/10 text-brand-700 dark:text-brand-300'} px-3 py-2 text-xs font-semibold"><i class="fa-solid fa-circle-info"></i>${hint}</p>
      <div class="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
        <div class="xl:col-span-2"><div id="plan" class="mx-auto max-w-3xl"></div></div>
        <div class="space-y-2">
          ${draft ? addMachineForm(campus, draft) : ''}
          <h2 class="label">${esc(campus.name)} · ${esc(V.get.floorName(campus.id, ui.mapFloor))}</h2>
          ${onFloor.length ? onFloor.map((m) => { const s = V.derive.machineState(m);
            return `<button onclick="Dash.openMachine('${m.id}')" class="card flex w-full items-center justify-between gap-3 p-3 text-left hover:border-brand-500/50">
              <div class="min-w-0"><p class="text-sm font-extrabold">${V.MACHINE_TYPES[m.type].icon} ${esc(m.code)}</p><p class="truncate text-xs text-muted">${esc(m.location)}</p></div>
              <div class="flex flex-col items-end gap-1">${U.badge(`${s.dot} ${s.short}`, s.color)}${U.fillBar(s.fill, { width: 'w-14' })}</div></button>`; }).join('')
            : '<p class="card p-4 text-sm text-muted">Geen automaten op dit verdiep.</p>'}
        </div>
      </div>`;

    U.renderFloorplan($('#plan'), {
      campusId: campus.id, floor: ui.mapFloor, machines: onFloor, selectedId: ui.drawer, draft,
      draggable: ui.mapMode === 'move',
      onPin: (id) => { if (ui.mapMode !== 'move') openMachine(id); },
      onBackground: ui.mapMode === 'add' ? (x, y) => { ui.draft = { x, y, floor: ui.mapFloor }; render(); setTimeout(() => $('#newLoc')?.focus(), 0); } : null,
    });
    if (ui.mapMode === 'move') enableDrag($('#plan'));
    if (draft) wireAddForm(campus, draft);
  }

  function addMachineForm(campus, draft) {
    return `<form id="addMachineForm" class="card space-y-3 border-brand-500/50 p-4">
      <h3 class="font-extrabold"><i class="fa-solid fa-plus mr-1 text-brand-500"></i>Nieuwe automaat</h3>
      <p class="text-[11px] text-muted">${esc(V.get.floorName(campus.id, draft.floor))} · positie ${draft.x}% / ${draft.y}% (klik opnieuw op de kaart om te verschuiven)</p>
      <div><label class="label" for="newType">Type</label>
        <select id="newType" class="field py-2 text-sm">${Object.entries(V.MACHINE_TYPES).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select></div>
      <div><label class="label" for="newLoc">Locatie (zoals studenten ze zien)</label>
        <input id="newLoc" class="field py-2 text-sm" maxlength="80" placeholder="Bv. Gang bij lokaal 204"></div>
      <div><label class="label" for="newCode">Code</label>
        <input id="newCode" class="field py-2 text-sm" maxlength="12" placeholder="${esc(nextCodeHint(campus.id, draft.floor))} (automatisch)"></div>
      <div class="grid grid-cols-2 gap-2">
        <button type="button" onclick="Dash.cancelDraft()" class="btn-ghost py-2 text-xs">Annuleer</button>
        <button type="submit" class="btn-primary py-2 text-xs">Toevoegen</button>
      </div>
      <p class="text-[11px] text-muted">Daarna open je de automaat om vakken en producten toe te voegen.</p>
    </form>`;
  }
  function nextCodeHint(campusId, floor) {
    const prefix = 'K' + (V.get.campus(campusId).short || campusId)[0].toUpperCase();
    const fl = floor === 0.5 ? 'M' : String(Math.max(0, Math.floor(floor)));
    let n = 1; while (S().machines.some((m) => m.code === `${prefix}.${fl}${n}`)) n++;
    return `${prefix}.${fl}${n}`;
  }
  function wireAddForm(campus, draft) {
    $('#addMachineForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const r = V.actions.addMachine({ campusId: campus.id, floor: draft.floor, x: draft.x, y: draft.y, type: $('#newType').value, location: $('#newLoc').value, code: $('#newCode').value });
      if (!r.ok) return U.toast(r.error, 'error');
      ui.draft = null; ui.mapMode = 'view';
      U.toast(`${r.machine.code} toegevoegd. Voeg nu vakken toe.`);
      openMachine(r.machine.id);
    });
  }

  /** Pins verslepen op de plattegrond (muis en touch) */
  function enableDrag(container) {
    const plan = container.querySelector('[data-plan]');
    container.querySelectorAll('[data-pin]').forEach((pin) => {
      pin.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pin.setPointerCapture(e.pointerId);
        const rect = plan.getBoundingClientRect();
        let x = null, y = null;
        const move = (ev) => {
          x = Math.max(2, Math.min(98, ((ev.clientX - rect.left) / rect.width) * 100));
          y = Math.max(2, Math.min(98, ((ev.clientY - rect.top) / rect.height) * 100));
          pin.style.left = x + '%'; pin.style.top = y + '%'; pin.style.zIndex = 30;
        };
        const up = () => {
          pin.removeEventListener('pointermove', move);
          pin.removeEventListener('pointerup', up);
          pin.removeEventListener('pointercancel', up);
          if (x !== null) {
            const m = V.get.machine(pin.dataset.pin);
            V.actions.moveMachine(m.id, x, y);
            U.toast(`${m.code} verplaatst`);
          }
        };
        pin.addEventListener('pointermove', move);
        pin.addEventListener('pointerup', up);
        pin.addEventListener('pointercancel', up);
      });
    });
  }

  // =====================================================================
  //  RENDER-LUS
  // =====================================================================
  const PAGE_RENDER = { overzicht: pageOverview, automaten: pageMachines, bijvullen: pageRefill, meldingen: pageReports, reservaties: pageReservations, ideeen: pageIdeas, producten: pageProducts, kaart: pageMap };

  function render() {
    const u = user();
    if (!u) { ui.drawer = null; renderDrawer(); renderLogin(); return; }
    // focus/cursor bewaren als een invoerveld actief is
    const act = document.activeElement; const id = act && act.id; const pos = act && act.selectionStart;
    const scrollY = window.scrollY;
    renderShell();
    PAGE_RENDER[ui.page]();
    renderDrawer();
    window.scrollTo(0, scrollY);
    if (id && document.getElementById(id) && !ui.drawer) { const el = document.getElementById(id); el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { /* noop */ } }
  }

  function openMachine(id) { ui.drawer = id; renderDrawer(); }

  window.addEventListener('hashchange', () => {
    const p = location.hash.slice(1);
    if (PAGES.some((x) => x.id === p)) { ui.page = p; ui.navOpen = false; render(); window.scrollTo(0, 0); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.drawer) closeMachine(); });

  // =====================================================================
  //  PUBLIEKE ACTIES
  // =====================================================================
  const res = (r, okMsg) => { if (r && r.ok === false && r.error) U.toast(r.error, 'error'); else if (okMsg) U.toast(okMsg); };
  window.Dash = {
    demoLogin() { const r = V.auth.login('dashboard', 'sam@vulploeg.be', 'demo'); if (!r.ok) U.toast(r.error, 'error'); },
    logout() { V.auth.logout('dashboard'); },
    toggleNav() { ui.navOpen = !ui.navOpen; render(); },
    toggleTheme() { U.toggleTheme(THEME_KEY); },
    setCampus(c) { ui.campus = c; render(); },
    setMachineStatus(s) { ui.machineStatus = s; render(); },
    searchMachines(q) { ui.machineSearch = q; render(); },
    setReportTab(t) { ui.reportTab = t; render(); },
    setResFilter(f) { ui.resFilter = f; render(); },
    toggleRefillAll() { ui.refillAll = !ui.refillAll; render(); },
    openMachine, closeMachine,
    machineStatus(id, s) { res(V.actions.setMachineStatus(id, s), s === 'defect' ? 'Automaat op defect gezet' : 'Automaat werkt weer'); },
    slotQty(id, slot, q) { res(V.actions.setSlotQty(id, slot, q)); },
    refillSlot(id, slot) { res(V.actions.refillSlot(id, slot), `Vak ${slot} bijgevuld`); },
    refillMachine(id) { const r = V.actions.refillMachine(id); res(r, `${V.get.machine(id).code} bijgevuld (+${r.added})`); },
    slotProduct(id, slot, pid) { res(V.actions.setSlotProduct(id, slot, pid), 'Product gewijzigd, vul het vak bij'); },
    reportStatus(id, s) { res(V.actions.setReportStatus(id, s, { machineOk: true }), s === 'opgelost' ? 'Melding opgelost, melder verwittigd' : 'In behandeling, melder verwittigd'); },
    cancelRes(id) { res(V.actions.cancelReservation(id), 'Reservatie geannuleerd'); },
    suggestionStatus(id, s) { res(V.actions.setSuggestionStatus(id, s), 'Status aangepast, stemmers verwittigd'); },
    makeProduct(name) { ui.productPrefill = name; location.hash = '#producten'; if (ui.page === 'producten') render(); },
    price(id, val) { const p = V.get.product(id); res(V.actions.saveProduct({ ...p, price: val }), 'Prijs aangepast'); },
    mapCampus(c) { ui.mapCampus = c; ui.mapFloor = null; render(); },
    mapFloor(f) { ui.mapFloor = f; render(); },
    setMapMode(m) { ui.mapMode = m; if (m !== 'add') ui.draft = null; render(); },
    cancelDraft() { ui.draft = null; render(); },
    saveMachineInfo(id) {
      const floor = Number($('#mFloor').value);
      const r = V.actions.updateMachine(id, { location: $('#mLoc').value, type: $('#mType').value });
      if (!r.ok) return U.toast(r.error, 'error');
      const m = V.get.machine(id);
      if (floor !== m.floor) { V.actions.moveMachine(id, m.x, m.y, floor); U.toast(`${m.code} staat nu op ${V.get.floorName(m.campusId, floor)}. Zet hem juist via Kaart → Verplaatsen.`, 'info'); }
      else U.toast('Gegevens opgeslagen');
    },
    removeMachine(id) {
      if (this._rmArmed !== id) { this._rmArmed = id; setTimeout(() => { if (this._rmArmed === id) this._rmArmed = null; }, 3000); return U.toast('Klik nog eens om deze automaat te verwijderen', 'info'); }
      this._rmArmed = null; const code = V.get.machine(id).code;
      V.actions.removeMachine(id); ui.drawer = null; render(); U.toast(`${code} verwijderd`);
    },
    showOnMap(id) { const m = V.get.machine(id); ui.mapCampus = m.campusId; ui.mapFloor = m.floor; ui.drawer = null; location.hash = '#kaart'; if (ui.page === 'kaart') render(); },
    simulate() { const r = V.actions.simulateSales(5); U.toast(`${r.sold} verkopen gesimuleerd`, 'info'); },
    reset() {
      if (!this._armed) { this._armed = true; setTimeout(() => { this._armed = false; }, 3000); return U.toast('Klik nog eens om alle demodata te resetten', 'info'); }
      this._armed = false; V.actions.resetDemo(); U.toast('Demodata hersteld');
    },
  };

  V.subscribe(render);
  render();
  setInterval(() => { if (user() && !ui.drawer && !document.activeElement?.matches('input,select,textarea')) render(); }, 30000); // "x min geleden" verversen
})();
