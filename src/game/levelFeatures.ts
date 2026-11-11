/**
 * Реестр механик уровней: GameScene строит базовый уровень (арена, стены,
 * корзина, мяч) и передаёт контекст в applyLevelFeatures — сам он не знает
 * ни одной конкретной механики. Новая механика = новый type + обработчик здесь.
 */

import Phaser from 'phaser';
import { FLOOR_Y, GRAVITY_Y, PHASE2_GRAVITY_SCALE } from './constants';
import type { Hoop } from './Hoop';
import type { LevelConfig } from './levels';

export interface LevelContext {
  scene: Phaser.Scene;
  hoop: Hoop;
  setGravity(x: number, y: number): void; // обёртка над matter.world.setGravity
}

type FeatureHandler = (ctx: LevelContext, params: Readonly<Record<string, number>>) => void;

// --- Пунктирная парабола-подсказка (перенос из GameScene) ---
const HINT_START = { x: 300, y: 293 }; // старт — мяч на спавне в зоне управления
const HINT_CTRL = { x: 520, y: 60 }; // контрольная точка дуги Безье (высокий навес)
const HINT_END = { x: 760, y: 460 }; // финиш — точка внутри корзины
const HINT_DASH = 12; // длина штриха пунктира, px
const HINT_GAP = 8; // длина промежутка пунктира, px
const HINT_SEGMENTS = 64;
const HINT_DEPTH = -1; // подсказка рисуется под всеми объектами уровня, как раньше

// --- Бейдж «ФАЗА 2» (перенос из GameScene) ---
const PHASE_BADGE_NAME = 'phase2-badge'; // защита от дублей: обе механики фазы 2 его показывают
const PHASE_BADGE_TEXT = 'ФАЗА 2';
const PHASE_BADGE_MARGIN = 16; // отступ бейджа от правого края, px
const PHASE_BADGE_COLOR = '#fb923c';

/** Бейдж фазы 2 в правом нижнем углу; создаётся один раз за сцену. */
function showPhaseBadge(scene: Phaser.Scene): void {
  if (scene.children.getByName(PHASE_BADGE_NAME)) return;
  const { width, height } = scene.scale;
  const midY = FLOOR_Y + (height - FLOOR_Y) / 2;
  scene.add
    .text(width - PHASE_BADGE_MARGIN, midY, PHASE_BADGE_TEXT, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: PHASE_BADGE_COLOR,
    })
    .setOrigin(1, 0.5)
    .setName(PHASE_BADGE_NAME);
}

/** Пунктирная парабола-подсказка: из зоны управления в корзину (перенос из GameScene). */
function drawHintTrajectory(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(HINT_DEPTH);

  // Квадратичная кривая Безье: HINT_START → HINT_CTRL → HINT_END.
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= HINT_SEGMENTS; i++) {
    const t = i / HINT_SEGMENTS;
    const mt = 1 - t;
    pts.push({
      x: mt * mt * HINT_START.x + 2 * mt * t * HINT_CTRL.x + t * t * HINT_END.x,
      y: mt * mt * HINT_START.y + 2 * mt * t * HINT_CTRL.y + t * t * HINT_END.y,
    });
  }

  // Длины сегментов ломаной и накопленное смещение начала каждого сегмента.
  const segLens: number[] = [];
  const offsets: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    segLens.push(len);
    offsets.push(offsets[i - 1] + len);
  }
  const total = offsets[offsets.length - 1];
  const period = HINT_DASH + HINT_GAP;

  g.lineStyle(2, 0xffffff, 0.35);
  for (let dashFrom = 0; dashFrom < total - 1; dashFrom += period) {
    const dashTo = Math.min(dashFrom + HINT_DASH, total);
    let start: { x: number; y: number } | null = null;
    let end: { x: number; y: number } | null = null;
    for (let i = 0; i < segLens.length; i++) {
      const s0 = offsets[i];
      const s1 = offsets[i + 1];
      if (dashTo <= s0 || dashFrom >= s1) continue;
      const lo = Math.max(dashFrom, s0);
      const hi = Math.min(dashTo, s1);
      const x0 = Phaser.Math.Linear(pts[i].x, pts[i + 1].x, (lo - s0) / segLens[i]);
      const y0 = Phaser.Math.Linear(pts[i].y, pts[i + 1].y, (lo - s0) / segLens[i]);
      const x1 = Phaser.Math.Linear(pts[i].x, pts[i + 1].x, (hi - s0) / segLens[i]);
      const y1 = Phaser.Math.Linear(pts[i].y, pts[i + 1].y, (hi - s0) / segLens[i]);
      if (!start) start = { x: x0, y: y0 };
      end = { x: x1, y: y1 };
    }
    if (start && end) {
      g.lineBetween(start.x, start.y, end.x, end.y);
    }
  }
}

const FEATURE_HANDLERS: Record<string, FeatureHandler> = {
  rotatingHoop: (ctx) => {
    ctx.hoop.setRotating(true);
    showPhaseBadge(ctx.scene);
  },
  lowGravity: (ctx) => {
    ctx.setGravity(0, GRAVITY_Y / PHASE2_GRAVITY_SCALE);
    showPhaseBadge(ctx.scene);
  },
  hintTrajectory: (ctx) => drawHintTrajectory(ctx.scene),
};

/**
 * Применяет механики уровня из его декларации. Неизвестный type молча
 * игнорируется — устойчивость к опечаткам в данных уровней.
 */
export function applyLevelFeatures(level: LevelConfig, ctx: LevelContext): void {
  for (const feature of level.features) {
    const handler = FEATURE_HANDLERS[feature.type];
    if (handler) handler(ctx, feature.params ?? {});
  }
}
