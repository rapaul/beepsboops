import { getAudioContext } from './context';
import { playSample } from './sample-player';
import type { SequencerState } from '../sequencer/state';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;

export interface ScheduledNote {
  step: number;
  time: number;
}

let timerId: ReturnType<typeof setTimeout> | null = null;
let nextNoteTime = 0;
let currentStep = 0;

// Queue consumed by the UI playhead for visual sync
export const notesInQueue: ScheduledNote[] = [];

function scheduleStep(state: SequencerState, time: number): void {
  for (const track of state.tracks) {
    if (track.pattern[currentStep] && track.buffer && track.gain) {
      const semitones = track.pitches[currentStep];
      const rate = semitones !== 0
        ? Math.pow(2, semitones / 12)
        : 1.0;
      playSample(track.buffer, time, track.gain, rate);
    }
  }
  notesInQueue.push({ step: currentStep, time });
}

function advanceStep(state: SequencerState): void {
  const secondsPerBeat = 60 / state.bpm;
  const secondsPerStep = secondsPerBeat / 4; // 16th notes
  nextNoteTime += secondsPerStep;
  currentStep = (currentStep + 1) % 16;
}

function schedulerTick(state: SequencerState): void {
  const ctx = getAudioContext();
  while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
    scheduleStep(state, nextNoteTime);
    advanceStep(state);
  }
  timerId = setTimeout(() => schedulerTick(state), LOOKAHEAD_MS);
}

export function startScheduler(state: SequencerState): void {
  const ctx = getAudioContext();
  currentStep = 0;
  nextNoteTime = ctx.currentTime;
  notesInQueue.length = 0;
  schedulerTick(state);
}

export function stopScheduler(): void {
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
  notesInQueue.length = 0;
}

export function getCurrentStep(): number {
  return currentStep;
}
