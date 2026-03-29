import { getAudioContext } from '../audio/context';
import { notesInQueue } from '../audio/scheduler';
import type { SequencerState } from '../sequencer/state';
import { setPlayingStep } from './grid';
import { updateDisplay } from './display';

let animFrameId: number | null = null;
let lastDrawnStep: number | null = null;

export function startPlayhead(state: SequencerState): void {
  function draw(): void {
    let currentStep: number | null = null;

    const ctx = getAudioContext();
    // Dequeue notes whose time has passed
    while (notesInQueue.length && notesInQueue[0].time <= ctx.currentTime) {
      currentStep = notesInQueue[0].step;
      notesInQueue.shift();
    }

    if (currentStep !== null && currentStep !== lastDrawnStep) {
      lastDrawnStep = currentStep;
      state.currentStep = currentStep;
      setPlayingStep(currentStep);
      updateDisplay(state, currentStep);
    }

    if (!state.isPlaying) {
      lastDrawnStep = null;
      setPlayingStep(null);
      updateDisplay(state, null);
      animFrameId = null;
      return;
    }

    animFrameId = requestAnimationFrame(draw);
  }

  lastDrawnStep = null;
  animFrameId = requestAnimationFrame(draw);
}

export function stopPlayhead(state: SequencerState): void {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  lastDrawnStep = null;
  setPlayingStep(null);
  updateDisplay(state, null);
}
