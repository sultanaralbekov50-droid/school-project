/*
 * data.js — общий слой данных для сайта «Школьный Коворкинг».
 *
 * Два режима работы, страницы об этом не знают:
 *  - демо: данные в localStorage браузера (если config.js пустой);
 *  - Supabase: данные в базе (если в config.js указаны url и anonKey).
 *
 * Чтение (DB.schools(), DB.bookings()...) всегда синхронное, из кэша.
 * Кэш заполняет `await DB.init()`. Запись и вход — асинхронные (await).
 */
(function () {
  const cfg = window.SUPABASE_CONFIG || {};
  const REMOTE = !!(cfg.url && cfg.anonKey && window.supabase);
  if (cfg.url && !window.supabase) console.warn('Supabase настроен, но библиотека не загрузилась — включён демо-режим.');
  const sb = REMOTE ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;

  const ADMIN_DEMO = { login: 'admin', pass: 'admin123' }; // только для демо-режима
  const KEY = 'school_coworking_v2';
  const OPEN = 9;          // зал открыт с 9:00
  const CLOSE = 21;        // до 21:00
  const COMMISSION = 0.15; // пример: платформа берёт 15%, школа получает 85%

  const TYPES = { hall: 'Актовый зал', library: 'Библиотека', classroom: 'Класс' };
  const STATUS = { pending: 'Ожидает', approved: 'Подтверждено', rejected: 'Отклонено' };
  const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => iso(new Date());
  const addDays = (n, from) => { const d = from ? parse(from) : parse(today()); d.setDate(d.getDate() + n); return iso(d); };
  const fmtDate = s => { const d = parse(s); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear(); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- Стартовые демо-данные ---------- */
  function seed() {
    let n = 0;
    const E = (name, price) => ({ name, price: price || 0 }); // price — доплата за час, 0 = входит в цену
    const b = (schoolId, spaceId, off, start, hours, client, phone, purpose, status) =>
      ({ id: 'b' + (++n), schoolId, spaceId, date: addDays(off), start, hours, client, phone, purpose, status, created: Date.now() });
    return {
      schools: [
        { id: 'school1', name: 'Школа №1 им. Пушкина', district: 'Первомайский район', login: 'school1', pass: '12345',
          spaces: [
            { id: 's1-hall', type: 'hall', name: 'Актовый зал', capacity: 50, price: 500,
              equipment: [E('Проектор и экран'), E('Звуковая система с 2 микрофонами', 100), E('Пианино', 150), E('Сцена и свет', 100), E('Wi-Fi')] },
            { id: 's1-lib', type: 'library', name: 'Библиотека', capacity: 15, price: 200,
              equipment: [E('Wi-Fi'), E('Флипчарт'), E('Проектор', 50), E('Кулер с водой')] }
          ] },
        { id: 'school2', name: 'Гимназия №5', district: 'Ленинский район', login: 'school2', pass: '12345',
          spaces: [
            { id: 's2-hall', type: 'hall', name: 'Актовый зал', capacity: 80, price: 600,
              equipment: [E('Проектор и экран'), E('Звуковая система', 120), E('Сцена и свет', 150), E('Wi-Fi')] },
            { id: 's2-class', type: 'classroom', name: 'Кабинет информатики', capacity: 20, price: 300,
              equipment: [E('Интерактивная доска'), E('15 компьютеров'), E('Проектор'), E('Wi-Fi')] }
          ] },
        { id: 'school3', name: 'Лицей №61', district: 'Октябрьский район', login: 'school3', pass: '12345',
          spaces: [
            { id: 's3-hall', type: 'hall', name: 'Большой зал', capacity: 120, price: 700,
              equipment: [E('Проектор и экран'), E('Музыкальная аппаратура (усилители, синтезатор)', 200), E('Сцена и свет', 150), E('Кондиционер')] },
            { id: 's3-lib', type: 'library', name: 'Читальный зал', capacity: 20, price: 250,
              equipment: [E('Wi-Fi'), E('Интерактивная доска', 80), E('Флипчарт')] }
          ] }
      ],
      bookings: [
        b('school1', 's1-hall', 0, 16, 2, 'Айбек', '0555 123 456', 'Мастер-класс по рисованию', 'approved'),
        b('school1', 's1-hall', 1, 10, 3, 'Мария', '0700 222 333', 'Интенсив для репетиторов', 'approved'),
        b('school1', 's1-hall', 2, 17, 2, 'Студия «Ритм»', '0777 111 222', 'Репетиция танцев', 'pending'),
        b('school1', 's1-hall', 4, 18, 3, 'Нурлан', '0500 444 555', 'Вечер настольных игр', 'approved'),
        b('school1', 's1-hall', 5, 11, 4, 'Клуб «Старт»', '0555 987 654', 'Лекция для студентов', 'approved'),
        b('school1', 's1-lib', 1, 15, 2, 'Мария', '0700 222 333', 'Занятие по английскому', 'approved'),
        b('school1', 's1-lib', 3, 9, 2, 'Эрлан', '0709 333 111', 'Подготовка к ОРТ', 'pending'),
        b('school2', 's2-hall', 1, 18, 2, 'Театр «Маска»', '0555 765 432', 'Репетиция', 'approved'),
        b('school2', 's2-class', 2, 14, 3, 'IT-курсы Alpha', '0770 555 666', 'Курс по Python', 'approved'),
        b('school3', 's3-hall', 3, 17, 3, 'Лига дебатов', '0555 321 000', 'Турнир', 'approved')
      ],
      applications: [
        { id: 'a1', school: 'Гимназия №12', director: 'Бекова Айгуль Осмоновна', phone: '+996 555 000 111',
          email: 'gym12@mail.com', status: 'new', created: Date.now() }
      ]
    };
  }

  /* ---------- Хранилище (заменить на Supabase) ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* localStorage недоступен — работаем с демо-данными */ }
    const s = seed();
    save(s);
    return s;
  }
  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    mem = d;
  }
  let mem = null;
  let state = { email: null, isAdmin: false, schoolId: null };
  const data = () => (REMOTE ? mem : load());

  /* ---------- Supabase: загрузка и сопоставление полей ---------- */
  const toBooking = r => ({
    id: r.id, schoolId: r.school_id, spaceId: r.space_id, date: r.booking_date,
    start: r.start_hour, hours: r.hours, client: r.client || '', phone: r.phone || '',
    purpose: r.purpose || '', extras: r.extras || [], status: r.status, created: r.created_at
  });

  async function loadState() {
    state = { email: null, isAdmin: false, schoolId: null };
    if (!REMOTE) {
      try {
        state.isAdmin = sessionStorage.getItem('sc_admin') === '1';
        state.schoolId = sessionStorage.getItem('sc_school');
      } catch (e) { /* ignore */ }
      return;
    }
    const { data: sess } = await sb.auth.getSession();
    const user = sess && sess.session && sess.session.user;
    if (!user) return;
    state.email = user.email;
    const [adm, own] = await Promise.all([sb.rpc('is_admin'), sb.rpc('my_school_ids')]);
    state.isAdmin = adm.data === true;
    state.schoolId = (own.data && own.data[0]) || null;
  }

  async function loadRemote() {
    const base = await Promise.all([
      sb.from('schools').select('id,name,district').order('created_at'),
      sb.from('spaces').select('*'),
      sb.from('busy_slots').select('*')
    ]);
    const bad = base.find(r => r.error);
    if (bad) throw new Error(bad.error.message);
    const [sch, sp, busy] = base.map(r => r.data);

    let full = [], owners = [], apps = [];
    if (state.schoolId || state.isAdmin) {
      const r = await sb.from('bookings').select('*');
      if (!r.error) full = r.data;
    }
    if (state.isAdmin) {
      const [o, a] = await Promise.all([
        sb.from('school_owners').select('*'),
        sb.from('applications').select('*').order('created_at')
      ]);
      if (!o.error) owners = o.data;
      if (!a.error) apps = a.data;
    }

    const byId = {};
    busy.forEach(r => { byId[r.id] = toBooking(r); });
    full.forEach(r => { byId[r.id] = toBooking(r); });

    mem = {
      schools: sch.map(s => ({
        id: s.id, name: s.name, district: s.district,
        login: (owners.find(o => o.school_id === s.id) || {}).email || '',
        pass: null,
        spaces: sp.filter(x => x.school_id === s.id).map(x => ({
          id: x.id, type: x.type, name: x.name, capacity: x.capacity, price: x.price, equipment: x.equipment || []
        }))
      })),
      bookings: Object.values(byId),
      applications: apps.map(a => ({
        id: a.id, school: a.school, director: a.director, phone: a.phone, email: a.email,
        status: a.status, schoolId: a.school_id, created: a.created_at
      }))
    };
  }

  /* ---------- API ---------- */
  const DB = {
    mode: REMOTE ? 'remote' : 'local',
    OPEN, CLOSE, COMMISSION, TYPES, STATUS,

    /* Загрузка данных и сессии. Вызывать один раз при старте страницы. */
    async init() {
      await loadState();
      if (REMOTE) await loadRemote(); else mem = load();
      return DB;
    },
    async refresh() {
      if (REMOTE) await loadRemote(); else mem = load();
    },
    session: () => state,

    /* Вход */
    async loginSchool(login, pass) {
      if (!REMOTE) {
        const found = load().schools.find(s => s.login === login && s.pass === pass);
        if (!found) return { ok: false, error: 'Неверный логин или пароль.' };
        try { sessionStorage.setItem('sc_school', found.id); } catch (e) { /* ignore */ }
        state.schoolId = found.id;
        return { ok: true };
      }
      const { error } = await sb.auth.signInWithPassword({ email: login, password: pass });
      if (error) return { ok: false, error: 'Неверный email или пароль.' };
      await DB.init();
      if (!state.schoolId) {
        await sb.auth.signOut();
        await loadState();
        return { ok: false, error: 'Для этого email школа ещё не подключена. Дождитесь одобрения заявки.' };
      }
      return { ok: true };
    },
    async registerDirector(email, pass) {
      if (!REMOTE) return { ok: false, error: 'Регистрация работает только при подключённой базе данных.' };
      const { data: res, error } = await sb.auth.signUp({ email, password: pass });
      if (error) return { ok: false, error: error.message };
      if (!res.session) return { ok: true, confirm: true };
      return DB.loginSchool(email, pass);
    },
    async loginAdmin(login, pass) {
      if (!REMOTE) {
        if (login !== ADMIN_DEMO.login || pass !== ADMIN_DEMO.pass) return { ok: false, error: 'Неверный логин или пароль.' };
        try { sessionStorage.setItem('sc_admin', '1'); } catch (e) { /* ignore */ }
        state.isAdmin = true;
        return { ok: true };
      }
      const { error } = await sb.auth.signInWithPassword({ email: login, password: pass });
      if (error) return { ok: false, error: 'Неверный email или пароль.' };
      await DB.init();
      if (!state.isAdmin) {
        await sb.auth.signOut();
        await loadState();
        return { ok: false, error: 'Этот аккаунт не является администратором.' };
      }
      return { ok: true };
    },
    async logout() {
      if (REMOTE) await sb.auth.signOut();
      try { sessionStorage.removeItem('sc_admin'); sessionStorage.removeItem('sc_school'); } catch (e) { /* ignore */ }
      state = { email: null, isAdmin: false, schoolId: null };
    },

    today, addDays, fmtDate, esc,
    typeLabel: t => TYPES[t] || t,
    statusLabel: s => STATUS[s] || s,

    schools: () => data().schools,
    school: id => data().schools.find(s => s.id === id),
    findSpace(spaceId) {
      for (const school of data().schools) {
        const space = school.spaces.find(x => x.id === spaceId);
        if (space) return { school, space };
      }
      return null;
    },

    bookings(filter) {
      let list = data().bookings.slice();
      if (filter && filter.schoolId) list = list.filter(x => x.schoolId === filter.schoolId);
      if (filter && filter.spaceId) list = list.filter(x => x.spaceId === filter.spaceId);
      return list.sort((a, b) => (a.date + pad(a.start)).localeCompare(b.date + pad(b.start)));
    },

    equipmentPrice: extras => (extras || []).reduce((n, x) => n + (x.price || 0), 0),
    bookingTotal(b) {
      const f = DB.findSpace(b.spaceId);
      return f ? b.hours * (f.space.price + DB.equipmentPrice(b.extras)) : 0;
    },
    equipText: space => (space.equipment || []).map(x => esc(x.name) + (x.price ? ' (+' + x.price + ')' : '')).join(', ') || '—',

    isFree(spaceId, date, start, hours) {
      if (start < OPEN || start + hours > CLOSE) return false;
      return !data().bookings.some(x =>
        x.spaceId === spaceId && x.date === date && x.status !== 'rejected' &&
        start < x.start + x.hours && x.start < start + hours);
    },

    async addBooking(o) {
      const found = DB.findSpace(o.spaceId);
      if (!found) return { ok: false, error: 'Пространство не найдено' };
      if (!DB.isFree(o.spaceId, o.date, o.start, o.hours)) return { ok: false, error: 'Это время уже занято. Выберите другое.' };
      if (REMOTE) {
        const { error } = await sb.from('bookings').insert({
          school_id: found.school.id, space_id: o.spaceId, booking_date: o.date,
          start_hour: o.start, hours: o.hours, client: o.client, phone: o.phone,
          purpose: o.purpose || '', extras: o.extras || [], status: 'pending'
        });
        if (error) {
          await DB.refresh();
          return { ok: false, error: error.code === '23P01' ? 'Это время уже занято. Выберите другое.' : 'Не удалось отправить заявку. Попробуйте ещё раз.' };
        }
        await DB.refresh();
        return { ok: true };
      }
      const d = data();
      const booking = Object.assign({ id: uid('b'), schoolId: found.school.id, status: 'pending', created: Date.now() }, o);
      d.bookings.push(booking);
      save(d);
      return { ok: true, booking };
    },

    async setStatus(id, status) {
      if (REMOTE) {
        const { error } = await sb.from('bookings').update({ status }).eq('id', id);
        await DB.refresh();
        return { ok: !error, error: error && 'Не удалось изменить статус.' };
      }
      const d = data();
      const b = d.bookings.find(x => x.id === id);
      if (b) { b.status = status; save(d); }
    },

    applications: () => data().applications,
    async addApplication(o) {
      if (REMOTE) {
        const { error } = await sb.from('applications').insert({
          school: o.school, director: o.director, phone: o.phone, email: o.email.trim().toLowerCase()
        });
        return { ok: !error, error: error && 'Не удалось отправить заявку. Попробуйте ещё раз.' };
      }
      const d = data();
      d.applications.push(Object.assign({ id: uid('a'), status: 'new', created: Date.now() }, o));
      save(d);
      return { ok: true };
    },
    async approveApplication(id) {
      if (REMOTE) {
        const app = DB.applications().find(x => x.id === id);
        const { error } = await sb.rpc('approve_application', { app_id: id });
        if (error) return null;
        await DB.refresh();
        const upd = DB.applications().find(x => x.id === id);
        const school = upd && DB.school(upd.schoolId);
        return school ? Object.assign({}, school, { login: app ? app.email.toLowerCase() : '', pass: null }) : null;
      }
      const d = data();
      const app = d.applications.find(x => x.id === id);
      if (!app) return null;
      let n = d.schools.length + 1;
      while (d.schools.some(s => s.id === 'school' + n)) n++;
      const sid = 'school' + n;
      const school = {
        id: sid, name: app.school, district: 'Бишкек', login: sid,
        pass: String(Math.floor(10000 + Math.random() * 90000)),
        spaces: [
          { id: sid + '-hall', type: 'hall', name: 'Актовый зал', capacity: 50, price: 500,
            equipment: [{ name: 'Проектор и экран', price: 0 }, { name: 'Wi-Fi', price: 0 }] },
          { id: sid + '-lib', type: 'library', name: 'Библиотека', capacity: 15, price: 200,
            equipment: [{ name: 'Wi-Fi', price: 0 }] }
        ]
      };
      d.schools.push(school);
      app.status = 'approved';
      app.schoolId = sid;
      save(d);
      return school;
    },
    async rejectApplication(id) {
      if (REMOTE) {
        await sb.from('applications').update({ status: 'rejected' }).eq('id', id);
        await DB.refresh();
        return;
      }
      const d = data();
      const app = d.applications.find(x => x.id === id);
      if (app) { app.status = 'rejected'; save(d); }
    },

    async reset() { if (!REMOTE) save(seed()); }
  };

  /* ---------- Недельный календарь занятости ---------- */
  function dayLabel(dateStr, compact) {
    const d = parse(dateStr);
    return compact ? DAYS[d.getDay()] : DAYS[d.getDay()] + ' ' + pad(d.getDate()) + '.' + pad(d.getMonth() + 1);
  }

  DB.renderWeek = function (el, spaceId, startISO, opts) {
    opts = opts || {};
    const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(i, startISO));
    const map = {};
    DB.bookings({ spaceId }).forEach(b => {
      if (b.status === 'rejected') return;
      for (let h = b.start; h < b.start + b.hours; h++) map[b.date + '|' + h] = b;
    });
    let html = '<table class="wk' + (opts.compact ? ' compact' : '') + '"><thead><tr><th></th>' +
      days.map(d => '<th>' + dayLabel(d, opts.compact) + '</th>').join('') + '</tr></thead><tbody>';
    for (let h = OPEN; h < CLOSE; h++) {
      html += '<tr><td class="h">' + h + ':00</td>';
      days.forEach(d => {
        const b = map[d + '|' + h];
        if (!b) { html += '<td class="c" title="Свободно"></td>'; return; }
        const cls = b.status === 'pending' ? 'pending' : 'busy';
        let text = '', title = 'Занято';
        if (opts.details) {
          title = b.client + ' — ' + b.purpose + ' (' + STATUS[b.status] + ')';
          if (h === b.start) text = esc(b.client);
        }
        html += '<td class="c ' + cls + '" title="' + esc(title) + '">' + text + '</td>';
      });
      html += '</tr>';
    }
    el.innerHTML = html + '</tbody></table>';
  };

  window.DB = DB;
})();
