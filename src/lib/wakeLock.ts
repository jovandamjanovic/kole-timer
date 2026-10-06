let wakeLockSentinel: WakeLockSentinel | null = null;

export async function requestWakeLock(): Promise<void> {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
    return;
  }

  try {
    wakeLockSentinel = await navigator.wakeLock.request("screen");
  } catch {
    wakeLockSentinel = null;
  }
}

export async function releaseWakeLock(): Promise<void> {
  if (!wakeLockSentinel) {
    return;
  }

  try {
    await wakeLockSentinel.release();
  } finally {
    wakeLockSentinel = null;
  }
}

export function attachWakeLockRefresh(): () => void {
  if (typeof document === "undefined") {
    return () => undefined;
  }

  const refresh = () => {
    if (document.visibilityState === "visible") {
      void requestWakeLock();
    }
  };

  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("focus", refresh);

  return () => {
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("focus", refresh);
  };
}
