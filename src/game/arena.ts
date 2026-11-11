/**
 * Общие границы арены: упругие невидимые стены (пол, потолок, левая и правая)
 * и их видимая рамка. Используется сценами с физическим мячом.
 */

import Phaser from 'phaser';
import {
  FLOOR_Y,
  WALL_RESTITUTION,
  WALL_FRICTION,
  WALL_COLOR,
  WALL_EDGE_COLOR,
  WALL_VISUAL_THICKNESS,
} from './constants';

const INVISIBLE_WALL_THICKNESS = 80; // толщина невидимых стен
const FRAME_LINE_WIDTH = 2; // толщина контура рамки

/** Упругие границы арены + видимая рамка. */
export function createArenaBounds(scene: Phaser.Scene): void {
  const { width, height } = scene.scale;
  const opts = { isStatic: true, restitution: WALL_RESTITUTION, friction: WALL_FRICTION };
  const t = INVISIBLE_WALL_THICKNESS;
  const v = WALL_VISUAL_THICKNESS; // внутренние плоскости стен совпадают с нарисованной рамкой

  // Пол (верхняя кромка — FLOOR_Y)
  scene.matter.add.rectangle(
    width / 2,
    (FLOOR_Y + height + t) / 2,
    width + t * 2,
    height - FLOOR_Y + t,
    opts,
  );
  // Потолок (нижняя кромка на y = v)
  scene.matter.add.rectangle(width / 2, v - t / 2, width + t * 2, t, opts);
  // Левая стена (правая кромка на x = v) и правая (левая кромка на x = width - v)
  scene.matter.add.rectangle(v - t / 2, height / 2, t, height + t * 2, opts);
  scene.matter.add.rectangle(width - v + t / 2, height / 2, t, height + t * 2, opts);

  drawArenaFrame(scene, width, height);
}

/** Видимые стены: полоса пола, боковые стены, потолок и контур рамки. */
function drawArenaFrame(scene: Phaser.Scene, width: number, height: number): void {
  const g = scene.add.graphics();
  const v = WALL_VISUAL_THICKNESS;

  // Пол — заливка ниже кромки столкновения (FLOOR_Y)
  g.fillStyle(WALL_COLOR, 1);
  g.fillRect(0, FLOOR_Y, width, height - FLOOR_Y);

  // Левая, правая стены и потолок — полосы внутри арены вдоль кромок столкновений
  g.fillStyle(WALL_COLOR, 1);
  g.fillRect(0, 0, v, FLOOR_Y);
  g.fillRect(width - v, 0, v, FLOOR_Y);
  g.fillRect(0, 0, width, v);

  // Единая прямоугольная рамка по внутренним кромкам стен и пола
  g.lineStyle(FRAME_LINE_WIDTH, WALL_EDGE_COLOR, 1);
  g.strokeRect(v, v, width - v * 2, FLOOR_Y - v);
}
