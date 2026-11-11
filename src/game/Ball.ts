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
  BAND_FORK_OFFSET,
  BAND_WIDTH,
  FIST_RADIUS,
  FIST_TRAIL,
  LAUNCH_ANIM_MS,
  FIST_COLOR,
  FIST_EDGE,
  FIST_SEAM,
  type ControlZone,
} from './constants';
import { BALL_SKINS, ensureBallTexture, getBallSkin, type BallSkin } from './ballSkins';

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
  /** Текущий скин — резинка и кулак рисуются в его цветах. */
  private readonly skin: BallSkin;

  private grabbed = false;
  private paused = false;
  private anchorX = 0;
  private anchorY = 0;
  private dragX = 0;
  private dragY = 0;

  // Анимация запуска: резинка летит к мячу, «бьёт» его — и мяч стартует.
  private launching = false;
  private launchTimer = 0;
  private launchDir = { x: 0, y: 0 };
  private launchPower = 0;
  private launchFistX = 0;
  private launchFistY = 0;

  // Визуальное сжатие при ударе: вдоль нормали контакта.
  private squashTimer = 0;
  private squashPower = 0;
  private squashAngle = 0;

  // Пока рогатка натянута, курсор отслеживается на уровне окна (см. attachWindowDrag).
  private readonly onWindowPointerMove = (event: PointerEvent): void => {
    if (!this.grabbed) return;
    const p = this.eventToWorld(event);
    this.setDragPoint(p.x, p.y);
  };

  private readonly onWindowPointerUp = (): void => {
    this.release();
  };

  // Стрелка запуска: дальний конец зафиксирован в мире при запуске, основание
  // следует за центром мяча; исчезает по длине ≤ радиуса мяча или по таймауту.
  private arrowTipX = 0;
  private arrowTipY = 0;
  private arrowTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, zone: ControlZone) {
    this.scene = scene;
    this.zone = zone;

    const skinId = (scene.registry.get('ballSkin') as string | undefined) ?? BALL_SKINS[0].id;
    this.skin = getBallSkin(skinId);
    const textureKey = ensureBallTexture(scene, this.skin);

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
    // Резинка рогатки рисуется под мячом.
    this.band = scene.add.graphics();
    this.band.setDepth(-1);

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.tryGrab(pointer));
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onDrag(pointer));
    scene.input.on('pointerup', () => this.release());
    // Отпускание рогатки за пределами canvas (курсор вышел за игровое поле).
    scene.input.on('pointerupoutside', () => this.release());
    scene.matter.world.on('collisionstart', this.onCollisionStart, this);

    // ВАЖНО: ссылку на мир берём заранее — при shutdown `scene.matter` уже null,
    // и обращение к нему в callback ломает рестарт сцены (игра «зависает»).
    const world = scene.matter.world;
    scene.events.once('shutdown', () => {
      world.off('collisionstart', this.onCollisionStart, this);
    });
  }

  update(delta: number): void {
    if (this.grabbed) {
      this.updateGrabbed();
    } else if (this.launching) {
      this.updateLaunchAnimation(delta);
    } else {
      this.updateArrow(delta);
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
    this.arrowTimer = 0;
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
    if (this.paused || this.grabbed || this.launching) return;
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
    // Курсор отслеживаем на уровне окна: перетаскивание не обрывается,
    // когда курсор выходит за canvas (и даже за игровое поле — в пределах страницы).
    this.attachWindowDrag();
    this.syncView();
  }

  /** Переводит координаты окна (clientX/Y) в координаты игрового мира. */
  private eventToWorld(event: PointerEvent): { x: number; y: number } {
    const world = this.scene.cameras.main.getWorldPoint(
      this.scene.scale.transformX(event.clientX),
      this.scene.scale.transformY(event.clientY),
    );
    return { x: world.x, y: world.y };
  }

  private attachWindowDrag(): void {
    window.addEventListener('pointermove', this.onWindowPointerMove);
    window.addEventListener('pointerup', this.onWindowPointerUp);
  }

  private detachWindowDrag(): void {
    window.removeEventListener('pointermove', this.onWindowPointerMove);
    window.removeEventListener('pointerup', this.onWindowPointerUp);
  }

  private onDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.grabbed) return;
    this.setDragPoint(pointer.worldX, pointer.worldY);
  }

  /**
   * Обновляет точку натяжения (кулак). На пределе (MAX_DRAG) резинка дальше
   * не тянется — кулак останавливается на границе, сила фиксируется.
   */
  private setDragPoint(x: number, y: number): void {
    const dx = x - this.anchorX;
    const dy = y - this.anchorY;
    const len = Math.hypot(dx, dy);
    if (len > MAX_DRAG) {
      const k = MAX_DRAG / len;
      this.dragX = this.anchorX + dx * k;
      this.dragY = this.anchorY + dy * k;
    } else {
      this.dragX = x;
      this.dragY = y;
    }
  }

  private release(): void {
    if (!this.grabbed) return;
    this.grabbed = false;
    this.detachWindowDrag();

    // Бросок: направление противоположно оттяжке, сила от её длины.
    const dx = this.anchorX - this.dragX;
    const dy = this.anchorY - this.dragY;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      // Анимация: резинка летит к мячу, «бьёт» его — и мяч стартует (≤200 мс).
      // Мяч остаётся на месте (статичным) до момента удара.
      this.launching = true;
      this.launchTimer = LAUNCH_ANIM_MS;
      this.launchDir = { x: dx / len, y: dy / len };
      this.launchPower = Math.min(len / MAX_DRAG, 1);
      this.launchFistX = this.dragX;
      this.launchFistY = this.dragY;
      // Стрелка запуска появляется сразу при отпускании: дальний конец фиксируется
      // в конечной точке, основание — на мяче (мяч ещё статичен в якоре).
      // Это исключает «мигание» во время анимации удара (LAUNCH_ANIM_MS).
      this.arrowTipX = this.anchorX + this.launchDir.x * (30 + this.launchPower * 50);
      this.arrowTipY = this.anchorY + this.launchDir.y * (30 + this.launchPower * 50);
      return;
    }
    Matter.Body.setStatic(this.bodySprite.body, false);
    this.band.clear();
    this.resetVisual();
    this.syncView();
  }

  /** Запуск мяча в конце анимации удара резинки. */
  private launchBall(): void {
    this.launching = false;
    Matter.Body.setStatic(this.bodySprite.body, false);
    const speed = this.launchPower * MAX_LAUNCH_SPEED; // px/s
    Matter.Body.setVelocity(this.bodySprite.body, {
      x: this.launchDir.x * speed * MATTER_VELOCITY_SCALE,
      y: this.launchDir.y * speed * MATTER_VELOCITY_SCALE,
    });
    Matter.Body.setAngularVelocity(this.bodySprite.body, 0);
    // Резинка «ударила»: мяч сжимается той же логикой, что и при столкновении —
    // ось вдоль линии удара, сила от скорости (см. startSquash).
    const speedPxS = this.launchPower * MAX_LAUNCH_SPEED;
    this.startSquash(this.launchDir.x, this.launchDir.y, speedPxS);
    // Стрелка уже зафиксирована при отпускании (release) и видна всю анимацию
    // удара — здесь запускается только таймаут исчезновения.
    this.arrowTimer = BALL_SQUASH_MS;
    // Рисуем стрелку сразу в кадре удара — без «мигания» на один кадр.
    this.band.clear();
    const bx = this.bodySprite.body.position.x;
    const by = this.bodySprite.body.position.y;
    this.drawArrowLine(this.band, bx, by, this.arrowTipX, this.arrowTipY);
    this.resetVisual();
    this.syncView();
  }

  /** Анимация полёта резинки к мячу перед запуском. */
  private updateLaunchAnimation(delta: number): void {
    this.launchTimer -= delta;
    const t = Math.max(this.launchTimer, 0) / LAUNCH_ANIM_MS; // 1 → 0
    // Кулак летит к мячу с ускорением (ease-in) — резинка «выстреливает».
    const e = t * t;
    const fx = this.anchorX + (this.launchFistX - this.anchorX) * e;
    const fy = this.anchorY + (this.launchFistY - this.anchorY) * e;
    // Мяч остаётся растянутым, пока резинка не «ударила».
    const axis = Math.atan2(-this.launchDir.y, -this.launchDir.x);
    this.view.rotation = axis;
    this.view.scaleX = 1 + this.launchPower * 0.4;
    this.view.scaleY = 1 - this.launchPower * 0.25;
    this.ballImage.rotation = this.bodySprite.body.angle - axis;
    // Кулак летит в мяч целиком: резинка «запускает» его.
    // Стрелка прицеливания скрыта, но стрелка запуска рисуется всю анимацию
    // (наконечник уже зафиксирован, основание — на статичном мяче), поэтому
    // стрелка не пропадает между отпусканием и ударом.
    this.drawBand(fx, fy, false);
    const bx = this.bodySprite.body.position.x;
    const by = this.bodySprite.body.position.y;
    this.drawArrowLine(this.band, bx, by, this.arrowTipX, this.arrowTipY);
    if (this.launchTimer <= 0) {
      this.launchBall();
    }
  }

  /** Отменяет захват без броска (например, при паузе). */
  private cancelGrab(): void {
    this.grabbed = false;
    this.launching = false;
    this.arrowTimer = 0;
    this.detachWindowDrag();
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
    this.drawBand(this.dragX, this.dragY);
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
      const speedPxS = this.bodySprite.body.speed / MATTER_VELOCITY_SCALE;
      this.startSquash(normal.x, normal.y, speedPxS);
    }
  }

  /**
   * Запускает визуальный пульс сжатия (общая реализация для столкновений и
   * запуска): ось — вдоль нормали удара, сила — от скорости, ограничения
   * одинаковые: clamp(скорость / BALL_SQUASH_SPEED, 0, 1), длительность BALL_SQUASH_MS.
   */
  private startSquash(normalX: number, normalY: number, speedPxS: number): void {
    this.squashAngle = Math.atan2(normalY, normalX);
    this.squashPower = Phaser.Math.Clamp(speedPxS / BALL_SQUASH_SPEED, 0, 1);
    this.squashTimer = BALL_SQUASH_MS;
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

  /**
   * Резинка рогатки: края отодвинуты от мяча, толще, с закруглёнными концами и
   * огибанием «кулака» у курсора. showArrow=false скрывает прицельную стрелку
   * (используется в анимации удара); после запуска стрелка рисуется отдельно
   * (см. launchBall / updateArrow).
   */
  private drawBand(fistX: number, fistY: number, showArrow = true): void {
    const g = this.band;
    g.clear();
    const ax = this.anchorX;
    const ay = this.anchorY;
    const dx = ax - fistX;
    const dy = ay - fistY;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) {
      return;
    }
    const nx = -dy / dist;
    const ny = dx / dist;

    // Края «рогатки» отодвинуты от мяча перпендикулярно линии натяжения.
    const tipAx = ax + nx * BAND_FORK_OFFSET;
    const tipAy = ay + ny * BAND_FORK_OFFSET;
    const tipBx = ax - nx * BAND_FORK_OFFSET;
    const tipBy = ay - ny * BAND_FORK_OFFSET;

    // Резинка огибает кулак дугой со стороны мяча — без излома у курсора.
    const theta = Math.atan2(fistY - ay, fistX - ax); // мяч → кулак
    const spread = 0.55;
    const pAx = fistX + Math.cos(theta + spread) * FIST_RADIUS;
    const pAy = fistY + Math.sin(theta + spread) * FIST_RADIUS;
    const pBx = fistX + Math.cos(theta - spread) * FIST_RADIUS;
    const pBy = fistY + Math.sin(theta - spread) * FIST_RADIUS;

    g.lineStyle(BAND_WIDTH, this.skin.edge, 1);
    g.lineBetween(tipAx, tipAy, pAx, pAy);
    g.lineBetween(tipBx, tipBy, pBx, pBy);
    const SEGMENTS = 6;
    for (let i = 0; i < SEGMENTS; i++) {
      const a1 = theta - spread + (2 * spread * i) / SEGMENTS;
      const a2 = theta - spread + (2 * spread * (i + 1)) / SEGMENTS;
      g.lineBetween(
        fistX + Math.cos(a1) * FIST_RADIUS,
        fistY + Math.sin(a1) * FIST_RADIUS,
        fistX + Math.cos(a2) * FIST_RADIUS,
        fistY + Math.sin(a2) * FIST_RADIUS,
      );
    }
    // Закруглённые концы резинки.
    g.fillStyle(this.skin.edge, 1);
    g.fillCircle(tipAx, tipAy, BAND_WIDTH / 2);
    g.fillCircle(tipBx, tipBy, BAND_WIDTH / 2);
    g.fillCircle(pAx, pAy, BAND_WIDTH / 2);
    g.fillCircle(pBx, pBy, BAND_WIDTH / 2);

    // Кулак между резинкой и мячом, «смотрит» костяшками в сторону мяча.
    this.drawFist(g, fistX, fistY, theta - Math.PI / 2);

    // Свисающие концы резинки за кулаком.
    g.lineStyle(BAND_WIDTH - 1, this.skin.edge, 1);
    const back = theta + Math.PI;
    for (const off of [-0.6, 0.6]) {
      const a = back + off;
      const sx = fistX + Math.cos(a) * FIST_RADIUS;
      const sy = fistY + Math.sin(a) * FIST_RADIUS;
      g.lineBetween(sx, sy, sx + Math.cos(a) * FIST_TRAIL, sy + Math.sin(a) * FIST_TRAIL);
      g.fillCircle(sx + Math.cos(a) * FIST_TRAIL, sy + Math.sin(a) * FIST_TRAIL, (BAND_WIDTH - 1) / 2);
    }

    // Прицельная стрелка — от мяча в сторону броска, длина зависит от натяжения.
    if (showArrow) {
      const power = Math.min(dist / MAX_DRAG, 1);
      const tipX = ax + (dx / dist) * (30 + power * 50);
      const tipY = ay + (dy / dist) * (30 + power * 50);
      this.drawArrowLine(g, ax, ay, tipX, tipY);
    }
  }

  /**
   * Кулак: белый с чёрным контуром, повёрнут костяшками в сторону мяча
   * (локальный «верх» кисти — костяшки — направляется на угол rotation).
   */
  private drawFist(g: Phaser.GameObjects.Graphics, x: number, y: number, rotation: number): void {
    g.save();
    g.translateCanvas(x, y);
    g.rotateCanvas(rotation);

    const left = -FIST_RADIUS + 1;
    const right = FIST_RADIUS - 1;
    const top = -3;
    const bottom = FIST_RADIUS - 2;
    const kr = 2.75; // радиус «костяшки»

    // Большой палец — отдельно, ладонь перекрывает его внутреннюю часть.
    g.fillStyle(FIST_COLOR, 1);
    g.lineStyle(2.5, FIST_EDGE, 1);
    g.fillCircle(-13, 1, 4.5);
    g.strokeCircle(-13, 1, 4.5);

    // Ладонь: бугры костяшек сверху, скруглённый низ.
    g.fillStyle(FIST_COLOR, 1);
    g.lineStyle(2.5, FIST_EDGE, 1);
    g.beginPath();
    g.moveTo(left, bottom - 4);
    g.lineTo(left, top);
    for (let i = 0; i < 4; i++) {
      const cx = left + kr + i * kr * 2;
      g.arc(cx, top, kr, Math.PI, 0, false);
    }
    g.lineTo(right, bottom - 4);
    g.arc(right - 2, bottom - 2, 2, 0, Math.PI / 2, false);
    g.lineTo(left + 2, bottom);
    g.arc(left + 2, bottom - 2, 2, Math.PI / 2, Math.PI, false);
    g.closePath();
    g.fillPath();
    g.strokePath();

    // Разделительные линии пальцев.
    g.lineStyle(1.5, FIST_SEAM, 1);
    for (const off of [-kr, 0, kr]) {
      const cx = left + kr * 2 + off + kr / 2;
      g.lineBetween(cx, top + 1, cx, top + 5);
    }

    g.restore();
  }

  /**
   * Стрелка запуска: дальний конец стоит на месте, основание следует за центром
   * мяча. Исчезает, когда длина доходит до радиуса мяча (с погрешностью), либо
   * по таймауту — на случай удара в стену и отскока.
   */
  private updateArrow(delta: number): void {
    if (this.arrowTimer <= 0) return;
    this.arrowTimer -= delta;
    const bx = this.bodySprite.body.position.x;
    const by = this.bodySprite.body.position.y;
    const len = Math.hypot(this.arrowTipX - bx, this.arrowTipY - by);
    if (len <= BALL_RADIUS - 3 || this.arrowTimer <= 0) {
      this.arrowTimer = 0;
      this.band.clear();
      return;
    }
    const g = this.band;
    g.clear();
    this.drawArrowLine(g, bx, by, this.arrowTipX, this.arrowTipY);
  }

  /** Стрелка от базовой точки к зафиксированному наконечнику. */
  private drawArrowLine(
    g: Phaser.GameObjects.Graphics,
    baseX: number,
    baseY: number,
    tipX: number,
    tipY: number,
  ): void {
    g.lineStyle(4, ARROW_COLOR, 1);
    g.lineBetween(baseX, baseY, tipX, tipY);
    const a = Math.atan2(tipY - baseY, tipX - baseX);
    g.fillStyle(ARROW_COLOR, 1);
    g.fillTriangle(
      tipX,
      tipY,
      tipX - 11 * Math.cos(a - 0.45),
      tipY - 11 * Math.sin(a - 0.45),
      tipX - 11 * Math.cos(a + 0.45),
      tipY - 11 * Math.sin(a + 0.45),
    );
  }
}
