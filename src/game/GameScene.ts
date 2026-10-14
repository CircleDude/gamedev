import Phaser from 'phaser';
import { Ball } from './Ball';
import { Hoop } from './Hoop';
import {
  FLOOR_Y,
  GRAVITY_Y,
  LEVELS,
  PHASE2_DELAY_MS,
  PHASE2_GRAVITY_SCALE,
  WALL_RESTITUTION,
  WALL_FRICTION,
  type LevelConfig,
} from './constants';

/**
 * Модуль MatterJS (в рантайме Phaser.Physics.Matter.Matter, в типах не описан).
 * Runner Phaser 4 передаёт в движок время в неверных единицах (физика ускоряется),
 * поэтому шагаем движок вручную с реальной дельтой кадра.
 */
const Matter = (
  Phaser.Physics.Matter as unknown as {
    Matter: {
      Engine: { update(engine: unknown, delta: number): void };
    };
  }
).Matter;

const HUD_HEIGHT = 44;
const STUCK_TIMEOUT = 4000; // мс — автосброс мяча, если он застрял вне зоны
const STUCK_SPEED = 20; // px/s — ниже этой скорости мяч считается «застрявшим»

/**
 * Игра «Баскетбольный мяч».
 * Физика Matter: гравитация, упругость, трение (мяч закручивается при качении).
 * Управление только мышью: ЛКМ на мяче — «рогатка». Цель — забить мяч в кольцо.
 */
export class GameScene extends Phaser.Scene {
  private ball!: Ball;
  private hoop!: Hoop;
  private levelIndex = 0;
  private won = false;
  private paused = false;
  private phase2 = false;
  private phase2Elapsed = 0;
  private stuckTimer = 0;
  private overlayText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.levelIndex = this.registry.get('level') ?? 0;
    // Сцена перезапускается через scene.restart() на том же экземпляре —
    // сбрасываем флаги, иначе после победы и R мяч не засчитывается в кольцо.
    this.won = false;
    this.paused = false;
    this.phase2 = false;
    this.phase2Elapsed = 0;
    this.stuckTimer = 0;
    const level = LEVELS[this.levelIndex];
    const { width, height } = this.scale;

    this.matter.world.setGravity(0, GRAVITY_Y);
    // Отключаем автообновление мира: шагаем движок сами в update().
    (this.matter.world as unknown as { autoUpdate: boolean }).autoUpdate = false;
    this.createArenaBounds();
    this.createLevelObjects(level);
    this.createHud(level);
    this.createZoneVisual(level);

    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }
    // R — начать игру заново с первого уровня.
    this.input.keyboard.on('keydown-R', () => {
      this.registry.set('level', 0);
      this.scene.restart();
    });
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
  }

  /** Начинает фазу 2: надпись, вращение кольца и пониженная гравитация. */
  private startPhase2(): void {
    this.phase2 = true;
    this.hoop.setRotating(true);
    this.matter.world.setGravity(0, GRAVITY_Y / PHASE2_GRAVITY_SCALE);
    this.phaseText.setVisible(true);
  }

  update(_time: number, delta: number): void {
    if (this.paused) return;
    Matter.Engine.update(
      (this.matter.world as unknown as { engine: unknown }).engine,
      delta,
    );
    this.ball.update(delta);
    if (this.won) return;

    // Таймер фазы 2: идёт только в реальном времени, на паузе не тикает.
    if (!this.phase2) {
      this.phase2Elapsed += delta;
      if (this.phase2Elapsed >= PHASE2_DELAY_MS) {
        this.startPhase2();
      }
    }
    this.hoop.update(delta);

    const x = this.ball.getX();
    const y = this.ball.getY();
    if (this.hoop.score(x, y, this.ball.getVelocityY())) {
      this.onScore();
      return;
    }
    this.checkStuck(delta, x, y);
  }

  /** Упругие границы арены: пол, потолок, левая и правая стены. */
  private createArenaBounds(): void {
    const { width, height } = this.scale;
    const opts = { isStatic: true, restitution: WALL_RESTITUTION, friction: WALL_FRICTION };
    const t = 80; // толщина невидимых стен

    // Пол (верхняя кромка — FLOOR_Y)
    this.matter.add.rectangle(
      width / 2,
      (FLOOR_Y + height + t) / 2,
      width + t * 2,
      height - FLOOR_Y + t,
      opts,
    );
    // Потолок
    this.matter.add.rectangle(width / 2, -t / 2, width + t * 2, t, opts);
    // Левая и правая стены
    this.matter.add.rectangle(-t / 2, height / 2, t, height + t * 2, opts);
    this.matter.add.rectangle(width + t / 2, height / 2, t, height + t * 2, opts);
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
    this.add
      .rectangle(x + width / 2, y + height / 2, width, height, 0x38bdf8, 0.05)
      .setStrokeStyle(2, 0x38bdf8, 0.4);
    this.add.text(x + 8, y + 6, 'Зона управления', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#7dd3fc',
    });
  }

  private createHud(level: LevelConfig): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, 0, width, HUD_HEIGHT, 0x0f172a, 0.85).setOrigin(0.5, 0);

    this.add.text(16, 12, `Уровень ${this.levelIndex + 1}/${LEVELS.length}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
    });

    this.add
      .text(width / 2, 12, 'ЛКМ - кинуть мяч · R — заново · Esc/P — пауза', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5, 0);

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

    // Бейдж фазы: появляется при старте фазы 2.
    this.phaseText = this.add
      .text(width - 16, 12, 'ФАЗА 2', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#fb923c',
      })
      .setOrigin(1, 0)
      .setVisible(false);
  }

  private onScore(): void {
    if (this.levelIndex < LEVELS.length - 1) {
      this.registry.set('level', this.levelIndex + 1);
      this.scene.restart();
    } else {
      this.won = true;
      this.overlayText
        .setText('ВСЕ УРОВНИ ПРОЙДЕНЫ!\nНажми R, чтобы сыграть ещё раз.')
        .setVisible(true);
    }
  }

  /** Если мяч укатился из зоны и почти остановился — вернуть на старт. */
  private checkStuck(delta: number, x: number, y: number): void {
    const level = LEVELS[this.levelIndex];
    const inZone =
      x >= level.zone.x &&
      x <= level.zone.x + level.zone.width &&
      y >= level.zone.y &&
      y <= level.zone.y + level.zone.height;

    if (!inZone && this.ball.getSpeed() < STUCK_SPEED) {
      this.stuckTimer += delta;
      if (this.stuckTimer >= STUCK_TIMEOUT) {
        this.stuckTimer = 0;
        this.ball.reset(level.ballSpawn.x, level.ballSpawn.y);
      }
    } else {
      this.stuckTimer = 0;
    }
  }
}
