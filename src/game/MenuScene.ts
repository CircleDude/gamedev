/**
 * Главное меню: 4 кнопки + физический мяч (рогатка работает, мяч отскакивает
 * от кнопок и стен). «Играть» запускает последний открытый уровень из
 * прогресса (storage.ts). Физика шагается вручную через matterStep.ts.
 */

import Phaser from 'phaser';
import { Ball } from './Ball';
import { MenuButton } from './ui/MenuButton';
import { createArenaBounds } from './arena';
import { disableMatterAutoUpdate, stepMatterWorld, setRestingThresh } from './matterStep';
import { loadProgress, loadSkinId } from './storage';
import { BALL_SKINS } from './ballSkins';
import { LEVELS } from './levels';
import {
  BALL_RADIUS,
  BALL_RESTING_THRESH,
  FLOOR_Y,
  GAME_HEIGHT,
  GAME_WIDTH,
  GRAVITY_Y,
} from './constants';

const TITLE_TEXT = 'Баскетбольный мяч';
const TITLE_Y = 85;
const BUTTON_WIDTH = 260;
const BUTTON_HEIGHT = 56;
const BUTTON_X = GAME_WIDTH / 2;
const BUTTON_STEP = 78; // расстояние между центрами кнопок, px
// Блок из 4 кнопок центрирован по вертикали экрана.
const BUTTON_COUNT = 4;
const BUTTON_BLOCK_HEIGHT = BUTTON_STEP * (BUTTON_COUNT - 1) + BUTTON_HEIGHT;
const FIRST_BUTTON_Y =
  GAME_HEIGHT / 2 - BUTTON_BLOCK_HEIGHT / 2 + BUTTON_HEIGHT / 2;

// Мяч стартует у пола, по центру арены — ниже блока кнопок в центре экрана,
// чтобы точка спавна не пересекалась с физическим телом последней кнопки.
const BALL_SPAWN_Y_FROM_FLOOR = 30;

/** Прямоугольник зоны рогатки в меню — всё игровое поле над полом. */
function createMenuZone() {
  const inset = 12; // отступ от краёв арены
  return {
    x: inset,
    y: inset,
    width: GAME_WIDTH - inset * 2,
    height: FLOOR_Y - inset,
  };
}

export class MenuScene extends Phaser.Scene {
  private ball!: Ball;
  private buttons: MenuButton[] = [];

  constructor() {
    super('MenuScene');
  }

  preload(): void {
    // Текстура кулака нужна Ball (та же, что и в игре).
    this.load.image('fist', 'fist.png');
  }

  create(): void {
    // Единственная точка инициализации registry: скин из storage (как в плане §1).
    if (this.registry.get('ballSkin') === undefined) {
      this.registry.set('ballSkin', loadSkinId() ?? BALL_SKINS[0].id);
    }
    const progress = loadProgress();

    this.matter.world.setGravity(0, GRAVITY_Y);
    disableMatterAutoUpdate(this);
    setRestingThresh(BALL_RESTING_THRESH);
    createArenaBounds(this);

    this.createTitle();
    this.createButtons(progress.last);

    const zone = createMenuZone();
    const spawnX = GAME_WIDTH / 2;
    const spawnY = FLOOR_Y - BALL_SPAWN_Y_FROM_FLOOR;
    // Клик над кнопкой или по открытому оверлею не захватывает мяч, остальное поле — рогатка.
    this.ball = new Ball(this, spawnX, spawnY, zone, (x, y) => !this.isOverlayOpen() && !this.isOverAnyButton(x, y));

    // Смена скина в оверлее → пересоздаём меню: мяч появится с новой текстурой.
    this.registry.events.on('changedata', this.onRegistryChanged, this);
    this.events.once('shutdown', () => {
      this.registry.events.off('changedata', this.onRegistryChanged, this);
    });
  }

  private onRegistryChanged(_parent: unknown, key: string): void {
    if (key === 'ballSkin') this.scene.restart();
  }

  /** Открыт ли какой-нибудь оверлей поверх меню (клики уходят ему). */
  private isOverlayOpen(): boolean {
    return this.scene.isActive('SkinOverlayScene') || this.scene.isActive('SettingsOverlayScene');
  }

  update(_time: number, delta: number): void {
    stepMatterWorld(this, delta);
    this.ball.update(delta);
  }

  private createTitle(): void {
    this.add
      .text(GAME_WIDTH / 2, TITLE_Y, TITLE_TEXT, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5);
  }

  private createButtons(lastLevel: number): void {
    // «Играть» — последний открытый уровень (clamp на случай правки localStorage).
    const playIndex = Phaser.Math.Clamp(lastLevel, 0, LEVELS.length - 1);
    this.addButton(FIRST_BUTTON_Y, 'Играть', () => {
      this.registry.set('level', playIndex);
      this.scene.start('GameScene');
    });
    this.addButton(FIRST_BUTTON_Y + BUTTON_STEP, 'Уровни', () => {
      this.scene.start('LevelSelectScene');
    });
    // Оверлеи скинов и настроек запускаются поверх меню (scene.launch).
    this.addButton(FIRST_BUTTON_Y + BUTTON_STEP * 2, 'Скины', () => {
      this.scene.launch('SkinOverlayScene');
    });
    this.addButton(FIRST_BUTTON_Y + BUTTON_STEP * 3, 'Настройки', () => {
      this.scene.launch('SettingsOverlayScene');
    });
  }

  /** Добавляет кнопку меню; действия могут не быть (кнопки-заглушки). */
  private addButton(y: number, label: string, onClick?: () => void): void {
    const button = new MenuButton(this, BUTTON_X, y, {
      label,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      onClick,
    });
    this.buttons.push(button);
  }

  /**
   * Точка мира над какой-либо кнопкой меню (с запасом в радиус мяча)?
   * Мяч физически крупнее точки клика: запрещаем рогатку и вплотную к кнопке.
   */
  private isOverAnyButton(x: number, y: number): boolean {
    return this.buttons.some((button) => button.contains(x, y, BALL_RADIUS));
  }
}
