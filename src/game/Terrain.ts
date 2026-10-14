import Phaser from 'phaser';

export const CELL_SIZE = 20;
export const TERRAIN_TOP = 240;
export const TERRAIN_ROWS = 20;
export const TERRAIN_COLS = 48;

const SOIL_FULL = { r: 0x8b, g: 0x5a, b: 0x2b };
const SOIL_DUG = { r: 0xc1, g: 0x9a, b: 0x6b };
const ROCK_COLOR = 0x6b7280;
const GRASS_COLOR = 0x4d7c0f;
const TREASURE_COLOR = 0xfacc15;

interface Cell {
  soil: number;
  rock: boolean;
  treasure: boolean;
  found: boolean;
}

/**
 * Земля — сетка ячеек. Каждая ячейка хранит количество грунта (0..1),
 * флаг «камень» (некопаемая) и флаг «сокровище».
 * Отрисовка — один Graphics-объект, перерисовывается только при изменении.
 */
export class Terrain {
  private readonly cells: Cell[][];
  private readonly graphics: Phaser.GameObjects.Graphics;
  private dirty = true;
  private treasuresLeft: number;
  private readonly totalTreasures: number;
  onTreasureFound: (() => void) | null = null;

  constructor(scene: Phaser.Scene, treasureCount: number) {
    this.cells = [];
    for (let col = 0; col < TERRAIN_COLS; col++) {
      const column: Cell[] = [];
      for (let row = 0; row < TERRAIN_ROWS; row++) {
        column.push({ soil: 1, rock: false, treasure: false, found: false });
      }
      this.cells.push(column);
    }
    this.placeRocks();
    this.totalTreasures = this.placeTreasures(treasureCount);
    this.treasuresLeft = this.totalTreasures;
    this.graphics = scene.add.graphics();
    this.redraw();
  }

  getTotalTreasures(): number {
    return this.totalTreasures;
  }

  getTreasuresLeft(): number {
    return this.treasuresLeft;
  }

  /**
   * Уменьшает грунт во всех ячейках, попадающих в круг вокруг (worldX, worldY).
   * Возвращает true, если хоть одна ячейка изменилась.
   */
  digAt(worldX: number, worldY: number, radius: number, amount: number): boolean {
    const minCol = Math.max(0, Math.floor((worldX - radius) / CELL_SIZE));
    const maxCol = Math.min(TERRAIN_COLS - 1, Math.floor((worldX + radius) / CELL_SIZE));
    const minRow = Math.max(0, Math.floor((worldY - radius - TERRAIN_TOP) / CELL_SIZE));
    const maxRow = Math.min(TERRAIN_ROWS - 1, Math.floor((worldY + radius - TERRAIN_TOP) / CELL_SIZE));

    let changed = false;

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const cell = this.cells[col][row];
        if (cell.rock || cell.soil <= 0) continue;

        const cx = col * CELL_SIZE + CELL_SIZE / 2;
        const cy = TERRAIN_TOP + row * CELL_SIZE + CELL_SIZE / 2;
        if (Phaser.Math.Distance.Between(worldX, worldY, cx, cy) > radius) continue;

        cell.soil = Math.max(0, cell.soil - amount);
        changed = true;
        this.dirty = true;

        if (cell.soil <= 0 && cell.treasure && !cell.found) {
          cell.found = true;
          this.treasuresLeft--;
          this.onTreasureFound?.();
        }
      }
    }

    return changed;
  }

  /**
   * Высота опоры в колонке worldX: верх первой твёрдой ячейки,
   * расположенной не выше fromY. Нужно, чтобы экскаватор «стоял» на земле
   * и опускался, когда копает под собой.
   */
  getSupportY(worldX: number, fromY: number): number {
    const col = Phaser.Math.Clamp(Math.floor(worldX / CELL_SIZE), 0, TERRAIN_COLS - 1);
    const startRow = Math.max(0, Math.floor((fromY - TERRAIN_TOP) / CELL_SIZE));
    for (let row = startRow; row < TERRAIN_ROWS; row++) {
      const cell = this.cells[col][row];
      if (cell.soil > 0 || cell.rock) return TERRAIN_TOP + row * CELL_SIZE;
    }
    return TERRAIN_TOP + TERRAIN_ROWS * CELL_SIZE;
  }

  update(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.redraw();
  }

  private placeRocks(): void {
    for (let col = 0; col < TERRAIN_COLS; col++) {
      for (let row = 1; row < TERRAIN_ROWS; row++) {
        if (Math.random() < 0.08) this.cells[col][row].rock = true;
      }
    }
  }

  private placeTreasures(count: number): number {
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < 2000) {
      attempts++;
      const col = Phaser.Math.Between(2, TERRAIN_COLS - 3);
      const row = Phaser.Math.Between(8, TERRAIN_ROWS - 3);
      const cell = this.cells[col][row];
      if (!cell.rock && !cell.treasure) {
        cell.treasure = true;
        placed++;
      }
    }
    return placed;
  }

  private redraw(): void {
    const g = this.graphics;
    g.clear();

    for (let col = 0; col < TERRAIN_COLS; col++) {
      for (let row = 0; row < TERRAIN_ROWS; row++) {
        const cell = this.cells[col][row];
        const x = col * CELL_SIZE;
        const y = TERRAIN_TOP + row * CELL_SIZE;

        if (cell.rock) {
          g.fillStyle(ROCK_COLOR, 1);
          g.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        } else if (cell.soil > 0) {
          const t = 1 - cell.soil;
          const r = Math.round(SOIL_FULL.r + (SOIL_DUG.r - SOIL_FULL.r) * t);
          const gr = Math.round(SOIL_FULL.g + (SOIL_DUG.g - SOIL_FULL.g) * t);
          const b = Math.round(SOIL_FULL.b + (SOIL_DUG.b - SOIL_FULL.b) * t);
          g.fillStyle((r << 16) | (gr << 8) | b, 1);
          g.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        } else if (cell.treasure) {
          g.fillStyle(TREASURE_COLOR, 1);
          g.fillCircle(x + CELL_SIZE / 2, y + CELL_SIZE / 2, 7);
        }
      }
    }

    // Тонкая «трава» на поверхности земли
    for (let col = 0; col < TERRAIN_COLS; col++) {
      for (let row = 0; row < TERRAIN_ROWS; row++) {
        const cell = this.cells[col][row];
        if (cell.soil > 0 || cell.rock) {
          g.fillStyle(GRASS_COLOR, 1);
          g.fillRect(col * CELL_SIZE, TERRAIN_TOP + row * CELL_SIZE, CELL_SIZE, 4);
          break;
        }
      }
    }
  }
}