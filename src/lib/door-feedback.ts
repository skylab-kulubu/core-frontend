/**
 * What the door's phone does besides the screen when a code is read: a vibration (Android
 * Chrome; Safari on iPhone has no vibration) and a short beep made with WebAudio, so an iPhone
 * says it too. A page may play sound only after a tap: `primeDoorSound` runs in the tap that
 * opens the camera (or turns the sound on), and the beeps after it play. The phone's silent
 * switch still silences them on an iPhone.
 */

export type DoorSignal = 'in' | 'already' | 'refused';

/** One tone: frequency (Hz), start and length (seconds). */
type Tone = { hz: number; at: number; length: number };

/** A bright tick for an entry, two middle beeps for "already in", a low long one for a refusal. */
export const DOOR_TONES: Record<DoorSignal, readonly Tone[]> = {
  in: [{ hz: 1320, at: 0, length: 0.12 }],
  already: [
    { hz: 660, at: 0, length: 0.1 },
    { hz: 660, at: 0.16, length: 0.1 },
  ],
  refused: [{ hz: 220, at: 0, length: 0.38 }],
};

/** Vibration patterns in milliseconds, the same three shapes. */
export const DOOR_VIBRATIONS: Record<DoorSignal, number | number[]> = {
  in: 120,
  already: [90, 80, 90],
  refused: [300, 100, 300],
};

/** How long the full-screen result stays before the camera is in view again. */
export const DOOR_FLASH_MS: Record<DoorSignal, number> = {
  in: 1500,
  already: 2500,
  refused: 3000,
};

const SOUND_KEY = 'door-sound';

/** Whether the door's beeps are on (on unless turned off on this device). */
export function doorSoundOn(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setDoorSoundOn(on: boolean): void {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // private window: the choice lasts until the page is left
  }
}

type AudioContextClass = new () => AudioContext;

function audioContextClass(): AudioContextClass | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioContextClass;
    webkitAudioContext?: AudioContextClass;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

let audio: AudioContext | null = null;

/** Opens (or wakes) the page's sound in a tap, so later beeps may play. */
export function primeDoorSound(): void {
  const Context = audioContextClass();
  if (!Context) return;
  try {
    audio ??= new Context();
    if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
  } catch {
    audio = null;
  }
}

function beep(signal: DoorSignal): void {
  if (!audio || audio.state !== 'running') return;
  const start = audio.currentTime;
  for (const tone of DOOR_TONES[signal]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = signal === 'refused' ? 'square' : 'sine';
    osc.frequency.value = tone.hz;
    // A short rise and fall, so the beep does not click
    gain.gain.setValueAtTime(0.0001, start + tone.at);
    gain.gain.exponentialRampToValueAtTime(0.25, start + tone.at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.at + tone.length);
    osc.connect(gain).connect(audio.destination);
    osc.start(start + tone.at);
    osc.stop(start + tone.at + tone.length + 0.02);
  }
}

/** Vibrates and beeps (when the sound is on) for one result. Never throws. */
export function signalDoor(signal: DoorSignal, soundOn: boolean): void {
  try {
    navigator.vibrate?.(DOOR_VIBRATIONS[signal]);
  } catch {
    // no vibration here
  }
  if (!soundOn) return;
  try {
    beep(signal);
  } catch {
    // no sound here
  }
}

/** For tests: forget the page's sound. */
export function resetDoorSoundForTests(): void {
  audio = null;
}
