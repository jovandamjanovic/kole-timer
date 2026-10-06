type InstallHintProps = {
  onInstall: () => void;
  onDismiss: () => void;
  visible: boolean;
};

export function InstallHint({ onInstall, onDismiss, visible }: InstallHintProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="install-hint">
      <span>Install the app on your home screen.</span>
      <div className="install-hint__actions">
        <button type="button" onClick={onInstall}>Install</button>
        <button type="button" className="secondary" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
}
