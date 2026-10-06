"use client";

import { useEffect, useRef, useState } from "react";

type HoldToCancelProps = {
  onCancel: () => void;
};

export function HoldToCancel({ onCancel }: HoldToCancelProps) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!holding || startedAt.current === null) {
      return;
    }

    const frame = window.setInterval(() => {
      const elapsed = Date.now() - startedAt.current!;
      const nextProgress = Math.min(1, elapsed / 1000);
      setProgress(nextProgress);

      if (elapsed >= 1000) {
        onCancel();
        setHolding(false);
        setProgress(0);
        startedAt.current = null;
      }
    }, 16);

    return () => window.clearInterval(frame);
  }, [holding, onCancel]);

  const handlePointerDown = () => {
    startedAt.current = Date.now();
    setHolding(true);
  };

  const cancelHold = () => {
    setHolding(false);
    setProgress(0);
    startedAt.current = null;
  };

  return (
    <button
      type="button"
      className="hold-cancel"
      onPointerDown={handlePointerDown}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
    >
      <span className="hold-cancel__label">Hold to stop</span>
      <span className="hold-cancel__ring" style={{ transform: `scale(${0.8 + progress * 0.2})` }} />
    </button>
  );
}
