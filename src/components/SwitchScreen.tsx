import { HoldToCancel } from "@/components/HoldToCancel";

type SwitchScreenProps = {
  onCancel: () => void;
};

export function SwitchScreen({ onCancel }: SwitchScreenProps) {
  return (
    <div className="switch-screen" aria-label="Switch sides">
      <div className="switch-screen__title">Switch sides</div>
      <div className="switch-screen__pulse" />
      <HoldToCancel onCancel={onCancel} />
    </div>
  );
}
