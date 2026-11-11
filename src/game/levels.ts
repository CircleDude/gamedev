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

export interface StarPosition {
  x: number;
  y: number;
}

export interface LevelConfig {
  zone: ControlZone;
  hoop: HoopConfig;
  walls: WallConfig[];
  ballSpawn: { x: number; y: number };
  features: LevelFeature[]; // пустой массив = «чистый» уровень
  stars?: StarPosition[]; // позиции звёзд; нет поля = звёзд на уровне нет
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
    // Звёзды вдоль дуги-подсказки.
    stars: [
      { x: 434, y: 210 },
      { x: 548, y: 228 },
      { x: 665, y: 325 },
    ],
  },
  {
    // Уровень 2: вертикальная стенка, через которую нужно перекинуть мяч.
    zone: { x: 40, y: 40, width: 520, height: 506 },
    hoop: { ringX: 760, ringY: 450, halfSize: 45, barThickness: 6 },
    walls: [{ x: 650, y: 470, width: 16, length: 180, angle: 0 }],
    ballSpawn: { x: 300, y: 293 },
    features: NO_FEATURES,
    // Перелёт через стенку: до неё, над верхом стенки и перед кольцом.
    stars: [
      { x: 480, y: 230 },
      { x: 650, y: 330 },
      { x: 740, y: 400 },
    ],
  },
  {
    // Уровень 3: наклонная стенка.
    zone: { x: 40, y: 40, width: 520, height: 506 },
    hoop: { ringX: 760, ringY: 450, halfSize: 45, barThickness: 6 },
    walls: [{ x: 640, y: 430, width: 16, length: 240, angle: 30 }],
    ballSpawn: { x: 300, y: 293 },
    features: NO_FEATURES,
    stars: [
      { x: 450, y: 240 },
      { x: 620, y: 300 },
      { x: 720, y: 380 },
    ],
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
    stars: [
      { x: 460, y: 220 },
      { x: 560, y: 310 },
      { x: 660, y: 240 },
    ],
  },
  {
    // Уровень 5: зона по центру, кольцо выше и меньше, наклонная стенка.
    zone: { x: 180, y: 40, width: 420, height: 506 },
    hoop: { ringX: 760, ringY: 400, halfSize: 35, barThickness: 6 },
    walls: [{ x: 640, y: 430, width: 16, length: 220, angle: 20 }],
    ballSpawn: { x: 390, y: 293 },
    features: NO_FEATURES,
    stars: [
      { x: 390, y: 180 },
      { x: 550, y: 250 },
      { x: 700, y: 320 },
    ],
  },
  {
    // Уровень 6: кольцо слева, зона справа, наклонная стенка между ними. Начало фазы 2.
    zone: { x: 400, y: 40, width: 520, height: 506 },
    hoop: { ringX: 200, ringY: 450, halfSize: 45, barThickness: 6 },
    walls: [{ x: 480, y: 430, width: 16, length: 220, angle: -20 }],
    ballSpawn: { x: 660, y: 293 },
    features: PHASE2_FEATURES,
    stars: [
      { x: 700, y: 180 },
      { x: 520, y: 280 },
      { x: 300, y: 350 },
    ],
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
    // Средняя звезда — в щели коридора между стенками.
    stars: [
      { x: 420, y: 200 },
      { x: 668, y: 430 },
      { x: 760, y: 350 },
    ],
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
    // Средняя звезда — в зазоре между стенками.
    stars: [
      { x: 450, y: 220 },
      { x: 640, y: 470 },
      { x: 760, y: 380 },
    ],
  },
  {
    // Уровень 9: длинная наклонная стенка и маленькое кольцо. Фаза 2.
    zone: { x: 40, y: 40, width: 520, height: 506 },
    hoop: { ringX: 760, ringY: 420, halfSize: 30, barThickness: 6 },
    walls: [{ x: 620, y: 410, width: 20, length: 280, angle: 15 }],
    ballSpawn: { x: 300, y: 293 },
    features: PHASE2_FEATURES,
    stars: [
      { x: 420, y: 180 },
      { x: 580, y: 250 },
      { x: 760, y: 330 },
    ],
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
    // Звёзды низом под висящей стенкой и над корзиной.
    stars: [
      { x: 420, y: 320 },
      { x: 660, y: 430 },
      { x: 800, y: 180 },
    ],
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
    // Низом под висящей стенкой и над ступенькой.
    stars: [
      { x: 740, y: 250 },
      { x: 540, y: 480 },
      { x: 350, y: 420 },
    ],
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
    // Низом под висящей стенкой, затем к правой корзине.
    stars: [
      { x: 300, y: 150 },
      { x: 620, y: 480 },
      { x: 820, y: 300 },
    ],
  },
];
