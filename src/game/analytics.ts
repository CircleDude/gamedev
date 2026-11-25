/**
 * Аналитика Яндекс.Метрики: единая точка отправки целей.
 * Счётчик подключается в index.html, здесь — только вызовы reachGoal,
 * чтобы игровой код не зависел от деталей Метрики.
 */
import { GAME_VERSION } from './version';

type Params = Record<string, string | number | boolean>;
type Metrika = (id: number, method: 'reachGoal', goal: string, params: Params) => void;

/** Номер счётчика Метрики (тот же, что в index.html). */
const COUNTER_ID = 114661714;

/**
 * Отправляет цель в Яндекс.Метрику.
 * В dev-режиме событие дублируется в консоль, чтобы не ждать отчёта.
 * Ошибки аналитики не должны ломать игру — поэтому try/catch.
 */
export function track(event: string, params: Params = {}): void {
  const data = { ...params, game_version: GAME_VERSION };
  if (import.meta.env.DEV) console.log('[analytics]', event, data);

  const ym = (window as Window & { ym?: Metrika }).ym;
  if (typeof ym !== 'function') return;

  try {
    ym(COUNTER_ID, 'reachGoal', event, data);
  } catch (error) {
    console.warn('Analytics error', error);
  }
}
