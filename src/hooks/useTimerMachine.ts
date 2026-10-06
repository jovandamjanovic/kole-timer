"use client";

import { useCallback, useEffect, useReducer } from "react";
import { timerReducer, type TimerEvent, type TimerState } from "@/lib/timerMachine";

const STORAGE_KEY = "blind-timer:run";

export function useTimerMachine() {
  const [phase, dispatch] = useReducer(timerReducer, { kind: "idle" } as TimerState);

  const start = useCallback((durationMs: number, symmetrical: boolean, switchMs: number) => {
    dispatch({ type: "START", now: Date.now(), durationMs, symmetrical, switchMs });
  }, []);

  const cancel = useCallback(() => {
    dispatch({ type: "CANCEL" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (phase.kind === "idle") {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(phase));
  }, [phase]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const previous = window.sessionStorage.getItem(STORAGE_KEY);
    if (previous) {
      try {
        const parsed = JSON.parse(previous) as TimerState;
        if (parsed.kind === "running" || parsed.kind === "switching") {
          dispatch({ type: "TICK", now: Date.now() } as TimerEvent);
        }
      } catch {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (phase.kind === "idle" || phase.kind === "complete") {
      return;
    }

    const tick = () => dispatch({ type: "TICK", now: Date.now() } as TimerEvent);
    const deadline = "endsAt" in phase ? phase.endsAt : null;
    if (!deadline) {
      return;
    }

    const timeout = window.setTimeout(tick, Math.max(0, deadline - Date.now()));
    const interval = window.setInterval(tick, 1000);

    const refresh = () => tick();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [phase]);

  return { phase, start, cancel, reset };
}
