import { describe, expect, it } from "vitest";
import { formatDuration } from "@/lib/format";

describe("formatDuration", () => {
  it("formats 65 seconds", () => {
    expect(formatDuration(65000)).toBe("1:05");
  });

  it("formats 5 seconds", () => {
    expect(formatDuration(5000)).toBe("0:05");
  });

  it("formats one hour", () => {
    expect(formatDuration(3600000)).toBe("60:00");
  });
});
