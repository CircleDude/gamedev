/**
 * Обёртки над localStorage: прогресс, скин мяча, настройки.
 * Единственная точка доступа к localStorage в проекте.
 * Каждая функция защищена try/catch — хранилище может быть
 * недоступно (приватный режим, переполнение квоты).
 */

const PROGRESS_KEY = 'basketProgress'; // JSON ProgressData
const SKIN_KEY = 'ballSkin'; // ключ уже использовался в игре — сохраняем совместимость
const SETTINGS_KEY = 'basketSettings';

export interface ProgressData {
  version: 1; // на случай будущих миграций
  unlocked: number; // сколько уровней открыто (индекс max + 1), старт: 1
  last: number; // последний открытый/запускавшийся уровень, старт: 0
  completed: boolean[]; // completed[i] = уровень i пройден
}

export interface SettingsData {
  version: 1;
  sound: { master: number };
}

const DEFAULT_PROGRESS: ProgressData = { version: 1, unlocked: 1, last: 0, completed: [] };
const DEFAULT_SETTINGS: SettingsData = { version: 1, sound: { master: 1 } };

/** Читает прогресс; отсутствует или битый JSON → дефолт { unlocked: 1, last: 0, completed: [] }. */
export function loadProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS, completed: [] };
    const data = JSON.parse(raw) as Partial<ProgressData>;
    if (
      data.version !== 1 ||
      typeof data.unlocked !== 'number' ||
      typeof data.last !== 'number' ||
      !Array.isArray(data.completed)
    ) {
      return { ...DEFAULT_PROGRESS, completed: [] };
    }
    return {
      version: 1,
      unlocked: data.unlocked,
      last: data.last,
      completed: data.completed.map(Boolean),
    };
  } catch {
    // localStorage недоступен или данные повреждены — играем с чистого прогресса
    return { ...DEFAULT_PROGRESS, completed: [] };
  }
}

/** Пишет прогресс целиком; сбой хранилища молча игнорируется. */
export function saveProgress(progress: ProgressData): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // localStorage недоступен — прогресс просто не сохранится между запусками
  }
}

/** Отмечает уровень пройденным: completed[i]=true, unlocked=max(unlocked, i+2), last=i+1. */
export function markLevelCompleted(index: number): void {
  const progress = loadProgress();
  progress.completed[index] = true;
  progress.unlocked = Math.max(progress.unlocked, index + 2);
  progress.last = index + 1;
  saveProgress(progress);
}

/** Запоминает последний запускавшийся уровень (вызывается при старте уровня). */
export function setLastLevel(index: number): void {
  const progress = loadProgress();
  progress.last = index;
  saveProgress(progress);
}

/** Читает сохранённый скин мяча; нет ключа или сбой → null. */
export function loadSkinId(): string | null {
  try {
    return localStorage.getItem(SKIN_KEY);
  } catch {
    // localStorage недоступен — используем скин по умолчанию
    return null;
  }
}

/** Сохраняет выбранный скин мяча; сбой хранилища молча игнорируется. */
export function saveSkinId(id: string): void {
  try {
    localStorage.setItem(SKIN_KEY, id);
  } catch {
    // localStorage недоступен — скин просто не сохранится между запусками
  }
}

/** Заготовка под будущее: читает настройки; нет данных или сбой → дефолт. */
export function loadSettings(): SettingsData {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, sound: { ...DEFAULT_SETTINGS.sound } };
    const data = JSON.parse(raw) as Partial<SettingsData>;
    if (data.version !== 1 || typeof data.sound?.master !== 'number') {
      return { ...DEFAULT_SETTINGS, sound: { ...DEFAULT_SETTINGS.sound } };
    }
    return { version: 1, sound: { master: data.sound.master } };
  } catch {
    return { ...DEFAULT_SETTINGS, sound: { ...DEFAULT_SETTINGS.sound } };
  }
}

/** Заготовка под будущее: сохраняет настройки; сбой хранилища молча игнорируется. */
export function saveSettings(settings: SettingsData): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage недоступен — настройки просто не сохранятся
  }
}
