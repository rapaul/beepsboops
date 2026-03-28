import { type SequencerState, saveState } from '../sequencer/state';
import { updateGrid } from './grid';

let trackButtons: HTMLButtonElement[] = [];

export function initTrackSelector(
  container: HTMLElement,
  state: SequencerState,
  onTrackChange: () => void,
): void {
  container.innerHTML = '';

  state.tracks.forEach((track, i) => {
    const btn = document.createElement('button');
    btn.className = 'track-btn';
    btn.textContent = track.shortName;
    btn.setAttribute('aria-label', track.name);

    btn.addEventListener('pointerdown', () => {
      state.activeTrackIndex = i;
      updateTrackSelection(state);
      updateGrid();
      saveState(state);
      onTrackChange();
    });

    container.appendChild(btn);
    trackButtons.push(btn);
  });

  updateTrackSelection(state);
}

function updateTrackSelection(state: SequencerState): void {
  trackButtons.forEach((btn, i) => {
    btn.classList.toggle('track-active', i === state.activeTrackIndex);
  });
}
