import { HoldToCancel } from "@/components/HoldToCancel";
import { withBase } from "@/lib/basePath";

type HiddenScreenProps = {
  visual: "black" | "image";
  onCancel: () => void;
};

export function HiddenScreen({ visual, onCancel }: HiddenScreenProps) {
  const style = visual === "image"
    ? { backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.35)), url("${withBase("/hidden/forest.jpg")}")` }
    : undefined;

  return (
    <div
      className={`hidden-screen ${visual === "image" ? "hidden-screen--image" : ""}`}
      style={style}
      aria-label="Running interval"
    >
      <div className="hidden-screen__label">Running</div>
      <HoldToCancel onCancel={onCancel} />
    </div>
  );
}
