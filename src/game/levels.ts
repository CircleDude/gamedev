/**
 * Data-driven описание уровней: геометрия арены, кольцо, стены, спавн мяча
 * и список механик (features), включаемых реестром levelFeatures.ts.
 * Числовые параметры физики — в constants.ts.
 */

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

export type LevelFeatureType = 'rotatingHoop' | 'lowGravity' | 'hintTrajectory';

export interface LevelFeature {
  type: LevelFeatureType;
  params?: Readonly<Record<string, number>>; // опциональные параметры механики
}

export interface LevelConfig {
  zone: ControlZone;
  hoop: HoopConfig;
  walls: WallConfig[];
  ballSpawn: { x: number; y: number };
  features: LevelFeature[]; // пустой массив = «чистый» уровень
}

// Механики уровней как данные (раньше были зашиты в GameScene условиями по индексу).
const HINT_FEATURES: LevelFeature[] = [{ type: 'hintTrajectory' }];
const PHASE2_FEATURES: LevelFeature[] = [{ type: 'rotatingHoop' }, { type: 'lowGravity' }];
const NO_FEATURES: LevelFeature[] = [];

export const LEVELS: LevelConfig[] = [
  {
    // Уровень 1: зона слева, кольцо справа, без препятствий + подсказка-траектория.
    zone: { x: 40, y: 40, width: 520, height: 506 },
    hoop: { ringX: 760, ringY: 450, halfSize: 45, barThickness: 6 },
    walls: [],
    ballSpawn: { x: 300, y: 293 },
    features: HINT_FEATURES,
  },
  {
    // Уровень 2: вертикальная стенка, через которую нужно перекинуть мяч.
    zone: { x: 40, y: 40, width: 520, height: 506 },
    hoop: { ringX: 760, ringY: 450, halfSize: 45, barThickness: 6 },
    walls: [{ x: 650, y: 470, width: 16, length: 180, angle: 0 }],
    ballSpawn: { x: 300, y: 293 },
    features: NO_FEATURES,
  },
  {
    // Уровень 3: наклонная стенка.
    zone: { x: 40, y: 40, width: 520, height: 506 },
    hoop: { ringX: 760, ringY: 450, halfSize: 45, barThickness: 6 },
    walls: [{ x: 640, y: 430, width: 16, length: 240, angle: 30 }],
    ballSpawn: { x: 300, y: 293 },
    features: NO_FEATURES,
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
    features: NO_FEATURES,
  },
  {
    // Уровень 5: зона по центру, кольцо выше и меньше, наклонная стенка.
    zone: { x: 180, y: 40, width: 420, height: 506 },
    hoop: { ringX: 760, ringY: 400, halfSize: 35, barThickness: 6 },
    walls: [{ x: 640, y: 430, width: 16, length: 220, angle: 20 }],
    ballSpawn: { x: 390, y: 293 },
    features: NO_FEATURES,
  },
  {
    // Уровень 6: кольцо слева, зона справа, наклонная стенка между ними. Начало фазы 2.
    zone: { x: 400, y: 40, width: 520, height: 506 },
    hoop: { ringX: 200, ringY: 450, halfSize: 45, barThickness: 6 },
    walls: [{ x: 480, y: 430, width: 16, length: 220, angle: -20 }],
    ballSpawn: { x: 660, y: 293 },
    features: PHASE2_FEATURES,
  },
  {
    // Уровень 7: коридор из двух наклонных стенок перед кольцом. Фаза 2.
    zone: { x: 40, y: 40, width: 520, height: 506 },
    hoop: { ringX: 760, ringY: 450, halfSize: 45, barThickness: 6 },
    walls: [
      { x: 620, y: 440, width: 16, length: 200, angle: -15 },
      { x: 720, y: 440, width: 16, length: 200, angle: 15 },
    ],
    ballSpawn: { x: 300, y: 293 },
    features: PHASE2_FEATURES,
  },
  {
    // Уровень 8: две стенки с зазором — мяч нужно провести через щель. Фаза 2.
    zone: { x: 40, y: 40, width: 520, height: 506 },
    hoop: { ringX: 760, ringY: 450, halfSize: 45, barThickness: 6 },
    walls: [
      { x: 640, y: 400, width: 16, length: 80, angle: 0 },
      { x: 640, y: 530, width: 16, length: 60, angle: 0 },
    ],
    ballSpawn: { x: 300, y: 293 },
    features: PHASE2_FEATURES,
  },
  {
    // Уровень 9: длинная наклонная стенка и маленькое кольцо. Фаза 2.
    zone: { x: 40, y: 40, width: 520, height: 506 },
    hoop: { ringX: 760, ringY: 420, halfSize: 30, barThickness: 6 },
    walls: [{ x: 620, y: 410, width: 20, length: 280, angle: 15 }],
    ballSpawn: { x: 300, y: 293 },
    features: PHASE2_FEATURES,
  },
  {
    // Уровень 10 «Рикошет от пола»: висящая стенка сверху до середины блокирует
    // прямой навес, под ней можно только низом. Корзина выше нижнего края стенки,
    // поэтому забить можно только рикошетом от пола. Фаза 2.
    zone: { x: 40, y: 80, width: 480, height: 466 },
    hoop: { ringX: 790, ringY: 270, halfSize: 45, barThickness: 6 },
    walls: [{ x: 640, y: 160, width: 16, length: 320, angle: 0 }],
    ballSpawn: { x: 300, y: 250 },
    features: PHASE2_FEATURES,
  },
  {
    // Уровень 11 «Банк от ступеньки»: зона справа, висящая стенка блокирует прямой
    // навес. Под стенку — только низом, а до корзины слева мяч добирается отскоком
    // от ступеньки (или от пола). Фаза 2.
    zone: { x: 560, y: 300, width: 360, height: 246 },
    hoop: { ringX: 200, ringY: 360, halfSize: 45, barThickness: 6 },
    walls: [
      { x: 520, y: 225, width: 16, length: 410, angle: 0 },
      { x: 320, y: 520, width: 20, length: 80, angle: 0 },
    ],
    ballSpawn: { x: 740, y: 420 },
    features: PHASE2_FEATURES,
  },
  {
    // Уровень 12 «Банк от стены»: висящая стенка блокирует навес, низом под неё,
    // затем мяч подпрыгивает от пола и залетает в корзину рикошетом от правой стены
    // (или напрямую отскоком от пола). Фаза 2.
    zone: { x: 40, y: 60, width: 420, height: 360 },
    hoop: { ringX: 880, ringY: 360, halfSize: 45, barThickness: 6 },
    walls: [{ x: 620, y: 225, width: 16, length: 410, angle: 0 }],
    ballSpawn: { x: 260, y: 240 },
    features: PHASE2_FEATURES,
  },
];
