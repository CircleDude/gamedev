/**
 * Кнопка главного меню: контейнер Rectangle + Text с Phaser-инпутом
 * (hover-подсветка, клик) и отдельным статичным Matter-телом — чтобы
 * физический мяч отскакивал от кнопки. Phaser-инпут не зависит от
 * Matter-тел, поэтому клики по кнопке не перехватываются мячом.
 */

import Phaser from 'phaser';
import { WALL_RESTITUTION } from '../constants';

const BG_COLOR = 0x1e293b; // slate-800
const BG_HOVER_COLOR = 0x334155; // slate-700
const STROKE_COLOR = 0x38bdf8; // sky-400
const STROKE_WIDTH = 2;
const TEXT_COLOR = '#e2e8f0';

export interface MenuButtonOptions {
  label: string;
  width: number;
  height: number;
  onClick?: () => void;
  /** Создавать статичное Matter-тело для отскока мяча (по умолчанию true). */
  withPhysics?: boolean;
}

export class MenuButton {
  readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly cx: number;
  private readonly cy: number;
  private readonly width: number;
  private readonly height: number;

  constructor(scene: Phaser.Scene, x: number, y: number, options: MenuButtonOptions) {
    this.cx = x;
    this.cy = y;
    this.width = options.width;
    this.height = options.height;

    // bg/text стоят в (0,0), контейнер — в (x, y): хит-зона интерактива задаётся
    // в ЛОКАЛЬНЫХ координатах контейнера, поэтому контейнер обязан быть на месте кнопки.
    this.bg = scene.add
      .rectangle(0, 0, options.width, options.height, BG_COLOR)
      .setStrokeStyle(STROKE_WIDTH, STROKE_COLOR);

    const text = scene.add.text(0, 0, options.label, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: TEXT_COLOR,
    });
    text.setOrigin(0.5, 0.5);

    this.container = scene.add.container(x, y);
    this.container.add([this.bg, text]);

    // Инпут по контейнеру: хит-зона — прямоугольник в локальных координатах.
    this.container.setInteractive(
      new Phaser.Geom.Rectangle(-options.width / 2, -options.height / 2, options.width, options.height),
      Phaser.Geom.Rectangle.Contains,
    );
    this.container.on('pointerover', () => this.bg.setFillStyle(BG_HOVER_COLOR));
    this.container.on('pointerout', () => this.bg.setFillStyle(BG_COLOR));
    if (options.onClick) {
      this.container.on('pointerup', options.onClick);
    }

    // Статичное Matter-тело для отскока мяча; не привязано к GameObject,
    // чтобы Phaser не трогал его transform. В сценах без мяча (экран победы,
    // выбор уровня) тело не нужно — мяч не должен «зависать» на нём.
    if (options.withPhysics ?? true) {
      scene.matter.add.rectangle(x, y, options.width, options.height, {
        isStatic: true,
        restitution: WALL_RESTITUTION,
      });
    }
  }

  /**
   * Находится ли точка мира над кнопкой (для grabGuard мяча).
   * pad — расширение зоны на px (например, радиус мяча, чтобы рогатка
   * не стартовала вплотную к кнопке, где мяч физически перекрывает её).
   */
  contains(px: number, py: number, pad = 0): boolean {
    return (
      px >= this.cx - this.width / 2 - pad &&
      px <= this.cx + this.width / 2 + pad &&
      py >= this.cy - this.height / 2 - pad &&
      py <= this.cy + this.height / 2 + pad
    );
  }
}
