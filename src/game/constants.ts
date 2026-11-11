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

// --- Звёзды ---
export const STAR_POINTS = 5; // число лучей звезды
export const STAR_OUTER_RADIUS = 16; // px — радиус вершины луча (в игре)
export const STAR_INNER_RADIUS = 7; // px — радиус впадины между лучами
export const STAR_TOUCH_RADIUS = 36; // px — расстояние центр-центр для касания мячом
export const STAR_FILL_COLOR = 0xfacc15; // жёлтая звезда (yellow-400)
export const STAR_EDGE_COLOR = 0xa16207; // контур жёлтой звезды (yellow-700)
export const STAR_SILHOUETTE_COLOR = 0xffffff; // белый силуэт собранной звезды
export const STAR_SILHOUETTE_ALPHA = 0.35; // прозрачность силуэта
export const STAR_SILHOUETTE_EDGE_ALPHA = 0.6; // прозрачность контура силуэта
export const STAR_SPARK_COLOR = 0xfde68a; // цвет искр-полосок (amber-200)
export const STAR_SPARK_SIZE = { w: 4, h: 14 }; // размер искры-полоски, px
export const STAR_SPARK_COUNT_BRIGHT = 14; // искр при первом касании звезды
export const STAR_SPARK_COUNT_DIM = 6; // искр при повторном касании уже собранной
export const STAR_SPARK_LIFETIME = 420; // мс жизни искры
export const STAR_SPARK_MIN_DIST = 28; // px — минимальный разлёт искры
export const STAR_SPARK_MAX_DIST = 64; // px — максимальный разлёт искры
export const STAR_LEVITATE_MS = 1600; // период левитации (масштаб туда-обратно)
export const STAR_LEVITATE_SCALE = 0.12; // амплитуда левитации (доля масштаба)
export const STAR_POP_IN_MS = 280; // длительность появления scale 0→1, мс
export const STAR_PULSE_MS = 260; // длительность пульса при повторном касании, мс
export const STAR_PULSE_SCALE = 1.3; // масштаб в пике пульса
// Мелкие звёзды: плитки экрана выбора уровней и экран победы
export const STAR_TILE_RADIUS = 9; // px — радиус звезды
export const STAR_TILE_INNER_RADIUS = 4; // px — впадина между лучами
export const STAR_TILE_SPACING = 26; // px — шаг между звёздами в ряду
export const STAR_TILE_UNCOLLECTED_COLOR = 0x94a3b8; // обводка несобранной (slate-400)
export const WIN_STARS_OFFSET_Y = 46; // px — отступ ряда звёзд победного экрана от заголовка
export const WIN_STARS_TEXT_OFFSET_Y = 22; // px — отступ текста «N/M» под рядом звёзд

// Типы уровней (ControlZone, HoopConfig, WallConfig, LevelConfig) и массив LEVELS
// живут в levels.ts — здесь только числовые параметры физики и геометрии.