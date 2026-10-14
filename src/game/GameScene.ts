import Phaser from 'phaser';
import { Terrain, TERRAIN_TOP } from './Terrain';
import { Excavator, TRACKS_OFFSET } from './Excavator';

const TREASURE_COUNT = 3;
const HUD_HEIGHT = 44;

/**
 * 2D-симулятор экскаватора.
 * Игрок управляет экскаватором стрелками, копает землю и ищет сокровища.
 */
export class GameScene extends Phaser.Scene {
  private terrain!: Terrain;
  private excavator!: Excavator;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private scoreText!: Phaser.GameObjects.Text;
  private winText!: Phaser.GameObjects.Text;
  private treasuresFound = 0;
  private won = false;
  private digParticleTimer = 0;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.terrain = new Terrain(this, TREASURE_COUNT);
    this.terrain.onTreasureFound = () => this.onTreasureFound();

    const startX = width / 2;
    const startY = this.terrain.getSupportY(startX, TERRAIN_TOP) - TRACKS_OFFSET;
    this.excavator = new Excavator(this, startX, startY);

    this.createHud(width, height);

    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
  }

  update(_time: number, delta: number): void {
    if (this.won) return;

    this.excavator.update(delta, this.cursors, this.terrain);

    if (this.cursors.down.isDown) {
      this.excavator.dig(this.terrain, delta);
      this.spawnDigParticles(delta);
    }

    this.terrain.update();
  }

  private createHud(width: number, height: number): void {
    this.add.rectangle(width / 2, 0, width, HUD_HEIGHT, 0x0f172a, 0.85).setOrigin(0.5, 0);

    this.scoreText = this.add.text(24, 12, `Сокровища: 0/${this.terrain.getTotalTreasures()}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
    });

    this.add
      .text(width / 2, 12, '← → — движение · ↓ — копать · ↑ — поднять ковш · R — заново', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5, 0);

    this.winText = this.add
      .text(width / 2, height / 2, 'ПОБЕДА! Все сокровища найдены.\nНажми R, чтобы начать заново.', {
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

  private onTreasureFound(): void {
    this.treasuresFound++;
    this.scoreText.setText(`Сокровища: ${this.treasuresFound}/${this.terrain.getTotalTreasures()}`);

    if (this.treasuresFound >= this.terrain.getTotalTreasures()) {
      this.won = true;
      this.winText.setVisible(true);
    }
  }

  private spawnDigParticles(delta: number): void {
    this.digParticleTimer -= delta;
    if (this.digParticleTimer > 0) return;
    this.digParticleTimer = 60;

    const { x, y } = this.excavator.getBucketWorldPosition();
    const particle = this.add.rectangle(
      x + Phaser.Math.Between(-8, 8),
      y + Phaser.Math.Between(-8, 8),
      5,
      5,
      0x8b5a2b,
    );
    this.tweens.add({
      targets: particle,
      alpha: 0,
      scale: 0.3,
      duration: 350,
      onComplete: () => particle.destroy(),
    });
  }
}
