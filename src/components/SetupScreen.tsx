import { DurationInput } from "@/components/DurationInput";
import type { Settings } from "@/lib/settings";

type SetupScreenProps = {
  settings: Settings;
  onSettingsChange: (next: Settings) => void;
  onStart: () => void;
  onInstall: () => void;
  installVisible: boolean;
};

export function SetupScreen({
  settings,
  onSettingsChange,
  onStart,
  onInstall,
  installVisible,
}: SetupScreenProps) {
  const invalidRange = settings.maxSeconds < settings.minSeconds;
  const canStart = !invalidRange;

  return (
    <div className="setup-screen">
      <h1>Blind Interval Timer</h1>
      <p className="subtitle">Range: {settings.minSeconds}s – {settings.maxSeconds}s. You won’t see the countdown.</p>

      <div className="settings-grid">
        <DurationInput
          label="Min"
          value={settings.minSeconds}
          min={1}
          max={3600}
          onChange={(value) => onSettingsChange({ ...settings, minSeconds: value, maxSeconds: Math.max(settings.maxSeconds, value) })}
        />
        <DurationInput
          label="Max"
          value={settings.maxSeconds}
          min={1}
          max={3600}
          onChange={(value) => onSettingsChange({ ...settings, maxSeconds: value })}
        />
      </div>

      {invalidRange ? <p className="error">Max must be greater than or equal to min.</p> : null}

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={settings.symmetrical}
          onChange={(event) => onSettingsChange({ ...settings, symmetrical: event.target.checked })}
        />
        <span>Symmetrical exercise</span>
      </label>

      {settings.symmetrical ? (
        <div className="switch-control">
          <label>Switch time</label>
          <DurationInput
            label="Switch"
            value={settings.switchSeconds}
            min={2}
            max={15}
            onChange={(value) => onSettingsChange({ ...settings, switchSeconds: value })}
          />
        </div>
      ) : null}

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={settings.soundEnabled}
          onChange={(event) => onSettingsChange({ ...settings, soundEnabled: event.target.checked })}
        />
        <span>Sound</span>
      </label>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={settings.vibrationEnabled}
          onChange={(event) => onSettingsChange({ ...settings, vibrationEnabled: event.target.checked })}
        />
        <span>Vibration</span>
      </label>

      <div className="segmented">
        <button
          type="button"
          className={settings.hiddenVisual === "black" ? "selected" : ""}
          onClick={() => onSettingsChange({ ...settings, hiddenVisual: "black" })}
        >
          Black
        </button>
        <button
          type="button"
          className={settings.hiddenVisual === "image" ? "selected" : ""}
          onClick={() => onSettingsChange({ ...settings, hiddenVisual: "image" })}
        >
          Image
        </button>
      </div>

      <button type="button" className="primary-button" onClick={onStart} disabled={!canStart}>
        Start
      </button>

      <div className="setup-screen__note">
        Screen wake lock is attempted during a run; if your device blocks it, the app will still finish the interval once you return.
      </div>

      <button type="button" className="secondary-button" onClick={onInstall} hidden={!installVisible}>
        Install app
      </button>
    </div>
  );
}
