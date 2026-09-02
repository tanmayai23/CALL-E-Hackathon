/**
 * Call-state sound cues — FRONTEND_DESIGN_PLUGINS.md §4.2 ("optional").
 *
 * Synthesised with the Web Audio API rather than shipped as audio files: no
 * asset pipeline, no extra bytes, and the tones stay tuneable in code.
 *
 * OFF by default. A dashboard that makes noise the first time a judge opens it
 * is a liability; the operator opts in, and the choice persists.
 */

const STORAGE_KEY = "sentinel.sound";

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    /* private mode — the toggle still works for this session */
  }
  if (enabled) context();
}

interface ToneSpec {
  freq: number;
  /** Seconds from the cue's start. */
  at: number;
  duration: number;
  gain?: number;
  type?: OscillatorType;
}

function play(tones: ToneSpec[]): void {
  if (!isSoundEnabled()) return;
  const audio = context();
  if (!audio) return;

  const now = audio.currentTime;
  for (const tone of tones) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = tone.type ?? "sine";
    osc.frequency.value = tone.freq;

    const start = now + tone.at;
    const peak = tone.gain ?? 0.06;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);

    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + tone.duration + 0.02);
  }
}

/** Two-tone ring, the shape of a phone ringing at the other end. */
export const cue = {
  ring: () =>
    play([
      { freq: 440, at: 0, duration: 0.34, gain: 0.045 },
      { freq: 480, at: 0, duration: 0.34, gain: 0.045 },
    ]),
  connect: () =>
    play([
      { freq: 660, at: 0, duration: 0.09, gain: 0.05 },
      { freq: 990, at: 0.09, duration: 0.11, gain: 0.04 },
    ]),
  success: () =>
    play([
      { freq: 587.33, at: 0, duration: 0.13, gain: 0.05 },
      { freq: 783.99, at: 0.11, duration: 0.13, gain: 0.05 },
      { freq: 1046.5, at: 0.22, duration: 0.24, gain: 0.045 },
    ]),
  error: () =>
    play([
      { freq: 233.08, at: 0, duration: 0.18, gain: 0.06, type: "triangle" },
      { freq: 174.61, at: 0.16, duration: 0.3, gain: 0.06, type: "triangle" },
    ]),
  escalate: () =>
    play([
      { freq: 392, at: 0, duration: 0.12, gain: 0.05, type: "triangle" },
      { freq: 329.63, at: 0.13, duration: 0.2, gain: 0.05, type: "triangle" },
    ]),
};
