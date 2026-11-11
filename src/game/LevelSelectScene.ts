/**
 * Экран выбора уровней: сетка всех уровней из levels.ts.
 * Открытые (i < progress.unlocked) — кликабельны, пройденные — с галочкой,
 * закрытые — серые с замком, не кликабельны. «Назад» / Esc — в меню.
 */

import Phaser from 'phaser';
import { MenuButton } from './ui/MenuButton';
import { GAME_WIDTH } from './constants';
import { LEVELS } from './levels';
import { loadProgress, loadLevelStars, setLastLevel } from './storage';
import { drawStarRow } from './Star';

const TITLE_TEXT = 'Выбор уровня';
const TITLE_Y = 64;

// Сетка: колонок фиксированно, строки считаются из LEVELS.length.
const COLS = 4;
const TILE_WIDTH = 150;
const TILE_HEIGHT = 64;
const TILE_GAP_X = 26;
const TILE_GAP_Y = 32;
const GRID_TOP_Y = 160;

const BACK_BUTTON_Y = 540;
const BACK_BUTTON_WIDTH = 220;

// Закрытый уровень: приглушённые цвета, без инпута.
const LOCKED_BG_COLOR = 0x334155;
const LOCKED_STROKE_COLOR = 0x475569;
const LOCKED_TEXT_COLOR = '#94a3b8';
const DONE_MARK_COLOR = '#4ade80';

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');
  }

  create(): void {
    const progress = loadProgress();

    this.add
      .text(GAME_WIDTH / 2, TITLE_Y, TITLE_TEXT, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5);

    this.createLevelGrid(progress.unlocked, progress.completed);

    new MenuButton(this, GAME_WIDTH / 2, BACK_BUTTON_Y, {
      label: 'Назад',
      width: BACK_BUTTON_WIDTH,
      height: 56,
      withPhysics: false,
      onClick: () => this.scene.start('MenuScene'),
    });

    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('MenuScene'));
  }

  private createLevelGrid(unlocked: number, completed: boolean[]): void {
    const gridWidth = COLS * TILE_WIDTH + (COLS - 1) * TILE_GAP_X;
    const startX = (GAME_WIDTH - gridWidth) / 2 + TILE_WIDTH / 2;

    for (let i = 0; i < LEVELS.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = startX + col * (TILE_WIDTH + TILE_GAP_X);
      const y = GRID_TOP_Y + row * (TILE_HEIGHT + TILE_GAP_Y);
      if (i < unlocked) {
        this.createUnlockedTile(i, x, y, completed[i] === true);
      } else {
        this.createLockedTile(i, x, y);
      }
    }
  }

  /** Открытый уровень: номер слева, звёзды по центру, клик → GameScene; пройденный — с галочкой. */
  private createUnlockedTile(index: number, x: number, y: number, done: boolean): void {
    new MenuButton(this, x, y, {
      label: `${index + 1}`,
      labelOffsetX: -TILE_WIDTH / 2 + 16,
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
      withPhysics: false,
      onClick: () => {
        setLastLevel(index);
        this.registry.set('level', index);
        this.scene.start('GameScene');
      },
    });
    // Звёзды уровня: собранная — закрашена, несобранная — только обводка.
    const starCount = LEVELS[index].stars?.length ?? 0;
    if (starCount > 0) {
      drawStarRow(this, x + 8, y, starCount, loadLevelStars(index));
    }
    if (done) {
      this.add
        .text(x + TILE_WIDTH / 2 - 16, y - TILE_HEIGHT / 2 + 10, '✓', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '22px',
          fontStyle: 'bold',
          color: DONE_MARK_COLOR,
        })
        .setOrigin(0.5, 0.5);
    }
  }

  /** Закрытый уровень: серый прямоугольник с номером и замком, без инпута. */
  private createLockedTile(index: number, x: number, y: number): void {
    this.add
      .rectangle(x, y, TILE_WIDTH, TILE_HEIGHT, LOCKED_BG_COLOR, 0.45)
      .setStrokeStyle(2, LOCKED_STROKE_COLOR);
    this.add
      .text(x, y, `🔒 ${index + 1}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: LOCKED_TEXT_COLOR,
      })
      .setOrigin(0.5, 0.5);
  }
}
