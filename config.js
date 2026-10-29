/*
 * Настройки Supabase.
 * Вставьте Project URL и anon public key:
 * Supabase → Project Settings → API.
 *
 * Пока поля пустые, сайт работает в демо-режиме (данные хранятся в браузере).
 *
 * ВАЖНО: ключ anon (public) можно хранить в коде, он рассчитан на браузер,
 * а защиту данных обеспечивают правила RLS из schema.sql.
 * Ключ service_role сюда вставлять НЕЛЬЗЯ.
 */
window.SUPABASE_CONFIG = {
  url: '',      // например: 'https://abcdxyz.supabase.co'
  anonKey: ''   // длинный ключ, начинается с 'eyJ...'
};
