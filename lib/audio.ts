type AudioContextConstructor = new () => AudioContext;

declare global {
  interface Window {
    webkitAudioContext?: AudioContextConstructor;
  }
}

type Tone = {
  frequency: number;
  start: number;
  duration: number;
  volume: number;
  type: OscillatorType;
};

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.AudioContext ?? window.webkitAudioContext ?? null;
}

async function playTones(tones: Tone[]): Promise<void> {
  const AudioContextClass = getAudioContextConstructor();

  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();

  try {
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const now = audioContext.currentTime;

    tones.forEach((tone) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const startAt = now + tone.start;
      const endAt = startAt + tone.duration;

      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(tone.frequency, startAt);
      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.exponentialRampToValueAtTime(tone.volume, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, endAt);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.02);
    });

    const totalDuration = Math.max(...tones.map((tone) => tone.start + tone.duration));
    window.setTimeout(() => {
      void audioContext.close().catch((error: unknown) => {
        console.warn("Failed to close audio context.", error);
      });
    }, totalDuration * 1000 + 120);
  } catch (error) {
    console.warn("Failed to play feedback sound.", error);
    await audioContext.close().catch(() => undefined);
  }
}

export function playCorrectSound(): void {
  void playTones([
    { frequency: 660, start: 0, duration: 0.08, volume: 0.16, type: "sine" },
    { frequency: 880, start: 0.08, duration: 0.12, volume: 0.18, type: "sine" },
  ]);
}

export function playWrongSound(): void {
  void playTones([
    { frequency: 220, start: 0, duration: 0.16, volume: 0.14, type: "triangle" },
    { frequency: 165, start: 0.13, duration: 0.18, volume: 0.12, type: "triangle" },
  ]);
}
