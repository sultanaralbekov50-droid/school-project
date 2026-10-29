-- =====================================================================
-- Школьный Коворкинг: схема базы данных для Supabase
-- Вставьте весь файл в Supabase → SQL Editor → New query → Run.
-- Скрипт можно запускать повторно только на пустом проекте.
-- =====================================================================

create extension if not exists btree_gist;

-- ---------- Таблицы ----------

create table schools (
  id          text primary key,
  name        text not null,
  district    text not null default 'Бишкек',
  created_at  timestamptz not null default now()
);

-- Кто из директоров управляет школой (email хранится отдельно, чтобы он не был виден всем)
create table school_owners (
  school_id   text not null references schools(id) on delete cascade,
  email       text not null,
  primary key (school_id, email)
);

create table spaces (
  id          text primary key,
  school_id   text not null references schools(id) on delete cascade,
  type        text not null check (type in ('hall', 'library', 'classroom')),
  name        text not null,
  capacity    int  not null default 20 check (capacity > 0),
  price       int  not null default 0 check (price >= 0),
  -- [{"name": "Проектор", "price": 0}, {"name": "Звук", "price": 100}]  price = доплата за час
  equipment   jsonb not null default '[]'
);

create table bookings (
  id            uuid primary key default gen_random_uuid(),
  school_id     text not null references schools(id) on delete cascade,
  space_id      text not null references spaces(id) on delete cascade,
  booking_date  date not null,
  start_hour    int  not null check (start_hour between 9 and 20),
  hours         int  not null check (hours between 1 and 4),
  client        text not null check (length(client) between 1 and 100),
  phone         text not null check (length(phone) between 1 and 40),
  purpose       text not null default '' check (length(purpose) <= 300),
  extras        jsonb not null default '[]',
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now(),
  check (start_hour + hours <= 21),
  -- База сама не даст занять один и тот же час дважды
  constraint no_overlap exclude using gist (
    space_id with =,
    booking_date with =,
    int4range(start_hour, start_hour + hours) with &&
  ) where (status <> 'rejected')
);

create table applications (
  id          uuid primary key default gen_random_uuid(),
  school      text not null check (length(school) between 1 and 200),
  director    text not null check (length(director) between 1 and 200),
  phone       text not null check (length(phone) between 1 and 40),
  email       text not null check (length(email) between 3 and 200),
  status      text not null default 'new' check (status in ('new', 'approved', 'rejected')),
  school_id   text references schools(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Главные администраторы (по email)
create table admins (
  email text primary key
);

-- ---------- Публичный календарь без персональных данных ----------
-- Гости видят только «занято/свободно», но не имена и телефоны клиентов.
create view busy_slots as
  select id, school_id, space_id, booking_date, start_hour, hours, status
  from bookings
  where status <> 'rejected';

grant select on busy_slots to anon, authenticated;

-- ---------- Вспомогательные функции ----------

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function my_school_ids() returns setof text
language sql stable security definer set search_path = public as $$
  select school_id from school_owners where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- Подключение школы одним действием: школа + доступ директора + два пространства
create or replace function approve_application(app_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  a   applications%rowtype;
  sid text;
begin
  if not is_admin() then raise exception 'Только для администратора'; end if;
  select * into a from applications where id = app_id;
  if not found then raise exception 'Заявка не найдена'; end if;

  sid := 'school-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  insert into schools (id, name) values (sid, a.school);
  insert into school_owners (school_id, email) values (sid, lower(a.email));
  insert into spaces (id, school_id, type, name, capacity, price, equipment) values
    (sid || '-hall', sid, 'hall',    'Актовый зал', 50, 500, '[{"name":"Проектор и экран","price":0},{"name":"Wi-Fi","price":0}]'),
    (sid || '-lib',  sid, 'library', 'Библиотека',  15, 200, '[{"name":"Wi-Fi","price":0}]');
  update applications set status = 'approved', school_id = sid where id = app_id;
  return sid;
end $$;

-- ---------- Права доступа (Row Level Security) ----------

alter table schools       enable row level security;
alter table school_owners enable row level security;
alter table spaces        enable row level security;
alter table bookings      enable row level security;
alter table applications  enable row level security;
alter table admins        enable row level security;   -- без политик: доступ только через is_admin()

-- Школы и пространства видят все, меняет админ (пространства — ещё и директор своей школы)
create policy "schools: read all"   on schools for select using (true);
create policy "schools: admin"      on schools for all to authenticated using (is_admin()) with check (is_admin());

create policy "spaces: read all"    on spaces for select using (true);
create policy "spaces: owner/admin" on spaces for all to authenticated
  using      (is_admin() or school_id in (select my_school_ids()))
  with check (is_admin() or school_id in (select my_school_ids()));

create policy "owners: admin"       on school_owners for all to authenticated using (is_admin()) with check (is_admin());

-- Бронирования: любой гость может отправить заявку, но только со статусом «ожидает»
-- и только для школы, которой принадлежит выбранное пространство
create policy "bookings: guests create" on bookings for insert to anon, authenticated
  with check (
    status = 'pending'
    and school_id = (select s.school_id from spaces s where s.id = space_id)
  );
-- Читать и менять детали заявок может только директор своей школы и админ
create policy "bookings: read own"   on bookings for select to authenticated
  using (is_admin() or school_id in (select my_school_ids()));
create policy "bookings: update own" on bookings for update to authenticated
  using      (is_admin() or school_id in (select my_school_ids()))
  with check (is_admin() or school_id in (select my_school_ids()));
create policy "bookings: delete"     on bookings for delete to authenticated using (is_admin());

-- Заявки школ: отправлять может любой, читать и обрабатывать — только админ
create policy "applications: guests create" on applications for insert to anon, authenticated
  with check (status = 'new' and school_id is null);
create policy "applications: admin"         on applications for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- Права на таблицы (GRANT) ----------
-- В проекте выключено «Automatically expose new tables», поэтому доступ для
-- ролей anon (гость) и authenticated (вошедший) выдаём вручную и только нужный.
-- Строки при этом всё равно фильтруют правила RLS выше.

grant usage on schema public to anon, authenticated;

grant select                         on schools, spaces to anon, authenticated;
grant insert                         on bookings, applications to anon, authenticated;

grant select, update, delete         on bookings, applications to authenticated;
grant insert, update, delete         on schools, spaces to authenticated;
grant select, insert, update, delete on school_owners to authenticated;

grant execute on function is_admin()               to authenticated;
grant execute on function my_school_ids()          to authenticated;
grant execute on function approve_application(uuid) to authenticated;

-- ---------- Демо-данные ----------

insert into schools (id, name, district) values
  ('school1', 'Школа №1 им. Пушкина', 'Первомайский район'),
  ('school2', 'Гимназия №5',          'Ленинский район'),
  ('school3', 'Лицей №61',            'Октябрьский район');

insert into spaces (id, school_id, type, name, capacity, price, equipment) values
  ('s1-hall',  'school1', 'hall',      'Актовый зал',         50,  500, '[{"name":"Проектор и экран","price":0},{"name":"Звуковая система с 2 микрофонами","price":100},{"name":"Пианино","price":150},{"name":"Сцена и свет","price":100},{"name":"Wi-Fi","price":0}]'),
  ('s1-lib',   'school1', 'library',   'Библиотека',          15,  200, '[{"name":"Wi-Fi","price":0},{"name":"Флипчарт","price":0},{"name":"Проектор","price":50},{"name":"Кулер с водой","price":0}]'),
  ('s2-hall',  'school2', 'hall',      'Актовый зал',         80,  600, '[{"name":"Проектор и экран","price":0},{"name":"Звуковая система","price":120},{"name":"Сцена и свет","price":150},{"name":"Wi-Fi","price":0}]'),
  ('s2-class', 'school2', 'classroom', 'Кабинет информатики', 20,  300, '[{"name":"Интерактивная доска","price":0},{"name":"15 компьютеров","price":0},{"name":"Проектор","price":0},{"name":"Wi-Fi","price":0}]'),
  ('s3-hall',  'school3', 'hall',      'Большой зал',        120,  700, '[{"name":"Проектор и экран","price":0},{"name":"Музыкальная аппаратура (усилители, синтезатор)","price":200},{"name":"Сцена и свет","price":150},{"name":"Кондиционер","price":0}]'),
  ('s3-lib',   'school3', 'library',   'Читальный зал',       20,  250, '[{"name":"Wi-Fi","price":0},{"name":"Интерактивная доска","price":80},{"name":"Флипчарт","price":0}]');

insert into bookings (school_id, space_id, booking_date, start_hour, hours, client, phone, purpose, status) values
  ('school1', 's1-hall',  current_date + 0, 16, 2, 'Айбек',          '0555 123 456', 'Мастер-класс по рисованию', 'approved'),
  ('school1', 's1-hall',  current_date + 1, 10, 3, 'Мария',          '0700 222 333', 'Интенсив для репетиторов',  'approved'),
  ('school1', 's1-hall',  current_date + 2, 17, 2, 'Студия «Ритм»',  '0777 111 222', 'Репетиция танцев',          'pending'),
  ('school1', 's1-hall',  current_date + 4, 18, 3, 'Нурлан',         '0500 444 555', 'Вечер настольных игр',      'approved'),
  ('school1', 's1-lib',   current_date + 1, 15, 2, 'Мария',          '0700 222 333', 'Занятие по английскому',    'approved'),
  ('school2', 's2-hall',  current_date + 1, 18, 2, 'Театр «Маска»',  '0555 765 432', 'Репетиция',                 'approved'),
  ('school2', 's2-class', current_date + 2, 14, 3, 'IT-курсы Alpha', '0770 555 666', 'Курс по Python',            'approved'),
  ('school3', 's3-hall',  current_date + 3, 17, 3, 'Лига дебатов',   '0555 321 000', 'Турнир',                    'approved');

-- ---------- ПОСЛЕ запуска: сделайте себя администратором ----------
-- 1) Authentication → Users → Add user (ваш email и пароль)
-- 2) Выполните, подставив свой email:
-- insert into admins (email) values ('ваш_email@example.com');
