/**
 * Настраиваемые параметры игры «Баскетбольный мяч».
 * Все «магические числа» физики и геометрии собраны здесь,
 * чтобы баланс можно было менять в одном месте.
 */

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;
export const FLOOR_Y = 560; // верхняя кромка пола

// --- Физика ---
export const GRAVITY_Y = 1; // гравитация Matter (scale 0.001) ≈ 1000 px/s²
export const BALL_RADIUS = 18;
export const BALL_RESTITUTION = 0.75; // упругость мяча (отскок)
export const BALL_FRICTION = 0.1; // трение мяча о поверхности — как у мяча на паркете (Matter default)
export const BALL_FRICTION_AIR = 0.002; // сопротивление воздуха
export const WALL_RESTITUTION = 0.7; // упругость пола, стен и кольца
export const WALL_FRICTION = 0.1;

// --- Скорость мяча ---
export const MAX_SPEED = 1200; // px/s — мягкий предел скорости мяча
// Matter хранит скорость в px за 1/60с; чтобы задать px/s, делим на 60.
export const MATTER_VELOCITY_SCALE = 1 / 60;

// --- Рогатка ---
export const GRAB_RADIUS = BALL_RADIUS + 14; // радиус захвата мяча курсором
export const MAX_DRAG = 170; // px — длина оттяжки для полной силы броска
export const MAX_LAUNCH_SPEED = 1100; // px/s — скорость броска при полной оттяжке

// --- Геометрия уровней ---
export interface ControlZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HoopConfig {
  ringX: number;
  ringY: number; // верхняя кромка корзины (открыта сверху)
  halfSize: number; // половина ширины корзины
  barThickness: number; // толщина брусков
}

export interface WallConfig {
  x: number; // центр стенки
  y: number; // центр стенки
  width: number; // толщина стенки
  length: number; // длина стенки вдоль её оси
  angle: number; // наклон в градусах, 0 = вертикальная
}

export interface LevelConfig {
  zone: ControlZone;
  hoop: HoopConfig;
  walls: WallConfig[];
  ballSpawn: { x: number; y: number };
}

export const LEVELS: LevelConfig[] = [
  {
    // Уровень 1: зона слева, кольцо справа, без препятствий.
    zone: { x: 40, y: 40, width: 520, height: 506 },
    hoop: { ringX: 760, ringY: 450, halfSize: 45, barThickness: 6 },
    walls: [],
    ballSpawn: { x: 300, y: 293 },
  },
  {
    // Уровень 2: вертикальная стенка, через которую нужно перекинуть мяч.
    zone: { x: 40, y: 40, width: 520, height: 506 },
    hoop: { ringX: 760, ringY: 450, halfSize: 45, barThickness: 6 },
    walls: [{ x: 650, y: 470, width: 16, length: 180, angle: 0 }],
    ballSpawn: { x: 300, y: 293 },
  },
  {
    // Уровень 3: наклонная стенка.
    zone: { x: 40, y: 40, width: 520, height: 506 },
    hoop: { ringX: 760, ringY: 450, halfSize: 45, barThickness: 6 },
    walls: [{ x: 640, y: 430, width: 16, length: 240, angle: 30 }],
    ballSpawn: { x: 300, y: 293 },
  },
  {
    // Уровень 4: две стенки — вертикальная и наклонная.
    zone: { x: 40, y: 40, width: 520, height: 506 },
    hoop: { ringX: 760, ringY: 450, halfSize: 45, barThickness: 6 },
    walls: [
      { x: 600, y: 470, width: 16, length: 180, angle: 0 },
      { x: 700, y: 400, width: 16, length: 160, angle: -25 },
    ],
    ballSpawn: { x: 300, y: 293 },
  },
  {
    // Уровень 5: зона по центру, кольцо выше и меньше, наклонная стенка.
    zone: { x: 180, y: 40, width: 420, height: 506 },
    hoop: { ringX: 760, ringY: 400, halfSize: 35, barThickness: 6 },
    walls: [{ x: 640, y: 430, width: 16, length: 220, angle: 20 }],
    ballSpawn: { x: 390, y: 293 },
  },
  {
    // Уровень 6: кольцо слева, зона справа, наклонная стенка между ними.
    zone: { x: 400, y: 40, width: 520, height: 506 },
    hoop: { ringX: 200, ringY: 450, halfSize: 45, barThickness: 6 },
    walls: [{ x: 480, y: 430, width: 16, length: 220, angle: -20 }],
    ballSpawn: { x: 660, y: 293 },
  },
  {
    // Уровень 7: коридор из двух наклонных стенок перед кольцом.
    zone: { x: 40, y: 40, width: 520, height: 506 },
    hoop: { ringX: 760, ringY: 450, halfSize: 45, barThickness: 6 },
    walls: [
      { x: 620, y: 440, width: 16, length: 200, angle: -15 },
      { x: 720, y: 440, width: 16, length: 200, angle: 15 },
    ],
    ballSpawn: { x: 300, y: 293 },
  },
  {
    // Уровень 8: две стенки с зазором — мяч нужно провести через щель.
    zone: { x: 40, y: 40, width: 520, height: 506 },
    hoop: { ringX: 760, ringY: 450, halfSize: 45, barThickness: 6 },
    walls: [
      { x: 640, y: 400, width: 16, length: 80, angle: 0 },
      { x: 640, y: 530, width: 16, length: 60, angle: 0 },
    ],
    ballSpawn: { x: 300, y: 293 },
  },
  {
    // Уровень 9: длинная наклонная стенка и маленькое кольцо.
    zone: { x: 40, y: 40, width: 520, height: 506 },
    hoop: { ringX: 760, ringY: 420, halfSize: 30, barThickness: 6 },
    walls: [{ x: 620, y: 410, width: 20, length: 280, angle: 15 }],
    ballSpawn: { x: 300, y: 293 },
  },
  {
    // Уровень 10 «Рикошет от пола»: висящая стенка сверху до середины блокирует
    // прямой навес, под ней можно только низом. Корзина выше нижнего края стенки,
    // поэтому забить можно только рикошетом от пола.
    zone: { x: 40, y: 80, width: 480, height: 466 },
    hoop: { ringX: 790, ringY: 270, halfSize: 45, barThickness: 6 },
    walls: [{ x: 640, y: 160, width: 16, length: 320, angle: 0 }],
    ballSpawn: { x: 300, y: 250 },
  },
  {
    // Уровень 11 «Банк от ступеньки»: зона справа, висящая стенка блокирует прямой
    // навес. Под стенку — только низом, а до корзины слева мяч добирается отскоком
    // от ступеньки (или от пола).
    zone: { x: 560, y: 300, width: 360, height: 246 },
    hoop: { ringX: 200, ringY: 360, halfSize: 45, barThickness: 6 },
    walls: [
      { x: 520, y: 225, width: 16, length: 410, angle: 0 },
      { x: 320, y: 520, width: 20, length: 80, angle: 0 },
    ],
    ballSpawn: { x: 740, y: 420 },
  },
  {
    // Уровень 12 «Банк от стены»: висящая стенка блокирует навес, низом под неё,
    // затем мяч подпрыгивает от пола и залетает в корзину рикошетом от правой стены
    // (или напрямую отскоком от пола).
    zone: { x: 40, y: 60, width: 420, height: 360 },
    hoop: { ringX: 880, ringY: 360, halfSize: 45, barThickness: 6 },
    walls: [{ x: 620, y: 225, width: 16, length: 410, angle: 0 }],
    ballSpawn: { x: 260, y: 240 },
  },
];