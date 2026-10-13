/* =====================================================================
 * Vendo — gedeelde datalaag (store)
 * ---------------------------------------------------------------------
 * Eén bron van waarheid voor zowel de studenten-app (/app) als het
 * dashboard van de vulfirma (/dashboard).
 *
 * MVP zonder backend: alle data staat in localStorage van de browser.
 * Omdat app en dashboard van dezelfde origin komen, delen ze die data.
 * Wijzigingen in de ene tab verschijnen live in de andere (storage-event
 * + BroadcastChannel).
 *
 * Later vervangen door een echte API: elke functie in "Acties" hieronder
 * komt overeen met één endpoint (zie README → "Naar een echte backend").
 * ===================================================================== */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'vendo.mvp.data';
  const DATA_VERSION = 5;
  const SESSION_KEYS = { app: 'vendo.session.app', dashboard: 'vendo.session.dashboard' };

  // ---------- Instellingen ----------
  const CONFIG = {
    reservationMinutes: 8 * 60, // hoe lang een reservatie geldig blijft (8 uur)
    cancelFee: 50,            // annulatiekost in cent (product werd opzijgelegd)
    freeCancelMinutes: 15,    // binnen deze tijd na reserveren is annuleren gratis
    maxActiveReservations: 2, // per gebruiker tegelijk
    lowFillPercent: 30,       // onder deze vulgraad = "bijna leeg"
    lowSlotQty: 2,            // vak met <= 2 stuks = "bijna op"
    metersPerMapPercent: 0.8, // schaal van de plattegrond (1% ≈ 0.8 m)
    metersPerFloor: 25,       // trap nemen ≈ 25 m wandelen
  };

  // ---------- Referentiedata ----------
  const MACHINE_TYPES = {
    drank:  { label: 'Drankautomaat',  icon: '🥤' },
    snack:  { label: 'Snackautomaat',  icon: '🍫' },
    koffie: { label: 'Koffieautomaat', icon: '☕' },
    combi:  { label: 'Combi-automaat', icon: '🧃' },
  };

  const CATEGORIES = {
    drank:  { label: 'Koude drank', icon: '🥤' },
    snack:  { label: 'Snack',       icon: '🍫' },
    gezond: { label: 'Gezond',      icon: '🍏' },
    koffie: { label: 'Warme drank', icon: '☕' },
  };

  const TAGS = {
    suikervrij: { label: 'Suikervrij', icon: '🍃' },
    vegan:      { label: 'Vegan',      icon: '🌱' },
    glutenvrij: { label: 'Glutenvrij', icon: '🌾' },
    koud:       { label: 'Koud',       icon: '🧊' },
    warm:       { label: 'Warm',       icon: '🔥' },
  };

  const ISSUE_TYPES = {
    betaling: { label: 'Betalen werkt niet (kaart / Payconiq)', icon: '💳' },
    klem:     { label: 'Product blijft hangen',                 icon: '🍫' },
    koeling:  { label: 'Koeling defect (niet koud)',           icon: '🌡️' },
    scherm:   { label: 'Scherm of knoppen reageren niet',       icon: '🖥️' },
    voorraad: { label: 'App toont voorraad, maar vak is leeg',  icon: '📦' },
    anders:   { label: 'Iets anders',                           icon: '❓' },
  };

  const REPORT_STATUS = {
    open:        { label: 'Open',            color: 'rose' },
    behandeling: { label: 'In behandeling',  color: 'amber' },
    opgelost:    { label: 'Opgelost',        color: 'emerald' },
  };

  const SUGGESTION_STATUS = {
    nieuw:      { label: 'Nieuw',      color: 'sky' },
    gepland:    { label: 'Gepland',    color: 'amber' },
    toegevoegd: { label: 'Toegevoegd', color: 'emerald' },
    afgewezen:  { label: 'Afgewezen',  color: 'slate' },
  };

  const RESERVATION_STATUS = {
    actief:     { label: 'Actief',     color: 'emerald' },
    opgehaald:  { label: 'Opgehaald',  color: 'sky' },
    verlopen:   { label: 'Verlopen',   color: 'slate' },
    geannuleerd:{ label: 'Geannuleerd',color: 'slate' },
  };

  const ROLES = {
    student:   { label: 'Student',        scope: 'app' },
    personeel: { label: 'Personeel KdG',  scope: 'app' },
    operator:  { label: 'Vulploeg firma', scope: 'dashboard' },
  };

  // ---------- Demodata (seed) ----------
  function seed() {
    const now = Date.now();
    const min = 60 * 1000, hour = 60 * min;

    const products = [
      // id, naam, icoon, categorie, prijs (cent), tags
      ['redbull',      'Red Bull Energy 25cl',      '⚡', 'drank',  220, ['koud']],
      ['redbull-sf',   'Red Bull Sugarfree 25cl',   '⚡', 'drank',  220, ['koud', 'suikervrij']],
      ['cola',         'Coca-Cola 33cl',            '🥤', 'drank',  180, ['koud', 'vegan', 'glutenvrij']],
      ['cola-zero',    'Coca-Cola Zero 33cl',       '🥤', 'drank',  180, ['koud', 'suikervrij', 'vegan', 'glutenvrij']],
      ['fanta',        'Fanta Orange 33cl',         '🍊', 'drank',  180, ['koud', 'vegan', 'glutenvrij']],
      ['icetea',       'Lipton Ice Tea Peach 33cl', '🍑', 'drank',  180, ['koud', 'vegan']],
      ['water',        'Spa Reine plat water 50cl', '💧', 'drank',  120, ['koud', 'suikervrij', 'vegan', 'glutenvrij']],
      ['water-bruis',  'Spa Intense bruisend 50cl', '🫧', 'drank',  120, ['koud', 'suikervrij', 'vegan', 'glutenvrij']],
      ['bueno',        'Kinder Bueno',              '🍫', 'snack',  160, []],
      ['snickers',     'Snickers',                  '🍫', 'snack',  150, ['glutenvrij']],
      ['twix',         'Twix',                      '🍪', 'snack',  150, []],
      ['mms',          "M&M's Peanut",              '🥜', 'snack',  160, ['glutenvrij']],
      ['lays',         "Lay's Naturel",             '🥔', 'snack',  140, ['vegan', 'glutenvrij']],
      ['lays-paprika', "Lay's Paprika",             '🥔', 'snack',  140, ['vegan']],
      ['proteinbar',   'Proteïnereep chocolade',    '💪', 'gezond', 250, ['glutenvrij']],
      ['notenmix',     'Ongezouten notenmix',       '🌰', 'gezond', 200, ['vegan', 'glutenvrij']],
      ['appel',        'Appel Jonagold',            '🍏', 'gezond',  80, ['vegan', 'glutenvrij']],
      ['espresso',     'Espresso',                  '☕', 'koffie', 100, ['warm', 'vegan', 'suikervrij']],
      ['cappuccino',   'Cappuccino',                '☕', 'koffie', 120, ['warm']],
      ['choco',        'Warme chocomelk',           '🍫', 'koffie', 120, ['warm']],
      ['thee',         'Thee (groen of zwart)',     '🍵', 'koffie',  90, ['warm', 'vegan', 'suikervrij']],
    ].map(([id, name, icon, category, price, tags]) => ({ id, name, icon, category, price, tags, active: true }));

    // Campus Groenplaats — plattegronden uit GRP_grondplan.pdf ("Wegwijs op de campus").
    // Pins (x, y) staan in % van de afbeelding van dat verdiep.
    // Andere campussen kunnen later in dezelfde vorm toegevoegd worden.
    const plan = (file, w, h) => ({ image: 'shared/assets/plan/' + file + '.png', aspect: w + ' / ' + h });
    const campuses = [
      {
        id: 'groenplaats', name: 'Campus Groenplaats', short: 'Groenplaats', street: 'Nationalestraat',
        entrance: { floor: 0, x: 56, y: 86 },
        hotspots: { 'Shop': '010', 'Servicedesk': '009', 'Bibliotheek': '116', 'Cafetaria': '411', 'STIP': '501' },
        floors: [
          { id: 0,   name: 'Gelijkvloers', ...plan('grp-0', 1130, 438) },
          { id: 0.5, name: 'Mezzanine',    ...plan('grp-m', 395, 360) },
          { id: 1,   name: 'Verdiep 1',    ...plan('grp-1', 1130, 415) },
          { id: 2,   name: 'Verdiep 2',    ...plan('grp-2', 1130, 440) },
          { id: 3,   name: 'Verdiep 3',    ...plan('grp-3', 1130, 435) },
          { id: 4,   name: 'Verdiep 4',    ...plan('grp-4', 1120, 435) },
          { id: 5,   name: 'Verdiep 5',    ...plan('grp-5', 1125, 440) },
        ],
      },
    ];

    // Vakken: [productId, aantal, capaciteit]
    const slots = (list) => list.map(([productId, qty, capacity], i) => ({
      code: String.fromCharCode(65 + Math.floor(i / 4)) + ((i % 4) + 1), // A1..A4, B1..
      productId, qty, capacity,
    }));

    const m = (id, code, campusId, floor, location, type, x, y, status, slotList, lastRefillHoursAgo) => ({
      id, code, campusId, floor, location, type, x, y, status, // status: 'ok' | 'defect'
      slots: slots(slotList),
      lastRefill: now - lastRefillHoursAgo * hour,
    });

    const G = 'groenplaats';
    const machines = [
      m('KG01', 'KG.01', G, 0, 'Inkom, tussen onthaal en trap', 'drank', 47, 70, 'ok',
        [['redbull', 4, 10], ['cola-zero', 8, 10], ['water', 12, 14], ['icetea', 6, 10], ['cola', 7, 10], ['fanta', 3, 10]], 20),
      m('KG02', 'KG.02', G, 0, 'Hal bij lokaal 004', 'snack', 30, 50, 'ok',
        [['bueno', 5, 8], ['lays', 6, 8], ['snickers', 7, 8], ['mms', 4, 8], ['twix', 0, 8], ['proteinbar', 3, 6]], 26),
      m('KG03', 'KG.03', G, 0.5, 'Mezzanine, naast servicedesk (009)', 'koffie', 62, 45, 'ok',
        [['espresso', 60, 120], ['cappuccino', 14, 120], ['choco', 22, 80], ['thee', 40, 80]], 48),
      m('KG11', 'KG.11', G, 1, 'Gang aan de bibliotheek (116)', 'drank', 22, 70, 'ok',
        [['redbull-sf', 7, 10], ['redbull', 5, 10], ['water-bruis', 10, 12], ['cola-zero', 9, 10]], 10),
      m('KG12', 'KG.12', G, 1, 'Gang bij lokaal 108, aan de toiletten', 'snack', 76, 70, 'defect',
        [['bueno', 6, 8], ['lays-paprika', 5, 8], ['snickers', 4, 8], ['mms', 6, 8]], 30),
      m('KG21', 'KG.21', G, 2, 'Gang bij lokaal 218, aan de trap', 'combi', 25, 66, 'ok',
        [['water', 2, 10], ['redbull-sf', 1, 8], ['notenmix', 2, 6], ['appel', 1, 8]], 70),
      m('KG31', 'KG.31', G, 3, 'Gang bij lokaal 310', 'snack', 21, 69, 'ok',
        [['bueno', 3, 8], ['lays-paprika', 4, 8], ['proteinbar', 5, 6], ['twix', 6, 8]], 22),
      m('KG41', 'KG.41', G, 4, 'Cafetaria (411), aan de ingang', 'drank', 10, 42, 'ok',
        [['redbull', 9, 10], ['cola', 8, 10], ['water', 11, 14], ['icetea', 9, 10]], 6),
      m('KG42', 'KG.42', G, 4, 'Cafetaria (411), achteraan', 'koffie', 10, 78, 'ok',
        [['espresso', 90, 120], ['cappuccino', 70, 120], ['thee', 50, 80], ['choco', 12, 80]], 8),
      m('KG51', 'KG.51', G, 5, 'Aan STIP (501)', 'drank', 72, 30, 'ok',
        [['water', 2, 14], ['cola', 0, 10], ['fanta', 1, 10], ['cola-zero', 4, 10]], 96),
    ];

    const users = [
      { id: 'u-lotte', name: 'Lotte Peeters',  email: 'lotte.peeters@student.kdg.be', password: 'demo', role: 'student', favorites: ['redbull', 'bueno', 'cappuccino'] },
      { id: 'u-tom',   name: 'Tom Janssens',   email: 'tom.janssens@kdg.be',          password: 'demo', role: 'personeel', favorites: ['espresso', 'water'] },
      { id: 'u-sam',   name: 'Sam De Smet',    email: 'sam@vulploeg.be',              password: 'demo', role: 'operator', favorites: [] },
      { id: 'u-yassin',name: 'Yassin El Amrani', email: 'yassin.elamrani@student.kdg.be', password: 'demo', role: 'student', favorites: [] },
    ];

    const reports = [
      { id: 'r1', machineId: 'KG12', issue: 'betaling', note: 'Kaartlezer blijft op "even geduld" staan.', userId: 'u-yassin', createdAt: now - 3 * hour, status: 'behandeling', updatedAt: now - 2 * hour },
      { id: 'r2', machineId: 'KG12', issue: 'klem', note: '', userId: 'u-tom', createdAt: now - 2.5 * hour, status: 'open', updatedAt: now - 2.5 * hour },
      { id: 'r3', machineId: 'KG41', issue: 'koeling', note: 'Blikjes zijn lauw.', userId: 'u-yassin', createdAt: now - 40 * min, status: 'open', updatedAt: now - 40 * min },
      { id: 'r4', machineId: 'KG01', issue: 'klem', note: 'Red Bull bleef hangen in vak A1.', userId: 'u-lotte', createdAt: now - 26 * hour, status: 'opgelost', updatedAt: now - 22 * hour },
    ];

    const suggestions = [
      { id: 's1', campusId: G, name: 'Kombucha', category: 'drank', note: 'Gezonder alternatief voor frisdrank', userId: 'u-yassin', votes: ['u-yassin', 'u-tom'], status: 'nieuw', createdAt: now - 5 * 24 * hour },
      { id: 's2', campusId: G, name: 'Nimm2 Lachgummi', category: 'snack', note: '', userId: 'u-lotte', votes: ['u-lotte', 'u-yassin'], status: 'gepland', createdAt: now - 9 * 24 * hour },
      { id: 's3', campusId: G, name: 'Havermelk-cappuccino', category: 'koffie', note: 'Voor wie geen koemelk drinkt', userId: 'u-tom', votes: ['u-tom'], status: 'nieuw', createdAt: now - 2 * 24 * hour },
      { id: 's4', campusId: G, name: 'Wraps / broodjes', category: 'gezond', note: 'Iets echts eten tussen twee lessen', userId: 'u-yassin', votes: ['u-yassin'], status: 'nieuw', createdAt: now - 24 * hour },
    ];

    const reservations = [
      { id: 'res1', userId: 'u-yassin', machineId: 'KG41', slotCode: 'A1', productId: 'redbull', price: 220, code: '4821', createdAt: now - 2 * hour, expiresAt: now + 6 * hour, status: 'actief', paid: false },
      { id: 'res2', userId: 'u-lotte', machineId: 'KG02', slotCode: 'A1', productId: 'bueno', price: 160, code: '1290', createdAt: now - 26 * hour, expiresAt: now - 18 * hour, status: 'opgehaald', closedAt: now - 25 * hour, paid: false },
      { id: 'res3', userId: 'u-lotte', machineId: 'KG01', slotCode: 'A1', productId: 'redbull', price: 220, code: '7713', createdAt: now - 3 * 24 * hour, expiresAt: now - 3 * 24 * hour + 8 * hour, status: 'geannuleerd', closedAt: now - 3 * 24 * hour + hour, paid: false, fee: 50 },
    ];

    const notifications = [
      { id: 'n1', userId: 'u-lotte', text: 'Je melding over KG.01 (product blijft hangen) is opgelost. Bedankt!', createdAt: now - 22 * hour, read: false, icon: '✅' },
      { id: 'n2', userId: 'u-lotte', text: 'Jouw idee "Nimm2 Lachgummi" staat gepland voor Campus Groenplaats 🎉', createdAt: now - 3 * 24 * hour, read: true, icon: '💡' },
    ];

    const activity = [
      { ts: now - 40 * min, icon: '⚠️', text: 'Nieuwe melding voor KG.41: koeling defect' },
      { ts: now - 2 * hour, icon: '🔧', text: 'Melding KG.12 (betaling) in behandeling genomen' },
      { ts: now - 2.5 * hour, icon: '⚠️', text: 'Nieuwe melding voor KG.12: product blijft hangen' },
      { ts: now - 6 * hour, icon: '📦', text: 'KG.41 volledig bijgevuld' },
    ];

    return {
      version: DATA_VERSION,
      products, campuses, machines, users, reports, suggestions, reservations, notifications, activity,
      salesToday: 37,
    };
  }

  // ---------- Opslag + sync ----------
  let state = null;
  const listeners = new Set();
  let channel = null;
  try { channel = new BroadcastChannel('vendo-sync'); } catch (e) { /* oudere browsers */ }

  function safeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function safeSet(key, val) { try { localStorage.setItem(key, val); return true; } catch (e) { return false; } }
  function safeRemove(key) { try { localStorage.removeItem(key); } catch (e) { /* noop */ } }

  function load() {
    const raw = safeGet(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === DATA_VERSION) { state = parsed; return state; }
      } catch (e) { /* corrupte data → opnieuw seeden */ }
    }
    state = seed();
    persist(false);
    return state;
  }

  function persist(broadcast = true) {
    safeSet(STORAGE_KEY, JSON.stringify(state));
    if (broadcast && channel) channel.postMessage({ type: 'changed', at: Date.now() });
  }

  function emit() { listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } }); }

  // Elke wijziging loopt via commit(): opslaan + andere tabs + eigen UI verwittigen
  function commit() { persist(true); emit(); }

  function reloadFromStorage() { load(); emit(); }

  global.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) reloadFromStorage();
    if (e.key && e.key.startsWith('vendo.session')) emit();
  });
  if (channel) channel.onmessage = () => reloadFromStorage();

  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  // ---------- Hulpfuncties ----------
  const uid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const euro = (cents) => '€ ' + (cents / 100).toFixed(2).replace('.', ',');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function timeAgo(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 45) return 'zonet';
    const m = Math.round(s / 60); if (m < 60) return m + ' min geleden';
    const h = Math.round(m / 60); if (h < 24) return h + ' u geleden';
    const d = Math.round(h / 24); return d === 1 ? 'gisteren' : d + ' dagen geleden';
  }
  function duration(minutes) { return minutes % 60 === 0 && minutes >= 60 ? (minutes / 60) + ' uur' : minutes + ' minuten'; }
  function clock(ts) { const d = new Date(ts); return d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' }); }
  function dateTime(ts) { const d = new Date(ts); return d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }) + ' ' + clock(ts); }

  function log(icon, text) {
    state.activity.unshift({ ts: Date.now(), icon, text });
    state.activity = state.activity.slice(0, 120);
  }
  function notify(userId, icon, text) {
    if (!userId) return;
    state.notifications.unshift({ id: uid('n'), userId, icon, text, createdAt: Date.now(), read: false });
  }

  // ---------- Opzoeken ----------
  const get = {
    state: () => state,
    product: (id) => state.products.find((p) => p.id === id),
    campus: (id) => state.campuses.find((c) => c.id === id),
    machine: (id) => state.machines.find((m) => m.id === id),
    user: (id) => state.users.find((u) => u.id === id),
    floorName(campusId, floorId) {
      const c = get.campus(campusId); const f = c && c.floors.find((x) => x.id === floorId);
      return f ? f.name : 'Verdiep ' + floorId;
    },
    machinesOfCampus: (campusId) => state.machines.filter((m) => !m.removed).filter((m) => !campusId || campusId === 'all' || m.campusId === campusId),
    openReports: (machineId) => state.reports.filter((r) => r.machineId === machineId && r.status !== 'opgelost'),
  };

  // ---------- Afgeleide gegevens ----------
  function reservedCount(machineId, slotCode) {
    return state.reservations.filter((r) => r.status === 'actief' && r.machineId === machineId && r.slotCode === slotCode).length;
  }
  function available(machine, slot) { return Math.max(0, slot.qty - reservedCount(machine.id, slot.code)); }

  function fillPercent(machine) {
    const cap = machine.slots.reduce((a, s) => a + s.capacity, 0);
    const qty = machine.slots.reduce((a, s) => a + s.qty, 0);
    return cap ? Math.round((qty / cap) * 100) : 0;
  }
  function emptySlots(machine) { return machine.slots.filter((s) => s.qty === 0).length; }
  function lowSlots(machine) { return machine.slots.filter((s) => s.qty > 0 && s.qty <= Math.max(CONFIG.lowSlotQty, Math.round(s.capacity * 0.15))).length; }

  /** Status zoals de gebruiker hem ziet. Volgorde: defect > storing gemeld > bijna leeg > werkt */
  function machineState(machine, audience = 'dashboard') {
    const open = get.openReports(machine.id).length;
    const fill = fillPercent(machine);
    // In de app tonen we geen vulgraad/"bijna leeg": dat is info voor de vulploeg.
    if (machine.status === 'defect') return { key: 'defect', label: 'Defect', short: 'Defect', color: 'rose', dot: '🔴', usable: false, open, fill };
    if (open > 0) return { key: 'gemeld', label: open === 1 ? 'Storing gemeld' : open + ' storingen gemeld', short: 'Gemeld', color: 'amber', dot: '🟠', usable: true, open, fill };
    if (audience !== 'app' && fill < CONFIG.lowFillPercent) return { key: 'laag', label: 'Bijna leeg', short: 'Bijna leeg', color: 'yellow', dot: '🟡', usable: true, open, fill };
    return { key: 'ok', label: 'Werkt', short: 'Werkt', color: 'emerald', dot: '🟢', usable: true, open, fill };
  }

  /** Geschatte loopafstand in meter tussen een positie {campusId, floor, x, y} en een automaat */
  function distance(pos, machine) {
    if (!pos || pos.campusId !== machine.campusId) return null;
    const dx = (machine.x - pos.x), dy = (machine.y - pos.y);
    const flat = Math.sqrt(dx * dx + dy * dy) * CONFIG.metersPerMapPercent;
    const floors = Math.abs(machine.floor - pos.floor);
    return Math.round(flat + floors * CONFIG.metersPerFloor);
  }
  function distanceLabel(pos, machine) {
    const d = distance(pos, machine);
    if (d === null) return '';
    const floorDiff = machine.floor - pos.floor;
    const walk = Math.max(1, Math.round(d / 70)); // ~70 m per minuut wandelen
    const where = floorDiff === 0 ? 'zelfde verdiep' : `${floorDiff > 0 ? '↑' : '↓'} ${get.floorName(machine.campusId, machine.floor)}`;
    return `${where} · ~${d} m · ${walk} min`;
  }

  /** Zoekt producten op naam, categorie of tag (accentongevoelig) */
  function matchProduct(product, query, tagFilter) {
    if (tagFilter && tagFilter.length && !tagFilter.every((t) => product.tags.includes(t))) return false;
    const q = norm(query);
    if (!q) return true;
    const hay = norm([product.name, CATEGORIES[product.category]?.label, product.category, ...product.tags].join(' '));
    return q.split(/\s+/).every((word) => hay.includes(word));
  }

  /** Geeft per automaat de producten die matchen en beschikbaar zijn */
  function matchingSlots(machine, query, tagFilter) {
    return machine.slots
      .map((s) => ({ slot: s, product: get.product(s.productId), avail: available(machine, s) }))
      .filter((x) => x.product && matchProduct(x.product, query, tagFilter));
  }

  function productStats(productId) {
    let machines = 0, stock = 0, capacity = 0;
    state.machines.filter((m) => !m.removed).forEach((m) => m.slots.forEach((s) => {
      if (s.productId === productId) { machines++; stock += s.qty; capacity += s.capacity; }
    }));
    return { machines, stock, capacity };
  }

  // ---------- Sessies / login ----------
  function currentUser(scope) {
    const id = safeGet(SESSION_KEYS[scope]);
    return id ? get.user(id) || null : null;
  }

  /**
   * MVP-login (géén echte beveiliging!):
   *  - demo-accounts met wachtwoord "demo"
   *  - elk nieuw @student.kdg.be adres → student, @kdg.be → personeel
   *  - dashboard enkel voor rol "operator"
   */
  function login(scope, email, password) {
    email = norm(email);
    if (!email || !password) return { ok: false, error: 'Vul je e-mail en wachtwoord in.' };
    let user = state.users.find((u) => norm(u.email) === email);
    if (user) {
      if (user.password !== password) return { ok: false, error: 'Wachtwoord klopt niet (demo-accounts: "demo").' };
    } else if (scope === 'app' && /@(student\.)?kdg\.be$/.test(email)) {
      if (password.length < 4) return { ok: false, error: 'Kies een wachtwoord van minstens 4 tekens.' };
      const local = email.split('@')[0].split(/[._-]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
      user = { id: uid('u'), name: local || email, email, password, role: email.endsWith('@student.kdg.be') ? 'student' : 'personeel', favorites: [] };
      state.users.push(user);
      log('👋', `Nieuwe gebruiker: ${user.name} (${ROLES[user.role].label})`);
      commit();
    } else if (scope === 'app') {
      return { ok: false, error: 'Gebruik je KdG-adres (@student.kdg.be of @kdg.be).' };
    } else {
      return { ok: false, error: 'Onbekend account.' };
    }
    if (ROLES[user.role].scope !== scope) {
      return { ok: false, error: scope === 'dashboard' ? 'Dit dashboard is enkel voor de vulploeg. Studenten gebruiken de app.' : 'Dit account is voor het dashboard van de vulploeg.' };
    }
    safeSet(SESSION_KEYS[scope], user.id);
    emit();
    return { ok: true, user };
  }
  function logout(scope) { safeRemove(SESSION_KEYS[scope]); emit(); }

  // ---------- Onderhoud: verlopen reservaties ----------
  function tick() {
    const now = Date.now();
    let changed = false;
    state.reservations.forEach((r) => {
      if (r.status === 'actief' && r.expiresAt <= now) {
        r.status = 'verlopen'; r.closedAt = now; r.fee = CONFIG.cancelFee; changed = true;
        const p = get.product(r.productId), m = get.machine(r.machineId);
        notify(r.userId, '⌛', `Je reservatie voor ${p?.name} in ${m?.code} is verlopen. Het product is weer vrij. Er wordt ${euro(CONFIG.cancelFee)} annulatiekost aangerekend${r.paid ? `, de rest (${euro(r.price - CONFIG.cancelFee)}) wordt teruggestort` : ''}.`);
        log('⌛', `Reservatie ${r.code} (${p?.name}, ${m?.code}) verlopen`);
      }
    });
    if (changed) commit();
  }

  // ---------- Acties: gebruikers (app) ----------
  function reportIssue(userId, machineId, issue, note) {
    const m = get.machine(machineId);
    if (!m) return { ok: false, error: 'Automaat niet gevonden.' };
    if (!ISSUE_TYPES[issue]) return { ok: false, error: 'Kies een probleem.' };
    const dup = state.reports.find((r) => r.machineId === machineId && r.userId === userId && r.issue === issue && r.status !== 'opgelost');
    if (dup) return { ok: false, error: 'Je hebt dit probleem al gemeld voor deze automaat. We houden je op de hoogte.' };
    const report = { id: uid('r'), machineId, issue, note: String(note || '').trim().slice(0, 500), userId, createdAt: Date.now(), updatedAt: Date.now(), status: 'open' };
    state.reports.unshift(report);
    log('⚠️', `Nieuwe melding voor ${m.code}: ${ISSUE_TYPES[issue].label.toLowerCase()}`);
    commit();
    return { ok: true, report };
  }

  function reserve(userId, machineId, slotCode, opts = {}) {
    tick();
    const m = get.machine(machineId);
    if (!m) return { ok: false, error: 'Automaat niet gevonden.' };
    if (m.status === 'defect') return { ok: false, error: 'Deze automaat is defect. Kies een andere automaat.' };
    const slot = m.slots.find((s) => s.code === slotCode);
    if (!slot) return { ok: false, error: 'Vak niet gevonden.' };
    if (available(m, slot) <= 0) return { ok: false, error: 'Net uitverkocht of al gereserveerd door iemand anders.' };
    const mine = state.reservations.filter((r) => r.userId === userId && r.status === 'actief');
    if (mine.length >= CONFIG.maxActiveReservations) return { ok: false, error: `Je kan maximaal ${CONFIG.maxActiveReservations} reservaties tegelijk hebben.` };
    const product = get.product(slot.productId);
    const now = Date.now();
    let code;
    do { code = String(Math.floor(1000 + Math.random() * 9000)); } while (state.reservations.some((r) => r.status === 'actief' && r.code === code));
    const res = { id: uid('res'), userId, machineId, slotCode, productId: product.id, price: product.price, code, createdAt: now, expiresAt: now + CONFIG.reservationMinutes * 60000, status: 'actief', paid: !!opts.payNow };
    state.reservations.unshift(res);
    log('🔖', `Reservatie ${code}: ${product.name} in ${m.code}${res.paid ? ' (online betaald)' : ''}`);
    commit();
    return { ok: true, reservation: res };
  }

  /** Annuleren is gratis zolang de reservatie jonger is dan CONFIG.freeCancelMinutes */
  function freeCancelUntil(r) { return r.createdAt + CONFIG.freeCancelMinutes * 60000; }
  function isFreeCancel(r, now = Date.now()) { return now < freeCancelUntil(r); }

  function cancelReservation(id, byUserId) {
    const r = state.reservations.find((x) => x.id === id);
    if (!r || r.status !== 'actief') return { ok: false, error: 'Deze reservatie is niet meer actief.' };
    if (byUserId && r.userId !== byUserId) return { ok: false, error: 'Niet jouw reservatie.' };
    r.status = 'geannuleerd'; r.closedAt = Date.now();
    // Gebruiker annuleert zelf → product lag opzij → annulatiekost,
    // behalve binnen de eerste 15 minuten. Annuleert de vulploeg: altijd gratis.
    r.fee = byUserId && !isFreeCancel(r) ? CONFIG.cancelFee : 0;
    const refund = r.paid ? r.price - r.fee : 0;
    log('↩️', `Reservatie ${r.code} geannuleerd${byUserId ? ` door gebruiker (kost ${euro(r.fee)})` : ' door vulploeg'}${r.paid ? ` · terugbetaald ${euro(refund)}` : ''}`);
    if (!byUserId) notify(r.userId, '↩️', `De vulploeg heeft je reservatie ${r.code} geannuleerd${r.paid ? ' en volledig terugbetaald' : ''}. Er wordt geen kost aangerekend.`);
    commit();
    return { ok: true, fee: r.fee, refund, paid: !!r.paid };
  }

  /** Simuleert het intikken van de code aan de automaat → product valt, voorraad −1 */
  function pickupReservation(id, enteredCode) {
    tick();
    const r = state.reservations.find((x) => x.id === id);
    if (!r || r.status !== 'actief') return { ok: false, error: 'Deze reservatie is niet meer actief.' };
    if (enteredCode !== undefined && String(enteredCode).trim() !== r.code) return { ok: false, error: 'Verkeerde code. Probeer opnieuw.' };
    const m = get.machine(r.machineId);
    const slot = m && m.slots.find((s) => s.code === r.slotCode);
    if (slot) slot.qty = Math.max(0, slot.qty - 1);
    r.status = 'opgehaald'; r.closedAt = Date.now();
    state.salesToday = (state.salesToday || 0) + 1;
    log('✅', `Reservatie ${r.code} opgehaald aan ${m?.code}`);
    commit();
    return { ok: true };
  }

  function addSuggestion(userId, campusId, name, category, note) {
    name = String(name || '').trim();
    if (name.length < 2) return { ok: false, error: 'Geef een productnaam op.' };
    const existing = state.suggestions.find((s) => s.campusId === campusId && norm(s.name) === norm(name));
    if (existing) {
      if (!existing.votes.includes(userId)) existing.votes.push(userId);
      commit();
      return { ok: true, suggestion: existing, merged: true };
    }
    const s = { id: uid('s'), campusId, name: name.slice(0, 60), category: CATEGORIES[category] ? category : 'snack', note: String(note || '').trim().slice(0, 200), userId, votes: [userId], status: 'nieuw', createdAt: Date.now() };
    state.suggestions.unshift(s);
    log('💡', `Nieuw productidee voor ${get.campus(campusId)?.short}: ${s.name}`);
    commit();
    return { ok: true, suggestion: s };
  }

  function toggleVote(suggestionId, userId) {
    const s = state.suggestions.find((x) => x.id === suggestionId);
    if (!s) return { ok: false };
    const i = s.votes.indexOf(userId);
    if (i >= 0) s.votes.splice(i, 1); else s.votes.push(userId);
    commit();
    return { ok: true, voted: i < 0 };
  }

  function toggleFavorite(userId, productId) {
    const u = get.user(userId);
    if (!u || !get.product(productId)) return { ok: false };
    u.favorites = u.favorites || [];
    const i = u.favorites.indexOf(productId);
    if (i >= 0) u.favorites.splice(i, 1); else u.favorites.push(productId);
    commit();
    return { ok: true, favorite: i < 0 };
  }

  function markNotificationsRead(userId) {
    let changed = false;
    state.notifications.forEach((n) => { if (n.userId === userId && !n.read) { n.read = true; changed = true; } });
    if (changed) commit();
  }

  // ---------- Acties: vulploeg (dashboard) ----------
  function setReportStatus(reportId, status, opts = {}) {
    const r = state.reports.find((x) => x.id === reportId);
    if (!r || !REPORT_STATUS[status]) return { ok: false };
    r.status = status; r.updatedAt = Date.now();
    const m = get.machine(r.machineId);
    if (status === 'behandeling') {
      log('🔧', `Melding ${m.code} (${ISSUE_TYPES[r.issue].label.toLowerCase()}) in behandeling`);
      notify(r.userId, '🔧', `De vulploeg bekijkt je melding over ${m.code}.`);
    }
    if (status === 'opgelost') {
      log('✅', `Melding ${m.code} opgelost`);
      notify(r.userId, '✅', `Je melding over ${m.code} (${ISSUE_TYPES[r.issue].label.toLowerCase()}) is opgelost. Bedankt!`);
      if (opts.machineOk && m.status === 'defect' && get.openReports(m.id).length === 0) m.status = 'ok';
    }
    commit();
    return { ok: true };
  }

  function setMachineStatus(machineId, status) {
    const m = get.machine(machineId);
    if (!m || !['ok', 'defect'].includes(status)) return { ok: false };
    m.status = status;
    log(status === 'defect' ? '🔴' : '🟢', `${m.code} op "${status === 'defect' ? 'defect' : 'werkt'}" gezet`);
    if (status === 'defect') {
      // actieve reservaties in een defecte automaat annuleren + gebruikers verwittigen
      state.reservations.filter((r) => r.machineId === machineId && r.status === 'actief').forEach((r) => {
        r.status = 'geannuleerd'; r.closedAt = Date.now();
        notify(r.userId, '🔴', `${m.code} is defect, je reservatie ${r.code} werd geannuleerd${r.paid ? ' en terugbetaald' : ''}. Zoek een andere automaat in de app.`);
      });
    }
    commit();
    return { ok: true };
  }

  function setSlotQty(machineId, slotCode, qty) {
    const m = get.machine(machineId); const s = m && m.slots.find((x) => x.code === slotCode);
    if (!s) return { ok: false };
    s.qty = Math.max(0, Math.min(s.capacity, Math.round(qty)));
    commit();
    return { ok: true };
  }

  function refillSlot(machineId, slotCode) {
    const m = get.machine(machineId); const s = m && m.slots.find((x) => x.code === slotCode);
    if (!s) return { ok: false };
    s.qty = s.capacity; m.lastRefill = Date.now();
    log('📦', `${m.code} vak ${s.code} bijgevuld (${get.product(s.productId)?.name})`);
    commit();
    return { ok: true };
  }

  function refillMachine(machineId) {
    const m = get.machine(machineId);
    if (!m) return { ok: false };
    const added = m.slots.reduce((a, s) => a + (s.capacity - s.qty), 0);
    m.slots.forEach((s) => { s.qty = s.capacity; });
    m.lastRefill = Date.now();
    log('📦', `${m.code} volledig bijgevuld (+${added} stuks)`);
    commit();
    return { ok: true, added };
  }

  function setSlotProduct(machineId, slotCode, productId) {
    const m = get.machine(machineId); const s = m && m.slots.find((x) => x.code === slotCode);
    const p = get.product(productId);
    if (!s || !p) return { ok: false };
    if (reservedCount(machineId, slotCode) > 0) return { ok: false, error: 'Er zijn actieve reservaties op dit vak.' };
    s.productId = productId; s.qty = 0;
    log('🔄', `${m.code} vak ${s.code} → ${p.name}`);
    commit();
    return { ok: true };
  }

  function addSlot(machineId, productId, capacity) {
    const m = get.machine(machineId); const p = get.product(productId);
    if (!m || !p) return { ok: false };
    if (m.slots.length >= 16) return { ok: false, error: 'Maximaal 16 vakken per automaat.' };
    const i = m.slots.length;
    const code = String.fromCharCode(65 + Math.floor(i / 4)) + ((i % 4) + 1);
    m.slots.push({ code, productId, qty: 0, capacity: Math.max(1, Number(capacity) || 8) });
    log('➕', `${m.code}: nieuw vak ${code} met ${p.name}`);
    commit();
    return { ok: true };
  }

  // ---------- Automaten beheren (vulploeg) ----------
  function nextMachineCode(campusId, floor) {
    const campus = get.campus(campusId);
    const prefix = 'K' + (campus?.short || campusId)[0].toUpperCase(); // bv. KG
    const fl = floor === 0.5 ? 'M' : String(Math.max(0, Math.floor(floor)));
    let n = 1, code;
    do { code = `${prefix}.${fl}${n}`; n++; } while (state.machines.some((m) => m.code === code));
    return code;
  }

  function addMachine(data) {
    const campus = get.campus(data.campusId);
    if (!campus || !campus.floors.some((f) => f.id === data.floor)) return { ok: false, error: 'Kies een geldig verdiep.' };
    if (!MACHINE_TYPES[data.type]) return { ok: false, error: 'Kies een type automaat.' };
    const location = String(data.location || '').trim();
    if (location.length < 2) return { ok: false, error: 'Geef een korte locatie op (bv. "Gang bij lokaal 204").' };
    const code = String(data.code || '').trim() || nextMachineCode(data.campusId, data.floor);
    if (state.machines.some((m) => m.code === code)) return { ok: false, error: `Code ${code} bestaat al.` };
    const id = code.replace(/[^A-Za-z0-9]/g, '') + '-' + Date.now().toString(36).slice(-4);
    const clamp = (v) => Math.max(2, Math.min(98, Math.round(v)));
    const machine = { id, code, campusId: data.campusId, floor: data.floor, location: location.slice(0, 80), type: data.type, x: clamp(data.x), y: clamp(data.y), status: 'ok', slots: [], lastRefill: Date.now() };
    state.machines.push(machine);
    log('➕', `Nieuwe automaat ${code} op ${get.floorName(data.campusId, data.floor)} (${location})`);
    commit();
    return { ok: true, machine };
  }

  function moveMachine(machineId, x, y, floor) {
    const m = get.machine(machineId);
    if (!m) return { ok: false };
    const clamp = (v) => Math.max(2, Math.min(98, Math.round(v)));
    m.x = clamp(x); m.y = clamp(y);
    if (floor !== undefined && get.campus(m.campusId).floors.some((f) => f.id === floor)) m.floor = floor;
    log('📍', `${m.code} verplaatst op de kaart (${get.floorName(m.campusId, m.floor)})`);
    commit();
    return { ok: true };
  }

  function updateMachine(machineId, data) {
    const m = get.machine(machineId);
    if (!m) return { ok: false };
    if (data.location !== undefined) { const l = String(data.location).trim(); if (l.length < 2) return { ok: false, error: 'Locatie is te kort.' }; m.location = l.slice(0, 80); }
    if (data.type && MACHINE_TYPES[data.type]) m.type = data.type;
    commit();
    return { ok: true };
  }

  function removeMachine(machineId) {
    const m = get.machine(machineId);
    if (!m) return { ok: false };
    state.reservations.filter((r) => r.machineId === machineId && r.status === 'actief').forEach((r) => {
      r.status = 'geannuleerd'; r.closedAt = Date.now(); r.fee = 0;
      notify(r.userId, '↩️', `Automaat ${m.code} werd weggehaald. Je reservatie ${r.code} is gratis geannuleerd${r.paid ? ' en terugbetaald' : ''}.`);
    });
    state.reports.filter((r) => r.machineId === machineId && r.status !== 'opgelost').forEach((r) => { r.status = 'opgelost'; r.updatedAt = Date.now(); });
    // niet echt wissen: oude reservaties/meldingen verwijzen er nog naar
    m.removed = true; m.removedAt = Date.now();
    log('🗑️', `Automaat ${m.code} verwijderd (${m.location})`);
    commit();
    return { ok: true };
  }

  function simulateSales(count = 5) {
    const candidates = [];
    state.machines.forEach((m) => { if (m.status !== 'defect' && !m.removed) m.slots.forEach((s) => { if (available(m, s) > 0) candidates.push([m, s]); }); });
    let sold = 0;
    for (let i = 0; i < count && candidates.length; i++) {
      const [m, s] = candidates[Math.floor(Math.random() * candidates.length)];
      if (available(m, s) > 0) { s.qty--; sold++; }
    }
    state.salesToday = (state.salesToday || 0) + sold;
    if (sold) log('🛒', `${sold} verkopen gesimuleerd`);
    commit();
    return { ok: true, sold };
  }

  function setSuggestionStatus(id, status) {
    const s = state.suggestions.find((x) => x.id === id);
    if (!s || !SUGGESTION_STATUS[status]) return { ok: false };
    s.status = status;
    const msg = {
      gepland: `Jouw idee "${s.name}" staat gepland voor ${get.campus(s.campusId)?.name} 🎉`,
      toegevoegd: `"${s.name}" ligt nu in de automaten van ${get.campus(s.campusId)?.name}! 🎉`,
      afgewezen: `Het idee "${s.name}" komt er voorlopig niet. Bedankt om mee te denken!`,
    }[status];
    if (msg) s.votes.forEach((u) => notify(u, '💡', msg));
    log('💡', `Idee "${s.name}" → ${SUGGESTION_STATUS[status].label.toLowerCase()}`);
    commit();
    return { ok: true };
  }

  function saveProduct(data) {
    const name = String(data.name || '').trim();
    if (name.length < 2) return { ok: false, error: 'Geef een naam op.' };
    const price = Math.round(Number(String(data.price).replace(',', '.')) * 100);
    if (!(price > 0)) return { ok: false, error: 'Geef een geldige prijs op.' };
    if (data.id) {
      const p = get.product(data.id);
      if (!p) return { ok: false };
      Object.assign(p, { name, price, icon: data.icon || p.icon, category: data.category || p.category, tags: data.tags || p.tags });
      log('🏷️', `Product aangepast: ${name} (${euro(price)})`);
    } else {
      const id = norm(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uid('p');
      if (get.product(id)) return { ok: false, error: 'Dit product bestaat al.' };
      state.products.push({ id, name, price, icon: data.icon || '🛒', category: data.category || 'snack', tags: data.tags || [], active: true });
      log('🏷️', `Nieuw product: ${name}`);
    }
    commit();
    return { ok: true };
  }

  function resetDemo() {
    state = seed();
    Object.values(SESSION_KEYS).forEach(safeRemove);
    commit();
  }

  // ---------- Init ----------
  load();
  tick();
  setInterval(tick, 10000);

  global.Vendo = {
    CONFIG, MACHINE_TYPES, CATEGORIES, TAGS, ISSUE_TYPES, REPORT_STATUS, SUGGESTION_STATUS, RESERVATION_STATUS, ROLES,
    get, subscribe, tick,
    util: { euro, esc, norm, timeAgo, clock, dateTime, duration },
    derive: { freeCancelUntil, isFreeCancel, reservedCount, available, fillPercent, emptySlots, lowSlots, machineState, distance, distanceLabel, matchProduct, matchingSlots, productStats },
    auth: { currentUser, login, logout },
    actions: {
      reportIssue, reserve, cancelReservation, pickupReservation, addSuggestion, toggleVote, toggleFavorite, markNotificationsRead,
      setReportStatus, setMachineStatus, setSlotQty, refillSlot, refillMachine, setSlotProduct, addSlot, simulateSales,
      setSuggestionStatus, saveProduct, resetDemo, addMachine, moveMachine, updateMachine, removeMachine,
    },
  };
})(window);
