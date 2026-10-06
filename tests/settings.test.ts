import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultSettings, loadSettings, saveSettings, validateSettings } from "@/lib/settings";

const storage = new Map<string, string>();

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
    configurable: true,
  });
});

describe("settings validation", () => {
  afterEach(() => {
    storage.clear();
  });

  it("clamps values and repairs max < min", () => {
    const value = validateSettings({ minSeconds: 120, maxSeconds: 30, switchSeconds: 20 });
    expect(value.minSeconds).toBe(120);
    expect(value.maxSeconds).toBe(120);
    expect(value.switchSeconds).toBe(15);
  });

  it("falls back to defaults for corrupt JSON", () => {
    window.localStorage.setItem("blind-timer:settings:v1", "{bad json");
    expect(loadSettings()).toEqual(defaultSettings);
  });

  it("ignores unknown keys", () => {
    const value = validateSettings({ minSeconds: 5, maxSeconds: 10, unknown: true } as never);
    expect(value).toMatchObject({ minSeconds: 5, maxSeconds: 10, version: 1 });
    expect("unknown" in value).toBe(false);
  });

  it("persists settings", () => {
    const next = { ...defaultSettings, minSeconds: 40, maxSeconds: 90, version: 1 as const };
    saveSettings(next);
    expect(loadSettings()).toEqual(next);
  });
});
