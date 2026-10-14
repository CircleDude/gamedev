import Phaser from 'phaser';
import {
  BALL_RADIUS,
  BALL_RESTITUTION,
  BALL_FRICTION,
  BALL_FRICTION_AIR,
  MAX_SPEED,
  MAX_DRAG,
  MAX_LAUNCH_SPEED,
  MATTER_VELOCITY_SCALE,
  FLOOR_Y,
  type ControlZone,
} from './constants';

const BALL_COLOR = 0xf97316;
const BALL_EDGE_COLOR = 0x9a3412;
const SEAM_COLOR = 0x7c2d12;
const BAND_COLOR = 0x92400e;
const ARROW_COLOR = 0xfbbf24;

/**
 * Тело MatterJS, которое Phaser 4 вешает напрямую на gameObject.body.
 * Управляется функциями модуля Matter (Phaser.Physics.Matter.Matter.Body).
 */
interface MatterBodyLike {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  speed: number;
  angle: number;
  isStatic: boolean;
  deltaTime: number;
}

type BallSprite = Phaser.GameObjects.Graphics & { body: MatterBodyLike };

/**
 * Модуль MatterJS в Phaser 4 доступен в рантайме как Phaser.Physics.Matter.Matter.
 * ВАЖНО: в рантайме setPosition/setVelocity принимают вектор {x, y},
 * хотя типы Phaser 4 ошибочно описывают три аргумента — поэтому каст.
 */
const Matter = (
  Phaser.Physics.Matter as unknown as {
    Matter: {
      Body: {
        setStatic(body: MatterBodyLike, value: boolean): void;
        setPosition(body: MatterBodyLike, position: { x: number; y: number }): void;
        setVelocity(body: MatterBodyLike, velocity: { x: number; y: number }): void;
        setAngularVelocity(body: MatterBodyLike, value: number): void;
        update(body: MatterBodyLike, deltaTime: number): void;
      };
    };
  }
).Matter;

/**
 * Баскетбольный мяч на физике Matter.
 *
 * Управление только мышью: ЛКМ на мяче — «рогатка»: мяч фиксируется на месте,
 * оттяжка задаёт бросок (мяч летит в сторону, противоположную оттяжке,
 * с силой от её длины). Вне зоны управления никакие силы не прикладываются —
 * мяч летит по физике.
 */
export class Ball {
  private readonly scene: Phaser.Scene;
  private readonly sprite: BallSprite;
  private readonly band: Phaser.GameObjects.Graphics;
  private readonly zone: ControlZone;

  private grabbed = false;
  private paused = false;
  private anchorX = 0;
  private anchorY = 0;
  private dragX = 0;
  private dragY = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, zone: ControlZone) {
    this.scene = scene;
    this.zone = zone;

    this.sprite = scene.add.graphics() as BallSprite;
    this.sprite.setPosition(x, y);
    this.drawBall();

    scene.matter.add.gameObject(this.sprite, {
      shape: { type: 'circle', radius: BALL_RADIUS },
      restitution: BALL_RESTITUTION,
      friction: BALL_FRICTION,
      frictionAir: BALL_FRICTION_AIR,
    });

    this.band = scene.add.graphics();

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.tryGrab(pointer));
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onDrag(pointer));
    scene.input.on('pointerup', () => this.release());
  }

  update(delta: number): void {
    if (this.grabbed) {
      this.updateGrabbed();
      return;
    }
    this.drawBall();
    this.capSpeed();
  }

  getX(): number {
    return this.sprite.body.position.x;
  }

  getY(): number {
    return this.sprite.body.position.y;
  }

  getVelocityY(): number {
    return this.sprite.body.velocity.y;
  }

  getSpeed(): number {
    return this.sprite.body.speed;
  }

  reset(x: number, y: number): void {
    this.grabbed = false;
    this.band.clear();
    Matter.Body.setStatic(this.sprite.body, false);
    Matter.Body.setPosition(this.sprite.body, { x, y });
    Matter.Body.setVelocity(this.sprite.body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(this.sprite.body, 0);
    this.drawBall();
  }

  /** Блокирует/разблокирует управление мячом (пауза). */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused && this.grabbed) {
      this.cancelGrab();
    }
  }

  private tryGrab(pointer: Phaser.Input.Pointer): void {
    if (this.paused || this.grabbed) return;
    if (!pointer.leftButtonDown()) return;
    // Курсор должен быть внутри зоны управления
    if (!this.isPointInZone(pointer.worldX, pointer.worldY)) return;

    // Мяч появляется там, где курсор (с ограничением по зоне и полу)
    const x = Phaser.Math.Clamp(
      pointer.worldX,
      this.zone.x + BALL_RADIUS,
      this.zone.x + this.zone.width - BALL_RADIUS,
    );
    const y = Phaser.Math.Clamp(pointer.worldY, this.zone.y + BALL_RADIUS, FLOOR_Y - BALL_RADIUS);
    Matter.Body.setStatic(this.sprite.body, false);
    Matter.Body.setPosition(this.sprite.body, { x, y });
    Matter.Body.setVelocity(this.sprite.body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(this.sprite.body, 0);

    this.grabbed = true;
    this.anchorX = x;
    this.anchorY = y;
    this.dragX = x;
    this.dragY = y;
    Matter.Body.setStatic(this.sprite.body, true);
  }

  private onDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.grabbed) return;
    this.dragX = pointer.worldX;
    this.dragY = pointer.worldY;
  }

  private release(): void {
    if (!this.grabbed) return;
    this.grabbed = false;
    Matter.Body.setStatic(this.sprite.body, false);

    // Бросок: направление противоположно оттяжке, сила от её длины.
    const dx = this.anchorX - this.dragX;
    const dy = this.anchorY - this.dragY;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      const power = Math.min(len / MAX_DRAG, 1);
      const speed = power * MAX_LAUNCH_SPEED; // px/s
      Matter.Body.setVelocity(this.sprite.body, {
        x: (dx / len) * speed * MATTER_VELOCITY_SCALE,
        y: (dy / len) * speed * MATTER_VELOCITY_SCALE,
      });
      Matter.Body.setAngularVelocity(this.sprite.body, 0);
      this.showLaunchArrow(dx / len, dy / len, power);
    }
    this.band.clear();
    this.drawBall();
  }

  /** Отменяет захват без броска (например, при паузе). */
  private cancelGrab(): void {
    this.grabbed = false;
    Matter.Body.setStatic(this.sprite.body, false);
    this.band.clear();
    this.drawBall();
  }

  private updateGrabbed(): void {
    const dx = this.dragX - this.anchorX;
    const dy = this.dragY - this.anchorY;
    const len = Math.hypot(dx, dy);
    const power = Math.min(len / MAX_DRAG, 1);
    const angle = Math.atan2(dy, dx);
    this.drawBall(power, angle);
    this.drawBand();
  }

  private capSpeed(): void {
    const v = this.sprite.body.velocity;
    const speedPxS = Math.hypot(v.x, v.y) / MATTER_VELOCITY_SCALE; // px/s
    if (speedPxS > MAX_SPEED) {
      const k = MAX_SPEED / speedPxS;
      Matter.Body.setVelocity(this.sprite.body, { x: v.x * k, y: v.y * k });
    }
  }

  private isPointInZone(px: number, py: number): boolean {
    return (
      px >= this.zone.x &&
      px <= this.zone.x + this.zone.width &&
      py >= this.zone.y &&
      py <= this.zone.y + this.zone.height
    );
  }

  /** Рисует мяч; при оттяжке — вытянутый эллипс вдоль направления оттяжки. */
  private drawBall(stretch = 0, angle = 0): void {
    const g = this.sprite;
    g.clear();
    const r = BALL_RADIUS;
    const rx = r * (1 + stretch * 0.4);
    const ry = r * (1 - stretch * 0.25);

    if (stretch > 0) {
      g.save();
      g.rotateCanvas(angle);
      g.fillStyle(BALL_COLOR, 1);
      g.fillEllipse(0, 0, rx * 2, ry * 2);
      g.lineStyle(2, BALL_EDGE_COLOR, 1);
      g.strokeEllipse(0, 0, rx * 2, ry * 2);
      g.lineStyle(2, SEAM_COLOR, 1);
      g.lineBetween(-rx, 0, rx, 0);
      g.lineBetween(0, -ry, 0, ry);
      g.restore();
    } else {
      g.fillStyle(BALL_COLOR, 1);
      g.fillCircle(0, 0, r);
      g.lineStyle(2, BALL_EDGE_COLOR, 1);
      g.strokeCircle(0, 0, r);
      g.lineStyle(2, SEAM_COLOR, 1);
      g.lineBetween(-r, 0, r, 0);
      g.lineBetween(0, -r, 0, r);
    }
  }

  /** «Резинки» рогатки и стрелка направления броска во время оттяжки. */
  private drawBand(): void {
    const g = this.band;
    g.clear();
    const dx = this.dragX - this.anchorX;
    const dy = this.dragY - this.anchorY;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;

    const nx = -dy / len;
    const ny = dx / len;
    g.lineStyle(3, BAND_COLOR, 1);
    g.lineBetween(this.anchorX + nx * 6, this.anchorY + ny * 6, this.dragX, this.dragY);
    g.lineBetween(this.anchorX - nx * 6, this.anchorY - ny * 6, this.dragX, this.dragY);

    const power = Math.min(len / MAX_DRAG, 1);
    const dirX = -dx / len;
    const dirY = -dy / len;
    const arrowLen = 30 + power * 50;
    const tipX = this.anchorX + dirX * arrowLen;
    const tipY = this.anchorY + dirY * arrowLen;
    g.lineStyle(3, ARROW_COLOR, 1);
    g.lineBetween(this.anchorX, this.anchorY, tipX, tipY);
    const a = Math.atan2(dirY, dirX);
    g.fillStyle(ARROW_COLOR, 1);
    g.fillTriangle(
      tipX,
      tipY,
      tipX - 10 * Math.cos(a - 0.4),
      tipY - 10 * Math.sin(a - 0.4),
      tipX - 10 * Math.cos(a + 0.4),
      tipY - 10 * Math.sin(a + 0.4),
    );
  }

  /** Короткая стрелка-«вжух» в момент броска. */
  private showLaunchArrow(dirX: number, dirY: number, power: number): void {
    const g = this.band;
    g.clear();
    const arrowLen = 30 + power * 50;
    const tipX = this.anchorX + dirX * arrowLen;
    const tipY = this.anchorY + dirY * arrowLen;
    g.lineStyle(3, ARROW_COLOR, 1);
    g.lineBetween(this.anchorX, this.anchorY, tipX, tipY);
    const a = Math.atan2(dirY, dirX);
    g.fillStyle(ARROW_COLOR, 1);
    g.fillTriangle(
      tipX,
      tipY,
      tipX - 10 * Math.cos(a - 0.4),
      tipY - 10 * Math.sin(a - 0.4),
      tipX - 10 * Math.cos(a + 0.4),
      tipY - 10 * Math.sin(a + 0.4),
    );
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        g.clear();
        g.setAlpha(1);
      },
    });
  }
}