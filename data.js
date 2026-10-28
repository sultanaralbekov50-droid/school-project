/*
 * data.js — общий слой данных для сайта «Школьный Коворкинг».
 *
 * СЕЙЧАС: данные хранятся в localStorage браузера (демо-режим, без сервера).
 * ПОТОМ: все обращения к данным идут через объект DB, поэтому для подключения
 * Supabase достаточно переписать функции внутри DB (load/save, addBooking,
 * setStatus, addApplication...) — страницы менять не придётся.
 */
(function () {
  const KEY = 'school_coworking_v1';
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
    const b = (schoolId, spaceId, off, start, hours, client, phone, purpose, status) =>
      ({ id: 'b' + (++n), schoolId, spaceId, date: addDays(off), start, hours, client, phone, purpose, status, created: Date.now() });
    return {
      schools: [
        { id: 'school1', name: 'Школа №1 им. Пушкина', district: 'Первомайский район', login: 'school1', pass: '12345',
          spaces: [
            { id: 's1-hall', type: 'hall', name: 'Актовый зал', capacity: 50, price: 500 },
            { id: 's1-lib', type: 'library', name: 'Библиотека', capacity: 15, price: 200 }
          ] },
        { id: 'school2', name: 'Гимназия №5', district: 'Ленинский район', login: 'school2', pass: '12345',
          spaces: [
            { id: 's2-hall', type: 'hall', name: 'Актовый зал', capacity: 80, price: 600 },
            { id: 's2-class', type: 'classroom', name: 'Кабинет информатики', capacity: 20, price: 300 }
          ] },
        { id: 'school3', name: 'Лицей №61', district: 'Октябрьский район', login: 'school3', pass: '12345',
          spaces: [
            { id: 's3-hall', type: 'hall', name: 'Большой зал', capacity: 120, price: 700 },
            { id: 's3-lib', type: 'library', name: 'Читальный зал', capacity: 20, price: 250 }
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
  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
    mem = data;
  }
  let mem = null;
  const data = () => (mem = load());

  /* ---------- API ---------- */
  const DB = {
    OPEN, CLOSE, COMMISSION, TYPES, STATUS,
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

    isFree(spaceId, date, start, hours) {
      if (start < OPEN || start + hours > CLOSE) return false;
      return !data().bookings.some(x =>
        x.spaceId === spaceId && x.date === date && x.status !== 'rejected' &&
        start < x.start + x.hours && x.start < start + hours);
    },

    addBooking(o) {
      const found = DB.findSpace(o.spaceId);
      if (!found) return { ok: false, error: 'Пространство не найдено' };
      if (!DB.isFree(o.spaceId, o.date, o.start, o.hours)) return { ok: false, error: 'Это время уже занято. Выберите другое.' };
      const d = data();
      const booking = Object.assign({ id: uid('b'), schoolId: found.school.id, status: 'pending', created: Date.now() }, o);
      d.bookings.push(booking);
      save(d);
      return { ok: true, booking };
    },

    setStatus(id, status) {
      const d = data();
      const b = d.bookings.find(x => x.id === id);
      if (b) { b.status = status; save(d); }
    },

    applications: () => data().applications,
    addApplication(o) {
      const d = data();
      d.applications.push(Object.assign({ id: uid('a'), status: 'new', created: Date.now() }, o));
      save(d);
    },
    approveApplication(id) {
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
          { id: sid + '-hall', type: 'hall', name: 'Актовый зал', capacity: 50, price: 500 },
          { id: sid + '-lib', type: 'library', name: 'Библиотека', capacity: 15, price: 200 }
        ]
      };
      d.schools.push(school);
      app.status = 'approved';
      app.schoolId = sid;
      save(d);
      return school;
    },
    rejectApplication(id) {
      const d = data();
      const app = d.applications.find(x => x.id === id);
      if (app) { app.status = 'rejected'; save(d); }
    },

    reset() { save(seed()); }
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
