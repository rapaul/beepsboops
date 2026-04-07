import { ensureAudioReady } from '../audio/context';
import { startScheduler, stopScheduler } from '../audio/scheduler';
import type { SequencerState } from './state';
import { initAudio } from './state';

let audioInitialized = false;

export async function play(state: SequencerState): Promise<void> {
  if (state.isPlaying) return;
  state.isPlaying = true;
  await ensureAudioReady();
  if (!audioInitialized) {
    await initAudio(state);
    audioInitialized = true;
  }
  startScheduler(state);
}

export function stop(state: SequencerState): void {
  if (!state.isPlaying) return;
  state.isPlaying = false;
  state.currentStep = 0;
  stopScheduler();
}

export function togglePlayback(state: SequencerState): Promise<void> | void {
  if (state.isPlaying) {
    stop(state);
  } else {
    return play(state);
  }
}

export function setBpm(state: SequencerState, bpm: number): void {
  state.bpm = Math.max(60, Math.min(180, bpm));
}
