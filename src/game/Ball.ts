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
  FIST_SIZE,
  FIST_GRIP,
  LAUNCH_ANIM_MS,
  type ControlZone,
} from './constants';
import { BALL_SKINS, ensureBallTexture, getBallSkin, type BallSkin } from './ballSkins';

const ARROW_COLOR = 0xfbbf24;
/** Размер (высота) треугольного наконечника стрелки. */
const ARROW_HEAD = 11;

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
  /** Текущий скин — резинка рисуется в его цветах. */
  private readonly skin: BallSkin;
  /** Кулак-спрайт: тот же depth, что у резинки, но добавлен после неё. */
  private readonly fist: Phaser.GameObjects.Image;

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
    // Кулак — спрайт fist.png: depth как у резинки, добавлен после неё,
    // поэтому рисуется поверх резинки; мяч (depth 0) — поверх кулака.
    this.fist = scene.add.image(x, y, 'fist');
    this.fist.setDepth(-1);
    this.fist.setVisible(false);
    // Отображаемая ширина — FIST_SIZE, высота пропорциональна текстуре.
    this.fist.setScale(FIST_SIZE / this.fist.width);

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
    this.clearBand();
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
    this.clearBand();
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
    // Кулак исчезает в момент удара.
    this.clearBand();
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
    this.clearBand();
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
   * Резинка рогатки: края отодвинуты от мяча, толще, с закруглёнными концами.
   * Обе стороны резинки крепятся у боковых краёв кулака, каждая на своей
   * стороне — линии не пересекаются и прячутся за кулаком. Кулак-спрайт
   * ставится в точку натяжения и повёрнут «верхом» (костяшками) к мячу —
   * строго между резинкой и мячом. showArrow=false скрывает
   * прицельную стрелку (используется в анимации удара); после запуска стрелка
   * рисуется отдельно (см. launchBall / updateArrow).
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

    // Крепления у боковых краёв кулака — по тому же перпендикуляру, что и
    // края рогатки: стороны резинки не меняются местами и не пересекаются.
    const gripAx = fistX + nx * FIST_GRIP;
    const gripAy = fistY + ny * FIST_GRIP;
    const gripBx = fistX - nx * FIST_GRIP;
    const gripBy = fistY - ny * FIST_GRIP;

    g.lineStyle(BAND_WIDTH, this.skin.edge, 1);
    g.lineBetween(tipAx, tipAy, gripAx, gripAy);
    g.lineBetween(tipBx, tipBy, gripBx, gripBy);
    // Закруглённые концы резинки.
    g.fillStyle(this.skin.edge, 1);
    g.fillCircle(tipAx, tipAy, BAND_WIDTH / 2);
    g.fillCircle(tipBx, tipBy, BAND_WIDTH / 2);
    g.fillCircle(gripAx, gripAy, BAND_WIDTH / 2);
    g.fillCircle(gripBx, gripBy, BAND_WIDTH / 2);

    // Кулак-спрайт поверх резинки (тот же depth, добавлен после band),
    // мяч выше по глубине. Поворот: «верх» спрайта (0, −1) направляем в
    // сторону мяча (dx, dy) — угол = atan2(dy, dx) + π/2.
    this.fist.setPosition(fistX, fistY);
    this.fist.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
    this.fist.setVisible(true);

    // Прицельная стрелка — от мяча в сторону броска, длина зависит от натяжения.
    if (showArrow) {
      const power = Math.min(dist / MAX_DRAG, 1);
      const tipX = ax + (dx / dist) * (30 + power * 50);
      const tipY = ay + (dy / dist) * (30 + power * 50);
      this.drawArrowLine(g, ax, ay, tipX, tipY);
    }
  }

  /** Очищает резинку и прячет кулак (сброс визуала рогатки). */
  private clearBand(): void {
    this.band.clear();
    this.fist.setVisible(false);
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
      this.clearBand();
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
    const a = Math.atan2(tipY - baseY, tipX - baseX);
    // Линия заканчивается у основания треугольника — вплотную, без наложения.
    g.lineStyle(4, ARROW_COLOR, 1);
    g.lineBetween(
      baseX,
      baseY,
      tipX - ARROW_HEAD * Math.cos(a),
      tipY - ARROW_HEAD * Math.sin(a),
    );
    g.fillStyle(ARROW_COLOR, 1);
    g.fillTriangle(
      tipX,
      tipY,
      tipX - ARROW_HEAD * Math.cos(a - 0.45),
      tipY - ARROW_HEAD * Math.sin(a - 0.45),
      tipX - ARROW_HEAD * Math.cos(a + 0.45),
      tipY - ARROW_HEAD * Math.sin(a + 0.45),
    );
  }
}
