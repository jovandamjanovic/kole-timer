"use client";

import { useEffect, useRef, useState } from "react";
import { CompleteScreen } from "@/components/CompleteScreen";
import { HiddenScreen } from "@/components/HiddenScreen";
import { InstallHint } from "@/components/InstallHint";
import { SetupScreen } from "@/components/SetupScreen";
import { SwitchScreen } from "@/components/SwitchScreen";
import { playComplete, playSwitch, setAudioSessionMode, unlockAudio } from "@/lib/audio";
import { randomIntInclusive } from "@/lib/random";
import { loadSettings, saveSettings, type Settings } from "@/lib/settings";
import { vibrate } from "@/lib/vibrate";
import { useTimerMachine } from "@/hooks/useTimerMachine";
import { releaseWakeLock, requestWakeLock } from "@/lib/wakeLock";

type InstalledPromptEvent = Event & { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> };

export function TimerApp() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [installPrompt, setInstallPrompt] = useState<InstalledPromptEvent | null>(null);
  const [installVisible, setInstallVisible] = useState(false);
  const [standalone] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  });
  const { phase, start, cancel, reset } = useTimerMachine();
  const phaseRef = useRef(phase);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstalledPromptEvent);
      setInstallVisible(false);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setInstallVisible(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (phase.kind === "running" || phase.kind === "switching") {
      setAudioSessionMode("playback");
    } else {
      setAudioSessionMode("auto");
    }

    if (phase.kind === "complete") {
      void releaseWakeLock();
    }

    if (phase.kind === "idle") {
      void releaseWakeLock();
    }
  }, [phase]);

  useEffect(() => {
    const previous = phaseRef.current;

    if (phase.kind === "switching" && previous?.kind !== "switching") {
      if (settings.soundEnabled) {
        playSwitch();
      }
      if (settings.vibrationEnabled) {
        vibrate([200, 100, 200]);
      }
    }

    if (phase.kind === "complete" && previous?.kind !== "complete") {
      if (settings.soundEnabled) {
        playComplete();
      }
      if (settings.vibrationEnabled) {
        vibrate([400, 150, 400, 150, 400]);
      }
    }

    phaseRef.current = phase;
  }, [phase, settings.soundEnabled, settings.vibrationEnabled]);

  const handleStart = () => {
    if (settings.maxSeconds < settings.minSeconds) {
      return;
    }

    const durationMs = randomIntInclusive(settings.minSeconds, settings.maxSeconds) * 1000;
    unlockAudio();
    void requestWakeLock();
    start(durationMs, settings.symmetrical, settings.switchSeconds * 1000);
  };

  const handleInstallPrompt = async () => {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    setInstallPrompt(null);
  };

  const handleAgain = () => {
    reset();
    handleStart();
  };

  const renderCurrentScreen = () => {
    if (phase.kind === "idle") {
      return (
        <SetupScreen
          settings={settings}
          onSettingsChange={setSettings}
          onStart={handleStart}
          onInstall={handleInstallPrompt}
          installVisible={installVisible && !standalone}
        />
      );
    }

    if (phase.kind === "running") {
      return <HiddenScreen visual={settings.hiddenVisual} onCancel={() => cancel()} />;
    }

    if (phase.kind === "switching") {
      return <SwitchScreen onCancel={() => cancel()} />;
    }

    return (
      <CompleteScreen
        durationMs={phase.durationMs}
        actualMs={phase.actualMs}
        symmetrical={settings.symmetrical}
        onAgain={handleAgain}
        onReset={() => reset()}
      />
    );
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (standalone || installPrompt) {
      return;
    }

    const timeout = window.setTimeout(() => setInstallVisible(true), 300);
    return () => window.clearTimeout(timeout);
  }, [standalone, installPrompt]);

  return <div className="app-shell">{renderCurrentScreen()}<InstallHint visible={installVisible && !standalone} onInstall={handleInstallPrompt} onDismiss={() => setInstallVisible(false)} /></div>;
}
