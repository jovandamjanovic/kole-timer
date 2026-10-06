type DurationInputProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
};

export function DurationInput({ label, value, min, max, step = 5, onChange }: DurationInputProps) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  const displayValue = `${minutes}:${String(seconds).padStart(2, "0")}`;

  const setValue = (nextValue: number) => {
    const clamped = Math.min(Math.max(nextValue, min), max);
    onChange(clamped);
  };

  return (
    <div className="duration-input">
      <label>{label}</label>
      <div className="duration-input__field">
        <button type="button" onClick={() => setValue(value - step)} aria-label={`Decrease ${label}`}>
          −
        </button>
        <input
          aria-label={label}
          inputMode="numeric"
          value={displayValue}
          onChange={(event) => {
            const raw = event.target.value.trim();
            if (!raw) {
              return;
            }

            const parts = raw.split(":");
            const parsedMinutes = Number(parts[0] ?? 0);
            const parsedSeconds = Number(parts[1] ?? 0);
            const totalSeconds = isFinite(parsedMinutes) && isFinite(parsedSeconds)
              ? parsedMinutes * 60 + parsedSeconds
              : value;

            onChange(Math.max(min, Math.min(totalSeconds, max)));
          }}
        />
        <button type="button" onClick={() => setValue(value + step)} aria-label={`Increase ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}
