import { describe, expect, it } from "vitest";
import { randomIntInclusive } from "@/lib/random";

describe("randomIntInclusive", () => {
  it("always stays within bounds", () => {
    for (let i = 0; i < 10000; i += 1) {
      const value = randomIntInclusive(5, 15);
      expect(value).toBeGreaterThanOrEqual(5);
      expect(value).toBeLessThanOrEqual(15);
    }
  });

  it("returns the min when min and max are equal", () => {
    expect(randomIntInclusive(7, 7)).toBe(7);
  });

  it("roughly matches a uniform distribution", () => {
    const buckets = new Map<number, number>();
    for (let i = 0; i < 20000; i += 1) {
      const value = randomIntInclusive(10, 15);
      buckets.set(value, (buckets.get(value) ?? 0) + 1);
    }

    for (let value = 10; value <= 15; value += 1) {
      const count = buckets.get(value) ?? 0;
      expect(count).toBeGreaterThanOrEqual(3000);
      expect(count).toBeLessThanOrEqual(5000);
    }
  });
});
