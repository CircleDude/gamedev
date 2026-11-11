/**
 * Оверлей выбора скина мяча — запускается через scene.launch() поверх MenuScene
 * (меню с мячом остаётся живым под затемняющей подложкой).
 * Превью — те же canvas-текстуры, что рисуются в игре (ensureBallTexture).
 * Клик по скину → registry['ballSkin'] + saveSkinId() (MenuScene подхватит
 * смену через registry events). Закрытие: клик по подложке, ✕ или Esc.
 */

import Phaser from 'phaser';
import { BALL_SKINS, ensureBallTexture } from './ballSkins';
import { GAME_WIDTH, GAME_HEIGHT } from './constants';
import { saveSkinId } from './storage';

const BACKDROP_COLOR = 0x020617;
const BACKDROP_ALPHA = 0.65;

const PANEL_WIDTH = 640;
const PANEL_HEIGHT = 320;
const PANEL_BG_COLOR = 0x1e293b; // slate-800, как у MenuButton
const PANEL_STROKE_COLOR = 0x38bdf8; // sky-400

const TITLE_TEXT = 'Скины';
const TITLE_OFFSET_Y = -100;

const PREVIEW_SPACING = 116;
const PREVIEW_FRAME = 76;
const PREVIEW_SCALE = 1.5;
const PREVIEW_Y_OFFSET = -10;
const NAME_OFFSET_Y = 58;

const FRAME_STROKE_COLOR = 0x475569;
const SELECTION_STROKE_COLOR = 0x38bdf8;
const SELECTION_PADDING = 8;

const CLOSE_TEXT = '✕';
const CLOSE_OFFSET_X = 24;
const CLOSE_OFFSET_Y = 24;

export class SkinOverlayScene extends Phaser.Scene {
  private selectionFrame!: Phaser.GameObjects.Rectangle;
  private previewXs: number[] = [];

  constructor() {
    super('SkinOverlayScene');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Подложка на весь экран: клик вне панели закрывает оверлей.
    this.add
      .rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, BACKDROP_COLOR, BACKDROP_ALPHA)
      .setInteractive()
      .on('pointerup', () => this.closeOverlay());

    // Панель перехватывает клики — клик внутри панели оверлей не закрывает.
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

    this.createSkinPreviews(cx, cy);
    this.createCloseButton(cx, cy);

    this.input.keyboard?.on('keydown-ESC', () => this.closeOverlay());
  }

  private createSkinPreviews(cx: number, cy: number): void {
    const startX = cx - ((BALL_SKINS.length - 1) / 2) * PREVIEW_SPACING;
    const selectedId = (this.registry.get('ballSkin') as string) ?? BALL_SKINS[0].id;
    let selectedIndex = 0;

    BALL_SKINS.forEach((skin, i) => {
      const x = startX + i * PREVIEW_SPACING;
      const y = cy + PREVIEW_Y_OFFSET;
      this.previewXs.push(x);
      if (skin.id === selectedId) selectedIndex = i;

      this.add
        .rectangle(x, y, PREVIEW_FRAME, PREVIEW_FRAME)
        .setStrokeStyle(2, FRAME_STROKE_COLOR);

      const textureKey = ensureBallTexture(this, skin);
      this.add
        .image(x, y, textureKey)
        .setScale(PREVIEW_SCALE)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.selectSkin(skin.id));

      this.add
        .text(x, y + NAME_OFFSET_Y, skin.name, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          color: '#e2e8f0',
        })
        .setOrigin(0.5, 0.5);
    });

    // Рамка выделения поверх превью (только контур, заливки нет).
    this.selectionFrame = this.add
      .rectangle(0, 0, PREVIEW_FRAME + SELECTION_PADDING, PREVIEW_FRAME + SELECTION_PADDING)
      .setStrokeStyle(3, SELECTION_STROKE_COLOR);
    this.placeSelectionFrame(selectedIndex);
  }

  private placeSelectionFrame(index: number): void {
    this.selectionFrame.setPosition(this.previewXs[index], GAME_HEIGHT / 2 + PREVIEW_Y_OFFSET);
  }

  /** Выбор скина: сразу в registry (меню и игра подхватят) и в localStorage. */
  private selectSkin(id: string): void {
    this.registry.set('ballSkin', id);
    saveSkinId(id);
    const index = BALL_SKINS.findIndex((skin) => skin.id === id);
    if (index >= 0) this.placeSelectionFrame(index);
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
