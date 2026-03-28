import { type SequencerState, toggleStep, saveState } from '../sequencer/state';

let gridButtons: HTMLButtonElement[] = [];
let stateRef: SequencerState;

export function initGrid(container: HTMLElement, state: SequencerState): void {
  stateRef = state;
  container.innerHTML = '';

  for (let i = 0; i < 16; i++) {
    const btn = document.createElement('button');
    btn.className = 'step-btn';
    btn.dataset.step = String(i);
    btn.setAttribute('aria-label', `Step ${i + 1}`);

    btn.addEventListener('pointerdown', () => {
      toggleStep(state, i);
      updateGrid();
      saveState(state);
    });

    container.appendChild(btn);
    gridButtons.push(btn);
  }

  updateGrid();
}

export function updateGrid(): void {
  const track = stateRef.tracks[stateRef.activeTrackIndex];
  for (let i = 0; i < 16; i++) {
    gridButtons[i].classList.toggle('active', track.pattern[i]);
  }
}

export function setPlayingStep(step: number | null): void {
  for (let i = 0; i < 16; i++) {
    gridButtons[i].classList.toggle('playing', i === step);
  }
}
