/**
 * Версия игры и дата сборки.
 * Значения подставляет Vite через define (см. vite.config.ts):
 * версия — из package.json, дата — на момент запуска dev-сервера или сборки.
 */

declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string; // ISO-дата, YYYY-MM-DD

export const GAME_VERSION = __APP_VERSION__;
export const BUILD_DATE = __APP_BUILD_DATE__;

/** ISO-дата сборки (YYYY-MM-DD) → «ДД.ММ.ГГГГ». Неожиданный формат возвращается как есть. */
export function formatBuildDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}.${month}.${year}`;
}
