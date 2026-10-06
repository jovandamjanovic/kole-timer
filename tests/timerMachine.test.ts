import { describe, expect, it } from "vitest";
import { timerReducer, type TimerState } from "@/lib/timerMachine";

describe("timerReducer", () => {
  it("completes a non-symmetric run at the deadline", () => {
    const initial: TimerState = { kind: "idle" };
    const started = timerReducer(initial, { type: "START", now: 1000, durationMs: 5000, symmetrical: false, switchMs: 5000 });
    const beforeDeadline = timerReducer(started, { type: "TICK", now: 4000 });
    const atDeadline = timerReducer(started, { type: "TICK", now: 6000 });

    expect(beforeDeadline).toBe(started);
    expect(atDeadline).toMatchObject({ kind: "complete", durationMs: 5000, actualMs: [5000] });
  });

  it("runs symmetrical mode across a switch", () => {
    const started = timerReducer({ kind: "idle" }, {
      type: "START",
      now: 1000,
      durationMs: 5000,
      symmetrical: true,
      switchMs: 3000,
    });

    const switched = timerReducer(started, { type: "TICK", now: 7000 });
    expect(switched).toMatchObject({ kind: "switching", firstHalfActualMs: 6000, durationMs: 5000 });

    const second = timerReducer(switched, { type: "TICK", now: 10000 });
    expect(second).toMatchObject({ kind: "running", half: 2, durationMs: 5000, firstHalfActualMs: 6000 });

    const completed = timerReducer(second, { type: "TICK", now: 15000 });
    expect(completed).toMatchObject({ kind: "complete", halves: 2, actualMs: [6000, 5000] });
  });

  it("handles late ticks exactly once", () => {
    const started = timerReducer({ kind: "idle" }, { type: "START", now: 1000, durationMs: 1000, symmetrical: false, switchMs: 1000 });
    const completed = timerReducer(started, { type: "TICK", now: 50000 });
    expect(completed).toMatchObject({ kind: "complete", actualMs: [49000] });
  });

  it("cancels from running and switching", () => {
    const running = timerReducer({ kind: "idle" }, { type: "START", now: 1000, durationMs: 4000, symmetrical: false, switchMs: 1000 });
    expect(timerReducer(running, { type: "CANCEL" })).toEqual({ kind: "idle" });

    const switching = timerReducer({ kind: "idle" }, {
      type: "START",
      now: 1000,
      durationMs: 4000,
      symmetrical: true,
      switchMs: 2000,
    });
    const switched = timerReducer(switching, { type: "TICK", now: 5000 });
    expect(timerReducer(switched, { type: "CANCEL" })).toEqual({ kind: "idle" });
  });

  it("resets complete state back to idle", () => {
    const complete = timerReducer({ kind: "idle" }, { type: "START", now: 0, durationMs: 2000, symmetrical: false, switchMs: 2000 });
    const ended = timerReducer(complete, { type: "TICK", now: 2500 });
    expect(timerReducer(ended, { type: "RESET" })).toEqual({ kind: "idle" });
  });

  it("returns the same state reference for a no-op tick", () => {
    const initial: TimerState = { kind: "idle" };
    expect(timerReducer(initial, { type: "TICK", now: 1 })).toBe(initial);
  });
});
