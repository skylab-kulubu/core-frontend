import {
  DOOR_TONES,
  DOOR_VIBRATIONS,
  doorSoundOn,
  primeDoorSound,
  resetDoorSoundForTests,
  setDoorSoundOn,
  signalDoor,
} from '@/lib/door-feedback';

type FakeContext = {
  state: string;
  currentTime: number;
  resume: jest.Mock;
  createOscillator: jest.Mock;
  createGain: jest.Mock;
  destination: object;
};

function fakeAudio(state = 'suspended') {
  const contexts: FakeContext[] = [];
  const oscillators: Array<{ type: string; frequency: { value: number } }> = [];
  class FakeAudioContext {
    state = state;
    currentTime = 0;
    destination = {};
    resume = jest.fn(async () => {
      this.state = 'running';
    });
    createOscillator = jest.fn(() => {
      const osc = {
        type: '',
        frequency: { value: 0 },
        connect: jest.fn((node: unknown) => node),
        start: jest.fn(),
        stop: jest.fn(),
      };
      oscillators.push(osc);
      return osc;
    });
    createGain = jest.fn(() => ({
      gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
      connect: jest.fn((node: unknown) => node),
    }));
    constructor() {
      contexts.push(this as unknown as FakeContext);
    }
  }
  (window as unknown as { AudioContext?: unknown }).AudioContext = FakeAudioContext;
  return {
    contexts,
    oscillators,
    remove() {
      delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    },
  };
}

describe('door feedback', () => {
  let vibrate: jest.Mock;

  beforeEach(() => {
    resetDoorSoundForTests();
    window.localStorage.clear();
    vibrate = jest.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: undefined });
  });

  it('vibrates in three shapes: one for an entry, two for already in, two long for a refusal', () => {
    signalDoor('in', false);
    signalDoor('already', false);
    signalDoor('refused', false);
    expect(vibrate.mock.calls).toEqual([
      [DOOR_VIBRATIONS.in],
      [DOOR_VIBRATIONS.already],
      [DOOR_VIBRATIONS.refused],
    ]);
  });

  it('does nothing on a phone with no vibration and no sound (Safari on iPhone before a tap)', () => {
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: undefined });
    expect(() => signalDoor('in', true)).not.toThrow();
  });

  it('beeps only after the tap that woke the sound, and only while the sound is on', async () => {
    const audio = fakeAudio();
    try {
      signalDoor('in', true);
      expect(audio.contexts).toHaveLength(0);

      primeDoorSound();
      await Promise.resolve();
      expect(audio.contexts).toHaveLength(1);
      expect(audio.contexts[0].resume).toHaveBeenCalled();

      signalDoor('in', false);
      expect(audio.oscillators).toHaveLength(0);

      signalDoor('already', true);
      expect(audio.oscillators.map((osc) => osc.frequency.value)).toEqual(
        DOOR_TONES.already.map((tone) => tone.hz),
      );
      signalDoor('refused', true);
      expect(audio.oscillators.at(-1)?.type).toBe('square');
      // One page, one sound: a second tap wakes the same one
      primeDoorSound();
      expect(audio.contexts).toHaveLength(1);
    } finally {
      audio.remove();
    }
  });

  it('wakes a sound the phone stopped (screen locked, another app) and remakes a closed one', async () => {
    const audio = fakeAudio();
    try {
      primeDoorSound();
      await Promise.resolve();
      expect(audio.contexts[0].state).toBe('running');
      // iOS: the screen locked; the context is interrupted and beeps would be silent
      audio.contexts[0].state = 'interrupted';
      signalDoor('in', true);
      expect(audio.oscillators).toHaveLength(0);
      primeDoorSound();
      await Promise.resolve();
      expect(audio.contexts[0].resume).toHaveBeenCalledTimes(2);
      signalDoor('in', true);
      expect(audio.oscillators).toHaveLength(1);
      // A closed one is made anew
      audio.contexts[0].state = 'closed';
      primeDoorSound();
      expect(audio.contexts).toHaveLength(2);
    } finally {
      audio.remove();
    }
  });

  it('keeps the sound choice on this device, on unless turned off', () => {
    expect(doorSoundOn()).toBe(true);
    setDoorSoundOn(false);
    expect(doorSoundOn()).toBe(false);
    setDoorSoundOn(true);
    expect(doorSoundOn()).toBe(true);
  });
});
