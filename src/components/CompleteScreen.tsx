import { formatDuration } from "@/lib/format";

type CompleteScreenProps = {
  durationMs: number;
  actualMs: number[];
  symmetrical: boolean;
  onAgain: () => void;
  onReset: () => void;
};

export function CompleteScreen({ durationMs, actualMs, symmetrical, onAgain, onReset }: CompleteScreenProps) {
  const target = formatDuration(durationMs);
  const first = actualMs[0] ?? durationMs;
  const second = actualMs[1] ?? 0;
  const measuredText = symmetrical
    ? `${formatDuration(first)} per side · ${formatDuration(first + second)} total`
    : target;

  return (
    <div className="complete-screen">
      <h2>Done</h2>
      <div className="complete-screen__value">{measuredText}</div>
      <div className="complete-screen__detail">
        {symmetrical ? `Target: ${target} · switch included` : `Target: ${target}`}
      </div>
      <div className="complete-screen__actions">
        <button type="button" className="primary-button" onClick={onAgain}>Again</button>
        <button type="button" className="secondary-button" onClick={onReset}>Back</button>
      </div>
    </div>
  );
}
