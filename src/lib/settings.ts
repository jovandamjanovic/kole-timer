export type HiddenVisual = "black" | "image";

export type Settings = {
  minSeconds: number;
  maxSeconds: number;
  symmetrical: boolean;
  switchSeconds: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  hiddenVisual: HiddenVisual;
  imageId: string;
  version: 1;
};

export const defaultSettings: Settings = {
  minSeconds: 20,
  maxSeconds: 30,
  symmetrical: false,
  switchSeconds: 5,
  soundEnabled: true,
  vibrationEnabled: true,
  hiddenVisual: "black",
  imageId: "1",
  version: 1,
};

const STORAGE_KEY = "blind-timer:settings:v1";

export function validateSettings(input: Partial<Settings> | null | undefined): Settings {
  const source = input ?? {};
  const minSeconds = clampInteger(source.minSeconds ?? defaultSettings.minSeconds, 1, 3600);
  const maxSeconds = clampInteger(source.maxSeconds ?? defaultSettings.maxSeconds, minSeconds, 3600);

  return {
    minSeconds,
    maxSeconds,
    symmetrical: Boolean(source.symmetrical ?? defaultSettings.symmetrical),
    switchSeconds: clampInteger(source.switchSeconds ?? defaultSettings.switchSeconds, 2, 15),
    soundEnabled: Boolean(source.soundEnabled ?? defaultSettings.soundEnabled),
    vibrationEnabled: Boolean(source.vibrationEnabled ?? defaultSettings.vibrationEnabled),
    hiddenVisual: source.hiddenVisual === "image" ? "image" : "black",
    imageId: typeof source.imageId === "string" ? source.imageId : defaultSettings.imageId,
    version: 1,
  };
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultSettings;
    }
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return validateSettings(parsed);
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validateSettings(settings)));
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  const rounded = Math.round(value);
  return Math.min(Math.max(rounded, minimum), maximum);
}
