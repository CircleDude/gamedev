/**
 * Ручной шаг Matter-движка — общий хелпер для сцен с физикой.
 * Runner Phaser 4 передаёт в движок время в неверных единицах (физика
 * ускоряется), поэтому каждая сцена отключает автообновление мира и шагает
 * движок сама с реальной дельтой кадра.
 */

import Phaser from 'phaser';

/**
 * Модуль MatterJS (в рантайме Phaser.Physics.Matter.Matter, в типах не описан).
 */
const Matter = (
  Phaser.Physics.Matter as unknown as {
    Matter: {
      Engine: { update(engine: unknown, delta: number): void };
      Resolver: { _restingThresh: number };
    };
  }
).Matter;

/** Отключает автообновление мира Phaser Runner'ом — шагаем вручную в update(). */
export function disableMatterAutoUpdate(scene: Phaser.Scene): void {
  (scene.matter.world as unknown as { autoUpdate: boolean }).autoUpdate = false;
}

/** Ручной шаг Matter-движка с реальной дельтой кадра. */
export function stepMatterWorld(scene: Phaser.Scene, delta: number): void {
  Matter.Engine.update((scene.matter.world as unknown as { engine: unknown }).engine, delta);
}

/** Разрешает мелкие отскоки: стандартный порог Matter (~4) заставляет тела «прилипать». */
export function setRestingThresh(thresh: number): void {
  Matter.Resolver._restingThresh = thresh;
}
