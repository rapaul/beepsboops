import { getAudioContext } from '../audio/context';
import { notesInQueue } from '../audio/scheduler';
import type { SequencerState } from '../sequencer/state';
import { setPlayingStep } from './grid';

let animFrameId: number | null = null;
let lastDrawnStep: number | null = null;

let onLoopCallback: (() => void) | null = null;

export function setOnLoop(cb: () => void): void {
  onLoopCallback = cb;
}

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
      const looped = lastDrawnStep !== null && currentStep === 0;
      lastDrawnStep = currentStep;
      state.currentStep = currentStep;
      setPlayingStep(currentStep);
      if (looped && onLoopCallback) onLoopCallback();
    }

    if (!state.isPlaying) {
      lastDrawnStep = null;
      setPlayingStep(null);
      animFrameId = null;
      return;
    }

    animFrameId = requestAnimationFrame(draw);
  }

  lastDrawnStep = null;
  animFrameId = requestAnimationFrame(draw);
}

export function stopPlayhead(_state: SequencerState): void {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  lastDrawnStep = null;
  setPlayingStep(null);
}
