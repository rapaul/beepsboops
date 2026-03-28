import type { SequencerState } from '../sequencer/state';

let bpmEl: HTMLElement;
let trackNameEl: HTMLElement;
let stepsEl: HTMLElement;
let statusEl: HTMLElement;

export function initDisplay(container: HTMLElement): void {
  container.innerHTML = `
    <div class="display-row">
      <span class="display-status" id="display-status">STOP</span>
      <span class="display-bpm" id="display-bpm">120</span>
    </div>
    <div class="display-track" id="display-track">Kick</div>
    <div class="display-steps" id="display-steps"></div>
  `;

  bpmEl = document.getElementById('display-bpm')!;
  trackNameEl = document.getElementById('display-track')!;
  stepsEl = document.getElementById('display-steps')!;
  statusEl = document.getElementById('display-status')!;

  // Create 16 step dots
  for (let i = 0; i < 16; i++) {
    const dot = document.createElement('span');
    dot.className = 'step-dot';
    stepsEl.appendChild(dot);
  }
}

export function updateDisplay(state: SequencerState, playingStep: number | null): void {
  bpmEl.textContent = String(state.bpm);
  trackNameEl.textContent = state.tracks[state.activeTrackIndex].name;
  statusEl.textContent = state.isPlaying ? 'PLAY' : 'STOP';
  statusEl.classList.toggle('status-playing', state.isPlaying);

  const dots = stepsEl.children;
  for (let i = 0; i < 16; i++) {
    (dots[i] as HTMLElement).classList.toggle('dot-active', i === playingStep);
  }
}
