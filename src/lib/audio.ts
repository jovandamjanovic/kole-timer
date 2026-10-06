let audioContext: AudioContext | null = null;

export function unlockAudio(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioCtor();
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  const silence = audioContext.createBuffer(1, 1, 22050);
  const channel = silence.getChannelData(0);
  channel[0] = 0;
  const source = audioContext.createBufferSource();
  source.buffer = silence;
  source.connect(audioContext.destination);
  source.start();
  source.stop(audioContext.currentTime + 0.01);

  return audioContext;
}

export function playSwitch(): void {
  const context = ensureAudioContext();
  if (!context) {
    return;
  }

  playTone(context, 660, 0.12, 0.12, 0.2);
  window.setTimeout(() => playTone(context, 660, 0.12, 0.12, 0.2), 120);
}

export function playComplete(): void {
  const context = ensureAudioContext();
  if (!context) {
    return;
  }

  playTone(context, 523, 0.15, 0.1, 0.2);
  window.setTimeout(() => playTone(context, 659, 0.15, 0.1, 0.2), 120);
  window.setTimeout(() => playTone(context, 784, 0.15, 0.1, 0.2), 240);
}

export function setAudioSessionMode(mode: "playback" | "auto"): void {
  if (typeof navigator === "undefined" || !("audioSession" in navigator)) {
    return;
  }

  const nav = navigator as Navigator & { audioSession?: { type?: "playback" | "auto" } };
  if (nav.audioSession) {
    nav.audioSession.type = mode;
  }
}

function ensureAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioCtor();
  }

  return audioContext;
}

function playTone(context: AudioContext, frequency: number, duration: number, delay: number, gainValue: number): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(gainValue, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start(context.currentTime + delay);
  oscillator.stop(context.currentTime + delay + duration);
}
