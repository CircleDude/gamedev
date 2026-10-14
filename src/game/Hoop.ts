import Phaser from 'phaser';
import {
  WALL_RESTITUTION,
  WALL_FRICTION,
  HOOP_ROTATION_SPEED,
  type HoopConfig,
} from './constants';

const RING_COLOR = 0xef4444;

/** Тело MatterJS кольца — для вращения нужны position и angle. */
interface MatterBodyLike {
  position: { x: number; y: number };
  angle: number;
}

/**
 * Модуль MatterJS в Phaser 4 доступен в рантайме как Phaser.Physics.Matter.Matter.
 * setPosition принимает вектор {x, y} (как в Ball.ts).
 */
const Matter = (
  Phaser.Physics.Matter as unknown as {
    Matter: {
      Body: {
        setPosition(body: MatterBodyLike, position: { x: number; y: number }): void;
        setAngle(body: MatterBodyLike, angle: number): void;
      };
    };
  }
).Matter;

/**
 * Баскетбольная корзина — U-образное кольцо (открыто сверху), только красные линии.
 * Мяч перелетает через левый край и падает внутрь. Мяч отскакивает от брусков
 * и закручивается за счёт трения. Гол — когда мяч оказывается внутри корзины.
 * В фазе 2 кольцо вращается вокруг своего геометрического центра.
 */
export class Hoop {
  private readonly scene: Phaser.Scene;
  private readonly config: HoopConfig;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly bodies: MatterBodyLike[] = [];
  /** Центр вращения — геометрический центр U-образной корзины. */
  private readonly cx: number;
  private readonly cy: number;

  private scored = false;
  private rotating = false;
  private angle = 0;

  constructor(scene: Phaser.Scene, config: HoopConfig) {
    this.scene = scene;
    this.config = config;
    this.cx = config.ringX;
    this.cy = config.ringY + config.halfSize / 2;
    this.createBodies();
    this.graphics = scene.add.graphics();
    this.draw();
  }

  reset(): void {
    this.scored = false;
    this.angle = 0;
    this.rotating = false;
    this.draw();
  }

  /** Включает/выключает вращение кольца вокруг центра (фаза 2). */
  setRotating(rotating: boolean): void {
    this.rotating = rotating;
  }

  /** Каждый кадр: вращаем кольцо вокруг центра (если фаза 2 активна). */
  update(delta: number): void {
    if (!this.rotating) return;
    this.angle += (HOOP_ROTATION_SPEED * delta) / 1000;
    this.updateBodies();
    this.draw();
  }

  /**
   * Гол: центр мяча внутри корзины и мяч движется вниз.
   * При вращении кольца мяч приводится в систему координат кольца
   * (обратный поворот), затем проверяются исходные границы корзины.
   */
  score(ballX: number, ballY: number, ballVy: number): boolean {
    if (this.scored) return false;
    const { ringX, ringY, halfSize, barThickness } = this.config;
    const t = barThickness;
    const s = halfSize;

    const cos = Math.cos(-this.angle);
    const sin = Math.sin(-this.angle);
    const dx = ballX - this.cx;
    const dy = ballY - this.cy;
    const lx = this.cx + dx * cos - dy * sin;
    const ly = this.cy + dx * sin + dy * cos;

    const inBasket =
      lx > ringX - s + t &&
      lx < ringX + s - t &&
      ly > ringY &&
      ly < ringY + s - t;
    if (inBasket && ballVy > 0) {
      this.scored = true;
      return true;
    }
    return false;
  }

  private createBodies(): void {
    const { halfSize, barThickness } = this.config;
    const t = barThickness;
    const s = halfSize;
    const opts = { isStatic: true, restitution: WALL_RESTITUTION, friction: WALL_FRICTION };

    const add = (x: number, y: number, w: number, h: number): void => {
      this.bodies.push(
        this.scene.matter.add.rectangle(x, y, w, h, opts) as unknown as MatterBodyLike,
      );
    };

    // Дно корзины (смещение от центра вращения: вниз на s/2)
    add(this.cx, this.cy + s / 2, s * 2, t);
    // Левый брусок
    add(this.cx - s, this.cy, t, s);
    // Правый брусок
    add(this.cx + s, this.cy, t, s);
  }

  /** Перемещает тела брусков в позиции, повёрнутые на текущий угол вокруг центра. */
  private updateBodies(): void {
    const { halfSize, barThickness } = this.config;
    const t = barThickness;
    const s = halfSize;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const offsets: ReadonlyArray<readonly [number, number]> = [
      [0, s / 2], // дно
      [-s, 0], // левый брусок
      [s, 0], // правый брусок
    ];
    for (let i = 0; i < this.bodies.length; i++) {
      const [ox, oy] = offsets[i];
      const px = this.cx + ox * cos - oy * sin;
      const py = this.cy + ox * sin + oy * cos;
      Matter.Body.setPosition(this.bodies[i], { x: px, y: py });
      Matter.Body.setAngle(this.bodies[i], this.angle);
    }
  }

  private draw(): void {
    const g = this.graphics;
    const { halfSize, barThickness } = this.config;
    const t = barThickness;
    const s = halfSize;
    g.clear();

    // Корзина в системе координат с центром вращения в (cx, cy).
    g.save();
    g.translateCanvas(this.cx, this.cy);
    g.rotateCanvas(this.angle);

    // Дно + боковые бруски — красные линии
    g.fillStyle(RING_COLOR, 1);
    g.fillRect(-s, s / 2 - t / 2, s * 2, t); // дно
    g.fillRect(-s - t / 2, -s / 2, t, s); // лево
    g.fillRect(s - t / 2, -s / 2, t, s); // право

    g.restore();
  }
}
