import Phaser from 'phaser';
import { Ball } from './Ball';
import { Hoop } from './Hoop';
import { BALL_SKINS } from './ballSkins';
import {
  BALL_RESTING_THRESH,
  FLOOR_Y,
  GRAVITY_Y,
  WALL_RESTITUTION,
  WALL_FRICTION,
  ZONE_COLOR,
  ZONE_ALPHA,
} from './constants';
import { LEVELS, type LevelConfig } from './levels';
import { applyLevelFeatures } from './levelFeatures';
import { disableMatterAutoUpdate, stepMatterWorld, setRestingThresh } from './matterStep';
import { createArenaBounds } from './arena';
import { loadSkinId, markLevelCompleted, setLastLevel } from './storage';
import { MenuButton } from './ui/MenuButton';

// --- Финальный экран уровня (см. createWinScreen) ---
const WIN_TITLE_OFFSET_Y = -150;
const WIN_BUTTONS_START_OFFSET_Y = -60;
const WIN_BUTTON_STEP = 70;
const WIN_BUTTON_WIDTH = 280;
const WIN_BUTTON_HEIGHT = 56;

// --- Оверлей паузы (см. togglePause) ---
const PAUSE_BUTTON_WIDTH = 240;
const PAUSE_BUTTON_HEIGHT = 52;
// Отступ кнопки «Главное меню» ниже надписи «Пауза».
const PAUSE_MENU_BUTTON_OFFSET_Y = 70;

/**
 * Игра «Баскетбольный мяч».
 * Физика Matter: гравитация, упругость, трение (мяч закручивается при качении).
 * Управление только мышью: ЛКМ на мяче — «рогатка». Цель — забить мяч в кольцо.
 * Уровень строится из декларации (levels.ts); механики включаются
 * реестром levelFeatures.ts.
 */
export class GameScene extends Phaser.Scene {
  private ball!: Ball;
  private hoop!: Hoop;
  private levelIndex = 0;
  private won = false;
  private paused = false;
  private overlayText!: Phaser.GameObjects.Text;
  private pauseMenuButton: MenuButton | null = null;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    // Спрайт кулака из public (Vite с base './' отдаёт и в dev, и в билде).
    this.load.image('fist', 'fist.png');
  }

  create(): void {
    this.levelIndex = this.registry.get('level') ?? 0;
    // Запоминаем последний запускавшийся уровень — «Играть» в меню откроет его.
    setLastLevel(this.levelIndex);
    // Восстанавливаем выбранный скин мяча (одноразово, при старте игры).
    if (this.registry.get('ballSkin') === undefined) {
      this.registry.set('ballSkin', loadSkinId() ?? BALL_SKINS[0].id);
    }
    // Сцена перезапускается через scene.restart() на том же экземпляре —
    // сбрасываем флаги, иначе после победы и повторного запуска мяч не засчитывается в кольцо.
    this.won = false;
    this.paused = false;
    const level = LEVELS[this.levelIndex];

    this.matter.world.setGravity(0, GRAVITY_Y);
    disableMatterAutoUpdate(this);
    // Разрешаем мелкие отскоки: стандартный порог Matter (~4) заставляет мяч «прилипать».
    setRestingThresh(BALL_RESTING_THRESH);
    createArenaBounds(this);
    this.createLevelObjects(level);
    this.createHud(level);
    this.createZoneVisual(level);
    // Механики уровня (вращение кольца, гравитация, подсказка) — из декларации уровня.
    applyLevelFeatures(level, {
      scene: this,
      hoop: this.hoop,
      setGravity: (x: number, y: number) => this.matter.world.setGravity(x, y),
    });

    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }
    // Esc / P — пауза: мяч останавливается, на экране появляется надпись «Пауза».
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
  }

  /** Переключает паузу: останавливает мяч, блокирует управление и показывает надпись «Пауза». */
  private togglePause(): void {
    this.paused = !this.paused;
    this.ball.setPaused(this.paused);
    this.overlayText
      .setText(this.paused ? 'Пауза' : '')
      .setVisible(this.paused);
    // Кнопка «Главное меню» видна только во время паузы.
    if (this.paused) {
      const { width, height } = this.scale;
      this.pauseMenuButton = new MenuButton(this, width / 2, height / 2 + PAUSE_MENU_BUTTON_OFFSET_Y, {
        label: 'Главное меню',
        width: PAUSE_BUTTON_WIDTH,
        height: PAUSE_BUTTON_HEIGHT,
        withPhysics: false,
        onClick: () => this.exitToMenu(),
      });
    } else if (this.pauseMenuButton) {
      this.pauseMenuButton.container.destroy();
      this.pauseMenuButton = null;
    }
  }

  /** Выход в главное меню: снимаем паузу, чтобы игра не осталась замороженной. */
  private exitToMenu(): void {
    if (this.paused) {
      this.paused = false;
      this.ball.setPaused(false);
      this.overlayText.setText('').setVisible(false);
      if (this.pauseMenuButton) {
        this.pauseMenuButton.container.destroy();
        this.pauseMenuButton = null;
      }
    }
    this.scene.start('MenuScene');
  }

  update(_time: number, delta: number): void {
    if (this.paused) return;
    stepMatterWorld(this, delta);
    this.ball.update(delta);
    if (this.won) return;

    this.hoop.update(delta);

    const x = this.ball.getX();
    const y = this.ball.getY();
    if (this.hoop.score(x, y, this.ball.getVelocityY())) {
      this.onScore();
      return;
    }
  }

  private createLevelObjects(level: LevelConfig): void {
    this.hoop = new Hoop(this, level.hoop);
    this.hoop.reset();

    const opts = { isStatic: true, restitution: WALL_RESTITUTION, friction: WALL_FRICTION };
    for (const wall of level.walls) {
      const angle = Phaser.Math.DegToRad(wall.angle);
      this.matter.add.rectangle(wall.x, wall.y, wall.width, wall.length, { ...opts, angle });
      this.add
        .rectangle(wall.x, wall.y, wall.width, wall.length, 0x475569)
        .setStrokeStyle(2, 0x1e293b)
        .setRotation(angle);
    }

    this.ball = new Ball(this, level.ballSpawn.x, level.ballSpawn.y, level.zone);
  }

  private createZoneVisual(level: LevelConfig): void {
    const { x, y, width, height } = level.zone;
    // Заливка зоны — светлый sky-400, контур — темнее по правилу скинов (ZONE_COLOR).
    this.add
      .rectangle(x + width / 2, y + height / 2, width, height, 0x38bdf8, 0.05)
      .setStrokeStyle(2, ZONE_COLOR, ZONE_ALPHA);
    this.add.text(x + 8, y + 6, 'Зона управления', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#7dd3fc',
    });
  }

  /** HUD в нижней полосе пола: уровень, управление. */
  private createHud(level: LevelConfig): void {
    const { width, height } = this.scale;
    const midY = FLOOR_Y + (height - FLOOR_Y) / 2;

    this.add
      .text(16, midY, `Уровень ${this.levelIndex + 1}/${LEVELS.length}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5);

    this.add
      .text(width / 2, midY, 'ЛКМ — кинуть мяч · Esc/P — пауза', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5, 0.5);

    this.overlayText = this.add
      .text(width / 2, height / 2, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        align: 'center',
        backgroundColor: '#0f172a',
        padding: { x: 20, y: 16 },
      })
      .setOrigin(0.5)
      .setVisible(false);
  }

  private onScore(): void {
    // Прогресс: уровень пройден, следующий открыт, «Играть» в меню откроет следующий
    // (markLevelCompleted сам выставляет last = index + 1, см. storage.ts).
    markLevelCompleted(this.levelIndex);
    this.won = true;
    // Мяч больше не захватывается — клики уходят кнопкам победного экрана.
    this.ball.setPaused(true);
    this.createWinScreen();
  }

  /** Финальный экран уровня: «Следующий уровень» (если есть), «Повторить», «В меню». */
  private createWinScreen(): void {
    const { width, height } = this.scale;
    const isLastLevel = this.levelIndex >= LEVELS.length - 1;

    this.add
      .text(width / 2, height / 2 + WIN_TITLE_OFFSET_Y, isLastLevel
        ? 'ВСЕ УРОВНИ ПРОЙДЕНЫ!'
        : `УРОВЕНЬ ${this.levelIndex + 1} ПРОЙДЕН!`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#0f172a',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5, 0.5);

    let buttonY = height / 2 + WIN_BUTTONS_START_OFFSET_Y;
    if (!isLastLevel) {
      new MenuButton(this, width / 2, buttonY, {
        label: 'Следующий уровень',
        width: WIN_BUTTON_WIDTH,
        height: WIN_BUTTON_HEIGHT,
        withPhysics: false,
        onClick: () => {
          this.registry.set('level', this.levelIndex + 1);
          this.scene.restart();
        },
      });
      buttonY += WIN_BUTTON_STEP;
    }
    new MenuButton(this, width / 2, buttonY, {
      label: 'Повторить',
      width: WIN_BUTTON_WIDTH,
      height: WIN_BUTTON_HEIGHT,
      withPhysics: false,
      onClick: () => this.scene.restart(),
    });
    new MenuButton(this, width / 2, buttonY + WIN_BUTTON_STEP, {
      label: 'В меню',
      width: WIN_BUTTON_WIDTH,
      height: WIN_BUTTON_HEIGHT,
      withPhysics: false,
      onClick: () => this.scene.start('MenuScene'),
    });
  }

}
