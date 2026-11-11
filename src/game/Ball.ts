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
  BALL_SQUASH_MAX,
  BALL_SQUASH_MS,
  BALL_SQUASH_SPEED,
  type ControlZone,
} from './constants';
import { BALL_SKINS, ensureBallTexture, getBallSkin } from './ballSkins';

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

/** Пара столкновения Matter — достаточно нормали контакта и участвующих тел. */
interface CollisionPairLike {
  bodyA: MatterBodyLike;
  bodyB: MatterBodyLike;
  collision: { normal: { x: number; y: number } };
}

type BallBody = Phaser.GameObjects.Sprite & { body: MatterBodyLike };

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
 * Физика и визуал развязаны: физический gameObject (невидимый спрайт с Matter body)
 * никогда не деформируется вручную, потому что Phaser синхронизирует scale спрайта
 * в тело и меняет массу/инерцию («эффект противовеса»). Весь внешний вид —
 * отдельный видимый спрайт, который только читает позицию/поворот тела.
 *
 * Управление только мышью: ЛКМ на мяче — «рогатка»: мяч фиксируется на месте,
 * оттяжка задаёт бросок (мяч летит в сторону, противоположную оттяжке,
 * с силой от её длины). Вне зоны управления никакие силы не прикладываются —
 * мяч летит по физике.
 */
export class Ball {
  private readonly scene: Phaser.Scene;
  /** Физическое тело (невидимое); его transform не трогаем — только через Matter.Body.*. */
  private readonly bodySprite: BallBody;
  /**
   * Видимый узел: контейнер с осью деформации (rotation = угол растяжения,
   * scale = деформация). Ось растяжения произвольная, а узор мяча не дёргается,
   * потому что ориентация узора живёт в дочернем ballImage.
   */
  private readonly view: Phaser.GameObjects.Container;
  /** Изображение мяча внутри контейнера: rotation = body.angle − ось деформации. */
  private readonly ballImage: Phaser.GameObjects.Image;
  private readonly band: Phaser.GameObjects.Graphics;
  private readonly zone: ControlZone;

  private grabbed = false;
  private paused = false;
  private anchorX = 0;
  private anchorY = 0;
  private dragX = 0;
  private dragY = 0;

  // Визуальное сжатие при ударе: вдоль нормали контакта.
  private squashTimer = 0;
  private squashPower = 0;
  private squashAngle = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, zone: ControlZone) {
    this.scene = scene;
    this.zone = zone;

    const skinId = (scene.registry.get('ballSkin') as string | undefined) ?? BALL_SKINS[0].id;
    const textureKey = ensureBallTexture(scene, getBallSkin(skinId));

    this.bodySprite = scene.add.sprite(x, y, textureKey) as BallBody;

    scene.matter.add.gameObject(this.bodySprite, {
      shape: { type: 'circle', radius: BALL_RADIUS },
      restitution: BALL_RESTITUTION,
      friction: BALL_FRICTION,
      frictionAir: BALL_FRICTION_AIR,
    });
    this.bodySprite.setVisible(false);

    this.view = scene.add.container(x, y);
    this.ballImage = scene.add.image(0, 0, textureKey);
    this.view.add(this.ballImage);
    this.band = scene.add.graphics();

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.tryGrab(pointer));
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onDrag(pointer));
    scene.input.on('pointerup', () => this.release());
    scene.matter.world.on('collisionstart', this.onCollisionStart, this);

    scene.events.once('shutdown', () => {
      scene.matter.world.off('collisionstart', this.onCollisionStart, this);
    });
  }

  update(delta: number): void {
    if (this.grabbed) {
      this.updateGrabbed();
    } else {
      if (this.squashTimer > 0) {
        this.updateSquash(delta);
      } else {
        this.resetVisual();
      }
      this.capSpeed();
    }
    this.syncView();
  }

  getX(): number {
    return this.bodySprite.body.position.x;
  }

  getY(): number {
    return this.bodySprite.body.position.y;
  }

  getVelocityY(): number {
    return this.bodySprite.body.velocity.y;
  }

  getSpeed(): number {
    return this.bodySprite.body.speed;
  }

  reset(x: number, y: number): void {
    this.grabbed = false;
    this.squashTimer = 0;
    this.band.clear();
    Matter.Body.setStatic(this.bodySprite.body, false);
    Matter.Body.setPosition(this.bodySprite.body, { x, y });
    Matter.Body.setVelocity(this.bodySprite.body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(this.bodySprite.body, 0);
    this.resetVisual();
    this.syncView();
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
    Matter.Body.setStatic(this.bodySprite.body, false);
    Matter.Body.setPosition(this.bodySprite.body, { x, y });
    Matter.Body.setVelocity(this.bodySprite.body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(this.bodySprite.body, 0);

    this.grabbed = true;
    this.anchorX = x;
    this.anchorY = y;
    this.dragX = x;
    this.dragY = y;
    Matter.Body.setStatic(this.bodySprite.body, true);
    this.syncView();
  }

  private onDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.grabbed) return;
    this.dragX = pointer.worldX;
    this.dragY = pointer.worldY;
  }

  private release(): void {
    if (!this.grabbed) return;
    this.grabbed = false;
    Matter.Body.setStatic(this.bodySprite.body, false);

    // Бросок: направление противоположно оттяжке, сила от её длины.
    const dx = this.anchorX - this.dragX;
    const dy = this.anchorY - this.dragY;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      const power = Math.min(len / MAX_DRAG, 1);
      const speed = power * MAX_LAUNCH_SPEED; // px/s
      Matter.Body.setVelocity(this.bodySprite.body, {
        x: (dx / len) * speed * MATTER_VELOCITY_SCALE,
        y: (dy / len) * speed * MATTER_VELOCITY_SCALE,
      });
      Matter.Body.setAngularVelocity(this.bodySprite.body, 0);
      this.showLaunchArrow(dx / len, dy / len, power);
    }
    this.band.clear();
    this.resetVisual();
    this.syncView();
  }

  /** Отменяет захват без броска (например, при паузе). */
  private cancelGrab(): void {
    this.grabbed = false;
    Matter.Body.setStatic(this.bodySprite.body, false);
    this.band.clear();
    this.resetVisual();
    this.syncView();
  }

  private updateGrabbed(): void {
    const dx = this.dragX - this.anchorX;
    const dy = this.dragY - this.anchorY;
    const len = Math.hypot(dx, dy);
    const power = Math.min(len / MAX_DRAG, 1);
    if (len > 1) {
      // Растяжение строго вдоль прямой рогатки — в мировых координатах,
      // независимо от текущего поворота тела.
      const axis = Math.atan2(dy, dx);
      this.view.rotation = axis;
      this.view.scaleX = 1 + power * 0.4;
      this.view.scaleY = 1 - power * 0.25;
      // Компенсируем поворот оси деформации, чтобы узор мяча не дёргался.
      this.ballImage.rotation = this.bodySprite.body.angle - axis;
    } else {
      this.resetVisual();
    }
    this.drawBand();
  }

  /** Короткое «пружинное» сжатие при ударе: вдоль нормали контакта. */
  private updateSquash(delta: number): void {
    this.squashTimer -= delta;
    const t = Math.max(this.squashTimer, 0) / BALL_SQUASH_MS;
    const pulse = Math.sin(t * Math.PI); // сжатие нарастает и плавно спадает
    const s = this.squashPower * pulse;
    this.view.rotation = this.squashAngle;
    this.view.scaleX = 1 - BALL_SQUASH_MAX * s;
    this.view.scaleY = 1 + BALL_SQUASH_MAX * 0.6 * s;
    // Компенсируем поворот оси деформации, чтобы узор мяча не дёргался.
    this.ballImage.rotation = this.bodySprite.body.angle - this.squashAngle;
    if (this.squashTimer <= 0) {
      this.squashTimer = 0;
      this.resetVisual();
    }
  }

  private onCollisionStart(event: { pairs: CollisionPairLike[] }): void {
    if (this.grabbed) return;
    for (const pair of event.pairs) {
      if (pair.bodyA !== this.bodySprite.body && pair.bodyB !== this.bodySprite.body) continue;
      const normal = pair.collision.normal;
      this.squashAngle = Math.atan2(normal.y, normal.x);
      const speedPxS = this.bodySprite.body.speed / MATTER_VELOCITY_SCALE;
      this.squashPower = Phaser.Math.Clamp(speedPxS / BALL_SQUASH_SPEED, 0, 1);
      this.squashTimer = BALL_SQUASH_MS;
    }
  }

  /** Возвращает видимый узел к недеформированному виду с поворотом тела. */
  private resetVisual(): void {
    this.view.scaleX = 1;
    this.view.scaleY = 1;
    this.view.rotation = 0;
    this.ballImage.rotation = this.bodySprite.body.angle;
  }

  /** Копирует позицию физического тела в видимый спрайт. */
  private syncView(): void {
    this.view.x = this.bodySprite.body.position.x;
    this.view.y = this.bodySprite.body.position.y;
  }

  private capSpeed(): void {
    const v = this.bodySprite.body.velocity;
    const speedPxS = Math.hypot(v.x, v.y) / MATTER_VELOCITY_SCALE; // px/s
    if (speedPxS > MAX_SPEED) {
      const k = MAX_SPEED / speedPxS;
      Matter.Body.setVelocity(this.bodySprite.body, { x: v.x * k, y: v.y * k });
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
