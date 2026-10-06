export type TimerState =
  | { kind: "idle" }
  | {
      kind: "running";
      half: 1 | 2;
      durationMs: number;
      startedAt: number;
      endsAt: number;
      symmetrical: boolean;
      switchMs: number;
      firstHalfActualMs?: number;
    }
  | {
      kind: "switching";
      durationMs: number;
      firstHalfActualMs: number;
      switchMs: number;
      endsAt: number;
    }
  | {
      kind: "complete";
      durationMs: number;
      halves: 1 | 2;
      actualMs: number[];
      totalMs: number;
    };

export type TimerEvent =
  | { type: "START"; now: number; durationMs: number; symmetrical: boolean; switchMs: number }
  | { type: "TICK"; now: number }
  | { type: "CANCEL" }
  | { type: "RESET" };

export function timerReducer(state: TimerState, event: TimerEvent): TimerState {
  switch (event.type) {
    case "START":
      return {
        kind: "running",
        half: 1,
        durationMs: event.durationMs,
        startedAt: event.now,
        endsAt: event.now + event.durationMs,
        symmetrical: event.symmetrical,
        switchMs: event.switchMs,
      };
    case "CANCEL":
      return { kind: "idle" };
    case "RESET":
      return { kind: "idle" };
    case "TICK": {
      if (state.kind === "idle" || state.kind === "complete") {
        return state;
      }

      if (state.kind === "running") {
        if (event.now < state.endsAt) {
          return state;
        }

        if (state.half === 1 && state.symmetrical) {
          const firstHalfActualMs = event.now - state.startedAt;
          return {
            kind: "switching",
            durationMs: state.durationMs,
            firstHalfActualMs,
            switchMs: state.switchMs,
            endsAt: event.now + state.switchMs,
          };
        }

        if (state.half === 1 && !state.symmetrical) {
          const actualMs = event.now - state.startedAt;
          return {
            kind: "complete",
            durationMs: state.durationMs,
            halves: 1,
            actualMs: [actualMs],
            totalMs: actualMs,
          };
        }

        const firstHalfActualMs = state.firstHalfActualMs ?? 0;
        const secondActualMs = event.now - state.startedAt;
        const totalMs = firstHalfActualMs + secondActualMs;

        return {
          kind: "complete",
          durationMs: state.durationMs,
          halves: 2,
          actualMs: [firstHalfActualMs, secondActualMs],
          totalMs,
        };
      }

      if (event.now < state.endsAt) {
        return state;
      }

      return {
        kind: "running",
        half: 2,
        durationMs: state.durationMs,
        startedAt: event.now,
        endsAt: event.now + state.durationMs,
        symmetrical: true,
        switchMs: state.switchMs,
        firstHalfActualMs: state.firstHalfActualMs,
      };
    }
    default:
      return state;
  }
}
