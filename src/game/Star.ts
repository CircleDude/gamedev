/**
 * Собираемая звезда уровня. Универсальна к количеству: создаётся по одному
 * экземпляру на каждый элемент level.stars (0 элементов — звёзд нет).
 *
 * Состояния:
 *  - обычная (не собрана): жёлтая заливка + левитация масштабом;
 *  - «ожидающая» (мяч коснулся в этом полёте, но гола ещё не было): белый силуэт;
 *  - сохранённая (собрана в прошлых заходах): белый силуэт с самого старта,
 *    повторное касание — приглушённый разлёт искр и пульс.
 *
 * Звезда не имеет физического тела: касание — проверка расстояния до мяча
 * (см. checkTouch), искры — короткоживущие Rectangle-объекты с tween.
 */

import Phaser from 'phaser';
import {
  STAR_POINTS,
  STAR_OUTER_RADIUS,
  STAR_INNER_RADIUS,
  STAR_TOUCH_RADIUS,
  STAR_FILL_COLOR,
  STAR_EDGE_COLOR,
  STAR_SILHOUETTE_COLOR,
  STAR_SILHOUETTE_ALPHA,
  STAR_SILHOUETTE_EDGE_ALPHA,
  STAR_SPARK_COLOR,
  STAR_SPARK_SIZE,
  STAR_SPARK_COUNT_BRIGHT,
  STAR_SPARK_COUNT_DIM,
  STAR_SPARK_LIFETIME,
  STAR_SPARK_MIN_DIST,
  STAR_SPARK_MAX_DIST,
  STAR_LEVITATE_MS,
  STAR_LEVITATE_SCALE,
  STAR_POP_IN_MS,
  STAR_PULSE_MS,
  STAR_PULSE_SCALE,
  STAR_TILE_RADIUS,
  STAR_TILE_INNER_RADIUS,
  STAR_TILE_SPACING,
  STAR_TILE_UNCOLLECTED_COLOR,
  WIN_STARS_OFFSET_Y,
} from './constants';

export class Star {
  private readonly scene: Phaser.Scene;
  private readonly shape: Phaser.GameObjects.Star;
  private readonly x: number;
  private readonly y: number;
  /** Звезда была собрана в прошлых заходах (записана в прогрессе). */
  private readonly saved: boolean;
  /** Мяч коснулся в текущем полёте (до гола). */
  private pending = false;
  private levitateTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, saved: boolean) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.saved = saved;

    this.shape = scene.add.star(x, y, STAR_POINTS, STAR_INNER_RADIUS, STAR_OUTER_RADIUS, 0xffffff);
    this.applyVisual();
    if (!saved) {
      this.popIn();
    }
    // Сохранённая звезда — статичный силуэт, без левитации и popIn.
  }

  /** Мяч коснулся звезды? true ровно один раз за полёт. */
  checkTouch(ballX: number, ballY: number): boolean {
    if (this.pending) return false;
    if (Phaser.Math.Distance.Between(ballX, ballY, this.x, this.y) > STAR_TOUCH_RADIUS) return false;
    this.onTouch();
    return true;
  }

  isPending(): boolean {
    return this.pending;
  }

  /** Сброс «ожидающей» звезды при новом броске: назад в исходный вид с появлением из нуля. */
  resetPending(): void {
    if (!this.pending) return;
    this.pending = false;
    this.applyVisual();
    this.startLevitate(0);
    this.popIn();
  }

  private onTouch(): void {
    this.pending = true;
    this.stopLevitate();
    this.applyVisual();
    this.burst(this.saved);
    if (this.saved) {
      // Повторное касание уже собранной: короткий пульс вместо левитации.
      this.scene.tweens.add({
        targets: this.shape,
        scaleX: STAR_PULSE_SCALE,
        scaleY: STAR_PULSE_SCALE,
        yoyo: true,
        duration: STAR_PULSE_MS / 2,
        onComplete: () => this.shape.setScale(1),
      });
    }
  }

  /** Визуал по состоянию: жёлтая — не собранная, белый силуэт — ожидающая/сохранённая. */
  private applyVisual(): void {
    if (this.pending || this.saved) {
      this.shape.setFillStyle(STAR_SILHOUETTE_COLOR, STAR_SILHOUETTE_ALPHA);
      this.shape.setStrokeStyle(2, STAR_SILHOUETTE_COLOR, STAR_SILHOUETTE_EDGE_ALPHA);
    } else {
      this.shape.setFillStyle(STAR_FILL_COLOR, 1);
      this.shape.setStrokeStyle(2, STAR_EDGE_COLOR, 1);
    }
  }

  /**
   * Появление scale 0→1 (старт звезды и сброс при новом броске).
   * Левитация подключается только ПОСЛЕ popIn: два tween на один масштаб
   * конфликтуют (звезда «дышит» до нуля), поэтому одновременно их не запускаем.
   */
  private popIn(): void {
    this.stopLevitate();
    this.shape.setScale(0);
    this.scene.tweens.add({
      targets: this.shape,
      scaleX: 1,
      scaleY: 1,
      duration: STAR_POP_IN_MS,
      ease: 'Back.Out',
      onComplete: () => {
        // Фаза левитации у каждой звезды своя — чтобы не «дышали» синхронно.
        this.startLevitate(Phaser.Math.Between(0, STAR_LEVITATE_MS));
      },
    });
  }

  private startLevitate(delay: number): void {
    this.stopLevitate();
    this.shape.setScale(1);
    this.levitateTween = this.scene.tweens.add({
      targets: this.shape,
      scaleX: 1 + STAR_LEVITATE_SCALE,
      scaleY: 1 + STAR_LEVITATE_SCALE,
      duration: STAR_LEVITATE_MS / 2,
      yoyo: true,
      repeat: -1,
      delay,
    });
  }

  private stopLevitate(): void {
    if (this.levitateTween) {
      this.levitateTween.stop();
      this.levitateTween.remove();
      this.levitateTween = null;
    }
    this.shape.setScale(1);
  }

  /** Разлёт искр-полосок по кругу. dim=true — приглушённый (звезда уже собрана). */
  private burst(dim: boolean): void {
    const count = dim ? STAR_SPARK_COUNT_DIM : STAR_SPARK_COUNT_BRIGHT;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.25, 0.25);
      const dist = Phaser.Math.Between(STAR_SPARK_MIN_DIST, STAR_SPARK_MAX_DIST);
      const spark = this.scene.add
        .rectangle(this.x, this.y, STAR_SPARK_SIZE.w, STAR_SPARK_SIZE.h, STAR_SPARK_COLOR, dim ? 0.5 : 1)
        .setRotation(angle + Math.PI / 2);
      this.scene.tweens.add({
        targets: spark,
        x: this.x + Math.cos(angle) * dist,
        y: this.y + Math.sin(angle) * dist,
        alpha: 0,
        duration: STAR_SPARK_LIFETIME,
        onComplete: () => spark.destroy(),
      });
    }
  }
}

/** Число собранных звёзд в битовой маске (единицы в двоичной записи). */
export function countStars(mask: number): number {
  let count = 0;
  let m = mask;
  while (m > 0) {
    count += m & 1;
    m >>= 1;
  }
  return count;
}

/**
 * Статичный ряд мелких звёзд (плитки выбора уровней, экран победы).
 * mask — битовая маска: бит j = звезда j собрана (закрашена), иначе — обводка.
 * cx — центр ряда по X; count универсален (0 звёзд → ничего не рисуется).
 */
export function drawStarRow(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  count: number,
  mask: number,
): void {
  const startX = cx - ((count - 1) * STAR_TILE_SPACING) / 2;
  for (let j = 0; j < count; j++) {
    const star = scene.add.star(
      startX + j * STAR_TILE_SPACING,
      cy,
      STAR_POINTS,
      STAR_TILE_INNER_RADIUS,
      STAR_TILE_RADIUS,
      0xffffff,
    );
    if ((mask & (1 << j)) !== 0) {
      star.setFillStyle(STAR_FILL_COLOR, 1);
      star.setStrokeStyle(2, STAR_EDGE_COLOR, 1);
    } else {
      // Несобранная — прозрачная заливка + обводка.
      star.setFillStyle(0xffffff, 0);
      star.setStrokeStyle(2, STAR_TILE_UNCOLLECTED_COLOR, 1);
    }
  }
}
