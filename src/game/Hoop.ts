import Phaser from 'phaser';
import { WALL_RESTITUTION, WALL_FRICTION, type HoopConfig } from './constants';

const RING_COLOR = 0xef4444;

/**
 * Баскетбольная корзина — U-образное кольцо (открыто сверху), только красные линии.
 * Мяч перелетает через левый край и падает внутрь. Мяч отскакивает от брусков
 * и закручивается за счёт трения. Гол — когда мяч оказывается внутри корзины.
 */
export class Hoop {
  private readonly scene: Phaser.Scene;
  private readonly config: HoopConfig;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private scored = false;

  constructor(scene: Phaser.Scene, config: HoopConfig) {
    this.scene = scene;
    this.config = config;
    this.createBodies();
    this.graphics = scene.add.graphics();
    this.draw();
  }

  reset(): void {
    this.scored = false;
  }

  /**
   * Гол: центр мяча внутри корзины и мяч движется вниз.
   */
  score(ballX: number, ballY: number, ballVy: number): boolean {
    if (this.scored) return false;
    const { ringX, ringY, halfSize, barThickness } = this.config;
    const t = barThickness;
    const s = halfSize;
    const inBasket =
      ballX > ringX - s + t &&
      ballX < ringX + s - t &&
      ballY > ringY &&
      ballY < ringY + s - t;
    if (inBasket && ballVy > 0) {
      this.scored = true;
      return true;
    }
    return false;
  }

  private createBodies(): void {
    const { ringX, ringY, halfSize, barThickness } = this.config;
    const opts = { isStatic: true, restitution: WALL_RESTITUTION, friction: WALL_FRICTION };
    const t = barThickness;
    const s = halfSize;

    // Дно корзины
    this.scene.matter.add.rectangle(ringX, ringY + s, s * 2, t, opts);
    // Левый брусок
    this.scene.matter.add.rectangle(ringX - s, ringY + s / 2, t, s, opts);
    // Правый брусок
    this.scene.matter.add.rectangle(ringX + s, ringY + s / 2, t, s, opts);
  }

  private draw(): void {
    const g = this.graphics;
    const { ringX, ringY, halfSize, barThickness } = this.config;
    const t = barThickness;
    const s = halfSize;
    g.clear();

    // Корзина (дно + боковые бруски) — красные линии
    g.fillStyle(RING_COLOR, 1);
    g.fillRect(ringX - s, ringY + s - t / 2, s * 2, t); // дно
    g.fillRect(ringX - s - t / 2, ringY, t, s); // лево
    g.fillRect(ringX + s - t / 2, ringY, t, s); // право
  }
}