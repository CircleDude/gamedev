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
export const BALL_RESTITUTION = 0.86; // упругость мяча (отскок) — как у настоящего баскетбольного
export const BALL_FRICTION = 0.8; // трение мяча о поверхности — как у мяча на паркете
export const BALL_FRICTION_AIR = 0.001; // сопротивление воздуха
export const WALL_RESTITUTION = 0.8; // упругость пола, стен и кольца
export const WALL_FRICTION = 0.5;

// --- Видимые стены арены ---
// Правило как у скинов мяча: контур — тот же цвет семьи, но на несколько ступеней темнее заливки.
export const WALL_COLOR = 0x334155; // заливка видимых стен (slate-700)
export const WALL_EDGE_COLOR = 0x020617; // контур стен (slate-950, темнее заливки)
export const WALL_VISUAL_THICKNESS = 10; // видимая толщина боковых стен и потолка, px
export const ZONE_COLOR = 0x0369a1; // контур зоны управления (sky-700, темнее заливки sky-400)
export const ZONE_ALPHA = 0.6;
export const BALL_RESTING_THRESH = 0.5; // порог скорости (px/тик), ниже которого Matter не отскакивает (default: 4)

// --- Скорость мяча ---
export const MAX_SPEED = 1200; // px/s — мягкий предел скорости мяча
// Matter хранит скорость в px за 1/60с; чтобы задать px/s, делим на 60.
export const MATTER_VELOCITY_SCALE = 1 / 60;

// --- Визуальное сжатие мяча при ударах ---
export const BALL_SQUASH_MAX = 0.9; // максимальная деформация (доля от размера)
export const BALL_SQUASH_MS = 200; // длительность сжатия, мс
export const BALL_SQUASH_SPEED = 2000; // px/s — скорость удара, при которой сжатие полное

// --- Рогатка ---
export const GRAB_RADIUS = BALL_RADIUS + 14; // радиус захвата мяча курсором
export const MAX_DRAG = 170; // px — длина оттяжки для полной силы броска
export const MAX_LAUNCH_SPEED = 1100; // px/s — скорость броска при полной оттяжке

// --- Рогатка: резинка и кулак ---
export const BAND_FORK_OFFSET = 28; // отступ краёв рогатки от мяча, px (больше радиуса мяча)
export const BAND_WIDTH = 5; // толщина резинки, px
// Кулак — спрайт public/fist.png: ширина на экране, высота пропорциональна текстуре.
export const FIST_SIZE = 34; // px; половина = 17
// Отступ крепления резинки от центра кулака: 13 + радиус закруглённого конца
// резинки 2.5 = 15.5 < 17 — концы резинки прячутся за спрайтом кулака.
export const FIST_GRIP = 13;
export const LAUNCH_ANIM_MS = 130; // анимация удара резинки по мячу перед запуском, мс (<200)

// --- Фаза 2 ---
export const PHASE2_GRAVITY_SCALE = 3; // во сколько раз уменьшается гравитация в фазе 2
export const HOOP_ROTATION_SPEED = 0.5; // рад/с — скорость вращения кольца вокруг центра в фазе 2

// Типы уровней (ControlZone, HoopConfig, WallConfig, LevelConfig) и массив LEVELS
// живут в levels.ts — здесь только числовые параметры физики и геометрии.