import Phaser from 'phaser';
import { Ball } from './Ball';
import { Hoop } from './Hoop';
import { BALL_SKINS, getNextBallSkinId } from './ballSkins';
import {
  FLOOR_Y,
  GRAVITY_Y,
  LEVELS,
  PHASE2_GRAVITY_SCALE,
  BALL_RESTING_THRESH,
  WALL_RESTITUTION,
  WALL_FRICTION,
  WALL_COLOR,
  WALL_EDGE_COLOR,
  WALL_VISUAL_THICKNESS,
  ZONE_COLOR,
  ZONE_ALPHA,
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
      Resolver: { _restingThresh: number };
    };
  }
).Matter;


// Пунктирная парабола-подсказка на 1-м уровне: как бросить мяч, чтобы попасть в кольцо.
const HINT_START = { x: 300, y: 293 }; // старт — мяч на спавне в зоне управления
const HINT_CTRL = { x: 520, y: 60 }; // контрольная точка дуги Безье (высокий навес)
const HINT_END = { x: 760, y: 460 }; // финиш — точка внутри корзины
const HINT_DASH = 12; // длина штриха пунктира, px
const HINT_GAP = 8; // длина промежутка пунктира, px

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
  private overlayText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.levelIndex = this.registry.get('level') ?? 0;
    // Восстанавливаем выбранный скин мяча (одноразово, при старте игры).
    if (this.registry.get('ballSkin') === undefined) {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem('ballSkin');
      } catch {
        // localStorage недоступен — используем скин по умолчанию
      }
      this.registry.set('ballSkin', saved ?? BALL_SKINS[0].id);
    }
    // Сцена перезапускается через scene.restart() на том же экземпляре —
    // сбрасываем флаги, иначе после победы и R мяч не засчитывается в кольцо.
    this.won = false;
    this.paused = false;
    this.phase2 = false;
    const level = LEVELS[this.levelIndex];
    const { width, height } = this.scale;

    this.matter.world.setGravity(0, GRAVITY_Y);
    // Отключаем автообновление мира: шагаем движок сами в update().
    (this.matter.world as unknown as { autoUpdate: boolean }).autoUpdate = false;
    // Разрешаем мелкие отскоки: стандартный порог Matter (~4) заставляет мяч «прилипать».
    Matter.Resolver._restingThresh = BALL_RESTING_THRESH;
    this.createArenaBounds();
    // Подсказка-траектория только на 1-м уровне; рисуем до объектов уровня, чтобы она осталась на фоне.
    if (this.levelIndex === 0) {
      this.drawHintTrajectory();
    }
    this.createLevelObjects(level);
    this.createHud(level);
    this.createZoneVisual(level);

    // Фаза 2 начинается с 6-го уровня (levelIndex = 5) и действует до конца игры.
    // При рестарте по R (level 0) фаза снова отключена.
    if (this.levelIndex >= 5) {
      this.startPhase2();
    }

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
    // C — сменить скин мяча по кругу.
    this.input.keyboard.on('keydown-C', () => this.cycleBallSkin());
  }

  /** Меняет скин мяча по кругу; выбор сохраняется в localStorage. */
  private cycleBallSkin(): void {
    const current = (this.registry.get('ballSkin') as string) ?? BALL_SKINS[0].id;
    const next = getNextBallSkinId(current);
    this.registry.set('ballSkin', next);
    try {
      localStorage.setItem('ballSkin', next);
    } catch {
      // localStorage недоступен — скин просто не сохранится между запусками
    }
    this.scene.restart();
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

    this.hoop.update(delta);

    const x = this.ball.getX();
    const y = this.ball.getY();
    if (this.hoop.score(x, y, this.ball.getVelocityY())) {
      this.onScore();
      return;
    }
  }

  /** Упругие границы арены: пол, потолок, левая и правая стены (+ их видимые рамки). */
  private createArenaBounds(): void {
    const { width, height } = this.scale;
    const opts = { isStatic: true, restitution: WALL_RESTITUTION, friction: WALL_FRICTION };
    const t = 80; // толщина невидимых стен
    const v = WALL_VISUAL_THICKNESS; // внутренние плоскости стен совпадают с нарисованной рамкой

    // Пол (верхняя кромка — FLOOR_Y)
    this.matter.add.rectangle(
      width / 2,
      (FLOOR_Y + height + t) / 2,
      width + t * 2,
      height - FLOOR_Y + t,
      opts,
    );
    // Потолок (нижняя кромка на y = v)
    this.matter.add.rectangle(width / 2, v - t / 2, width + t * 2, t, opts);
    // Левая стена (правая кромка на x = v) и правая (левая кромка на x = width - v)
    this.matter.add.rectangle(v - t / 2, height / 2, t, height + t * 2, opts);
    this.matter.add.rectangle(width - v + t / 2, height / 2, t, height + t * 2, opts);

    this.drawArenaFrame(width, height);
  }

  /** Видимые стены: полоса пола, боковые стены, потолок и контур зоны управления. */
  private drawArenaFrame(width: number, height: number): void {
    const g = this.add.graphics();
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
    g.lineStyle(2, WALL_EDGE_COLOR, 1);
    g.strokeRect(v, v, width - v * 2, FLOOR_Y - v);

  }

  /** Пунктирная парабола-подсказка: из зоны управления в корзину (только 1-й уровень). */
  private drawHintTrajectory(): void {
    const g = this.add.graphics();
    const SEGMENTS = 64;

    // Квадратичная кривая Безье: HINT_START → HINT_CTRL → HINT_END.
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
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

  /** HUD в нижней полосе пола: уровень, управление, бейдж фазы. */
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
      .text(width / 2, midY, 'ЛКМ — кинуть мяч · R — заново · Esc/P — пауза · C — скин', {
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

    // Бейдж фазы: появляется при старте фазы 2.
    this.phaseText = this.add
      .text(width - 16, midY, 'ФАЗА 2', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#fb923c',
      })
      .setOrigin(1, 0.5)
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

}
