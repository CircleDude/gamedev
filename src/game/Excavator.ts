import Phaser from 'phaser';
import { Terrain } from './Terrain';

export const MOVE_SPEED = 120;
export const ARM_SPEED = 1.6;
export const ARM_MIN = 0.15;
export const ARM_MAX = 1.5;
export const BOOM_LEN = 40;
export const STICK_LEN = 30;
export const BUCKET_RADIUS = 16;
export const DIG_RATE = 0.8;
export const MAX_STEP = 20;
export const TRACKS_OFFSET = 22;

const TRACKS_COLOR = 0x334155;
const CAB_COLOR = 0xfacc15;
const ARM_COLOR = 0xf59e0b;
const BUCKET_COLOR = 0x475569;

const STICK_ANGLE_OFFSET = 0.6;
const ARM_PIVOT_X = 8;

/**
 * Экскаватор: гусеницы, кабина, стрела из двух сегментов и ковш.
 * Управление: ←/→ — движение, ↓ — опустить ковш и копать, ↑ — поднять ковш.
 * Экскаватор всегда «стоит» на опоре (поверхности земли) и опускается,
 * когда копает ячейки под собой.
 */
export class Excavator {
  x: number;
  y: number;

  private readonly tracks: Phaser.GameObjects.Rectangle;
  private readonly cab: Phaser.GameObjects.Rectangle;
  private readonly boom: Phaser.GameObjects.Rectangle;
  private readonly stick: Phaser.GameObjects.Rectangle;
  private readonly bucket: Phaser.GameObjects.Rectangle;
  private armAngle = ARM_MIN;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x;
    this.y = y;

    this.tracks = scene.add.rectangle(x, y + 14, 36, 16, TRACKS_COLOR);
    this.cab = scene.add.rectangle(x, y - 2, 26, 26, CAB_COLOR);
    this.boom = scene.add.rectangle(x + ARM_PIVOT_X, y, BOOM_LEN, 8, ARM_COLOR).setOrigin(0, 0.5);
    this.stick = scene.add.rectangle(x, y, STICK_LEN, 6, ARM_COLOR).setOrigin(0, 0.5);
    this.bucket = scene.add.rectangle(x, y, 18, 12, BUCKET_COLOR);

    this.updateArm();
  }

  update(delta: number, cursors: Phaser.Types.Input.Keyboard.CursorKeys, terrain: Terrain): void {
    const seconds = delta / 1000;
    const dx = (cursors.right.isDown ? 1 : 0) - (cursors.left.isDown ? 1 : 0);
    const armDir = (cursors.down.isDown ? 1 : 0) - (cursors.up.isDown ? 1 : 0);

    if (dx !== 0) {
      const targetX = Phaser.Math.Clamp(this.x + dx * MOVE_SPEED * seconds, 30, 930);
      const currentSupport = terrain.getSupportY(this.x, this.y + 10);
      const targetSupport = terrain.getSupportY(targetX, this.y + 10);
      // Нельзя заехать на стену выше MAX_STEP — нужно копать пандус
      if (targetSupport - currentSupport <= MAX_STEP) {
        this.x = targetX;
      }
    }

    if (armDir !== 0) {
      this.armAngle = Phaser.Math.Clamp(this.armAngle + armDir * ARM_SPEED * seconds, ARM_MIN, ARM_MAX);
    }

    // «Проседание»: экскаватор стоит на опоре под собой
    const supportY = terrain.getSupportY(this.x, this.y + 10);
    this.y = supportY - TRACKS_OFFSET;

    this.updateBody();
    this.updateArm();
  }

  dig(terrain: Terrain, delta: number): void {
    const { x, y } = this.getBucketWorldPosition();
    terrain.digAt(x, y, BUCKET_RADIUS, DIG_RATE * (delta / 1000));
  }

  getBucketWorldPosition(): { x: number; y: number } {
    const pivotX = this.x + ARM_PIVOT_X;
    const pivotY = this.y;
    const boomEndX = pivotX + BOOM_LEN * Math.cos(this.armAngle);
    const boomEndY = pivotY + BOOM_LEN * Math.sin(this.armAngle);
    const stickAngle = this.armAngle + STICK_ANGLE_OFFSET;
    return {
      x: boomEndX + STICK_LEN * Math.cos(stickAngle),
      y: boomEndY + STICK_LEN * Math.sin(stickAngle),
    };
  }

  private updateBody(): void {
    this.tracks.setPosition(this.x, this.y + 14);
    this.cab.setPosition(this.x, this.y - 2);
  }

  private updateArm(): void {
    const pivotX = this.x + ARM_PIVOT_X;
    const pivotY = this.y;
    const boomEndX = pivotX + BOOM_LEN * Math.cos(this.armAngle);
    const boomEndY = pivotY + BOOM_LEN * Math.sin(this.armAngle);
    const stickAngle = this.armAngle + STICK_ANGLE_OFFSET;
    const bucketX = boomEndX + STICK_LEN * Math.cos(stickAngle);
    const bucketY = boomEndY + STICK_LEN * Math.sin(stickAngle);

    this.boom.setPosition(pivotX, pivotY).setRotation(this.armAngle);
    this.stick.setPosition(boomEndX, boomEndY).setRotation(stickAngle);
    this.bucket.setPosition(bucketX, bucketY).setRotation(stickAngle);
  }
}