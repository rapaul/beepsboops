import type { SequencerState } from '../sequencer/state';
import { saveState } from '../sequencer/state';
import { togglePlayback, setBpm } from '../sequencer/transport';
import { exportWav } from '../audio/export';

export function initTransportUI(
  container: HTMLElement,
  state: SequencerState,
  onTransportChange: () => void,
): void {
  container.innerHTML = `
    <div class="transport-row">
      <div class="bpm-controls">
        <button class="bpm-btn" id="bpm-down" aria-label="Decrease BPM">-</button>
        <span class="bpm-value" id="bpm-display">${state.bpm}</span>
        <button class="bpm-btn" id="bpm-up" aria-label="Increase BPM">+</button>
      </div>
      <button class="play-btn" id="play-btn" aria-label="Play/Stop">PLAY</button>
      <button class="export-btn" id="export-btn" aria-label="Export WAV">WAV</button>
    </div>
  `;

  const playBtn = document.getElementById('play-btn')!;
  const exportBtn = document.getElementById('export-btn')!;
  const bpmDown = document.getElementById('bpm-down')!;
  const bpmUp = document.getElementById('bpm-up')!;
  const bpmDisplay = document.getElementById('bpm-display')!;

  playBtn.addEventListener('pointerdown', async () => {
    await togglePlayback(state);
    playBtn.textContent = state.isPlaying ? 'STOP' : 'PLAY';
    playBtn.classList.toggle('playing', state.isPlaying);
    onTransportChange();
  });

  exportBtn.addEventListener('pointerdown', async () => {
    exportBtn.textContent = '...';
    try {
      await exportWav(state);
    } finally {
      exportBtn.textContent = 'WAV';
    }
  });

  const adjustBpm = (delta: number) => {
    setBpm(state, state.bpm + delta);
    bpmDisplay.textContent = String(state.bpm);
    saveState(state);
    onTransportChange();
  };

  // Tap for single increment, hold for fast repeat
  let holdInterval: ReturnType<typeof setInterval> | null = null;
  const startHold = (delta: number) => {
    adjustBpm(delta); // immediate first step
    holdInterval = setInterval(() => adjustBpm(delta), 100);
  };
  const stopHold = () => {
    if (holdInterval) {
      clearInterval(holdInterval);
      holdInterval = null;
    }
  };

  for (const [btn, delta] of [[bpmDown, -1], [bpmUp, 1]] as const) {
    btn.addEventListener('pointerdown', () => startHold(delta));
    btn.addEventListener('pointerup', stopHold);
    btn.addEventListener('pointerleave', stopHold);
  }
}
