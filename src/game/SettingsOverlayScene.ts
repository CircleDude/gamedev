/**
 * Оверлей-заглушка настроек — запускается через scene.launch() поверх MenuScene.
 * Заголовок + неактивные строки-плейсхолдеры («скоро») с заделом под громкость
 * звука (тип Settings уже зафиксирован в storage.ts). Функциональных настроек нет.
 * Закрытие: клик по подложке, ✕ или Esc → scene.stop().
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './constants';

const BACKDROP_COLOR = 0x020617;
const BACKDROP_ALPHA = 0.65;

const PANEL_WIDTH = 520;
const PANEL_HEIGHT = 280;
const PANEL_BG_COLOR = 0x1e293b; // slate-800, как у MenuButton
const PANEL_STROKE_COLOR = 0x38bdf8; // sky-400

const TITLE_TEXT = 'Настройки';
const TITLE_OFFSET_Y = -80;

const ROW_OFFSET_Y = 0;
const ROW_LABEL_COLOR = '#e2e8f0';
const SOON_COLOR = '#94a3b8';
const SOON_TEXT = 'скоро';

// Плейсхолдер-слайдер: линия + ручка, полупрозрачные (неинтерактивные).
const SLIDER_WIDTH = 180;
const SLIDER_KNOB_RADIUS = 8;
const SLIDER_COLOR = 0x475569;
const SLIDER_KNOB_COLOR = 0x94a3b8;
const SLIDER_ALPHA = 0.5;

const CLOSE_TEXT = '✕';
const CLOSE_OFFSET_X = 24;
const CLOSE_OFFSET_Y = 24;

export class SettingsOverlayScene extends Phaser.Scene {
  constructor() {
    super('SettingsOverlayScene');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add
      .rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, BACKDROP_COLOR, BACKDROP_ALPHA)
      .setInteractive()
      .on('pointerup', () => this.closeOverlay());

    this.add
      .rectangle(cx, cy, PANEL_WIDTH, PANEL_HEIGHT, PANEL_BG_COLOR)
      .setStrokeStyle(2, PANEL_STROKE_COLOR)
      .setInteractive();

    this.add
      .text(cx, cy + TITLE_OFFSET_Y, TITLE_TEXT, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5);

    this.createSoundRow(cx, cy + ROW_OFFSET_Y);
    this.createCloseButton(cx, cy);

    this.input.keyboard?.on('keydown-ESC', () => this.closeOverlay());
  }

  /** Строка «Громкость звука» с неактивным слайдером-заглушкой и пометкой «скоро». */
  private createSoundRow(cx: number, cy: number): void {
    const label = this.add
      .text(cx - 130, cy, 'Громкость звука', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: ROW_LABEL_COLOR,
      })
      .setOrigin(0, 0.5);

    const sliderX = label.x + label.width + 24;
    this.add
      .rectangle(sliderX + SLIDER_WIDTH / 2, cy, SLIDER_WIDTH, 4, SLIDER_COLOR, SLIDER_ALPHA)
      .setOrigin(0, 0.5);
    this.add
      .circle(sliderX + SLIDER_WIDTH * 0.6, cy, SLIDER_KNOB_RADIUS, SLIDER_KNOB_COLOR, SLIDER_ALPHA);

    this.add
      .text(cx + PANEL_WIDTH / 2 - 24, cy, SOON_TEXT, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: SOON_COLOR,
      })
      .setOrigin(1, 0.5);
  }

  private createCloseButton(cx: number, cy: number): void {
    this.add
      .text(cx + PANEL_WIDTH / 2 - CLOSE_OFFSET_X, cy - PANEL_HEIGHT / 2 + CLOSE_OFFSET_Y, CLOSE_TEXT, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: '#94a3b8',
      })
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.closeOverlay());
  }

  private closeOverlay(): void {
    this.scene.stop();
  }
}
