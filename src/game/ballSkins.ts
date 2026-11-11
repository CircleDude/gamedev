import Phaser from 'phaser';
import { BALL_RADIUS } from './constants';

/**
 * Скины мяча: каждый скин — конфиг цветов + тип узора.
 * Текстура генерируется один раз на canvas и кэшируется в TextureManager,
 * поэтому добавление нового скина = один объект в BALL_SKINS.
 */

export type BallPattern = 'basketball' | 'soccer' | 'tennis' | 'beach' | 'eight';

export interface BallSkin {
  id: string;
  name: string;
  base: number; // основной цвет
  edge: number; // цвет контура
  seams: number; // цвет швов/узора
  pattern: BallPattern;
}

export const BALL_SKINS: BallSkin[] = [
  {
    id: 'classic',
    name: 'Баскетбольный',
    base: 0xf97316,
    edge: 0x9a3412,
    seams: 0x7c2d12,
    pattern: 'basketball',
  },
  {
    id: 'soccer',
    name: 'Футбольный',
    base: 0xf8fafc,
    edge: 0x334155,
    seams: 0x1e293b,
    pattern: 'soccer',
  },
  {
    id: 'tennis',
    name: 'Теннисный',
    base: 0xd9f99d,
    edge: 0x4d7c0f,
    seams: 0x365314,
    pattern: 'tennis',
  },
  {
    id: 'beach',
    name: 'Пляжный',
    base: 0xf87171,
    edge: 0x7f1d1d,
    seams: 0x38bdf8,
    pattern: 'beach',
  },
  {
    id: 'eight',
    name: 'Восьмёрка',
    base: 0x1e293b,
    edge: 0x020617,
    seams: 0xf8fafc,
    pattern: 'eight',
  },
];

const DEFAULT_SKIN_ID = BALL_SKINS[0].id;
const TEX_SIZE = 56; // запас вокруг мяча (радиус 18), чтобы поворот не срезал края
const CENTER = TEX_SIZE / 2;
const R = BALL_RADIUS;

/** Возвращает скин по id; неизвестный/пустой id → первый скин. */
export function getBallSkin(id: string | null | undefined): BallSkin {
  return BALL_SKINS.find((skin) => skin.id === id) ?? BALL_SKINS[0];
}

/** Следующий скин по кругу — для переключения одной клавишей. */
export function getNextBallSkinId(id: string): string {
  const index = BALL_SKINS.findIndex((skin) => skin.id === id);
  return BALL_SKINS[(index + 1) % BALL_SKINS.length].id;
}

function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function tracePolygon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  rotation: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}

function drawBasketball(ctx: CanvasRenderingContext2D, skin: BallSkin): void {
  ctx.strokeStyle = css(skin.seams);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(CENTER - R, CENTER);
  ctx.lineTo(CENTER + R, CENTER);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(CENTER, CENTER - R);
  ctx.lineTo(CENTER, CENTER + R);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CENTER - R * 1.5, CENTER, R * 1.05, -0.6, 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CENTER + R * 1.5, CENTER, R * 1.05, Math.PI - 0.6, Math.PI + 0.6);
  ctx.stroke();
}

function drawSoccer(ctx: CanvasRenderingContext2D, skin: BallSkin): void {
  ctx.fillStyle = css(skin.seams);
  tracePolygon(ctx, CENTER, CENTER, 7, 5, -Math.PI / 2);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
    const cx = CENTER + Math.cos(a) * 16;
    const cy = CENTER + Math.sin(a) * 16;
    tracePolygon(ctx, cx, cy, 6.5, 5, a + Math.PI);
    ctx.fill();
  }
}

function drawTennis(ctx: CanvasRenderingContext2D, skin: BallSkin): void {
  ctx.strokeStyle = css(skin.seams);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(CENTER - R * 1.6, CENTER, R * 1.75, -0.5, 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CENTER + R * 1.6, CENTER, R * 1.75, Math.PI - 0.5, Math.PI + 0.5);
  ctx.stroke();
}

function drawBeach(ctx: CanvasRenderingContext2D, skin: BallSkin): void {
  const colors = [css(skin.base), css(skin.seams)];
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = colors[i % 2];
    ctx.beginPath();
    ctx.moveTo(CENTER, CENTER);
    ctx.arc(CENTER, CENTER, R, (i * Math.PI) / 3, ((i + 1) * Math.PI) / 3);
    ctx.closePath();
    ctx.fill();
  }
}

function drawEight(ctx: CanvasRenderingContext2D, skin: BallSkin): void {
  ctx.fillStyle = css(skin.seams);
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(skin.base);
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('8', CENTER, CENTER + 1);
}

function drawPattern(ctx: CanvasRenderingContext2D, skin: BallSkin): void {
  switch (skin.pattern) {
    case 'basketball':
      drawBasketball(ctx, skin);
      break;
    case 'soccer':
      drawSoccer(ctx, skin);
      break;
    case 'tennis':
      drawTennis(ctx, skin);
      break;
    case 'beach':
      drawBeach(ctx, skin);
      break;
    case 'eight':
      drawEight(ctx, skin);
      break;
  }
}

/** Объём: блик слева-сверху и затенение к краю. */
function drawShading(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createRadialGradient(
    CENTER - R * 0.4,
    CENTER - R * 0.4,
    R * 0.15,
    CENTER,
    CENTER,
    R * 1.02,
  );
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
}

/**
 * Создаёт canvas-текстуру скина, если её ещё нет, и возвращает ключ текстуры.
 * Текстура кэшируется в TextureManager — повторные вызовы бесплатны.
 */
export function ensureBallTexture(scene: Phaser.Scene, skin: BallSkin): string {
  const key = `ball-skin-${skin.id}`;
  if (scene.textures.exists(key)) {
    return key;
  }

  const canvasTex = scene.textures.createCanvas(key, TEX_SIZE, TEX_SIZE);
  if (!canvasTex) {
    return key;
  }
  const ctx = canvasTex.getContext();

  ctx.save();
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = css(skin.base);
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  drawPattern(ctx, skin);
  drawShading(ctx);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(CENTER, CENTER, R - 1, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = css(skin.edge);
  ctx.stroke();

  canvasTex.refresh();
  return key;
}
