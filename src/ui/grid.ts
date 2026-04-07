import { type SequencerState, toggleStep, saveState } from '../sequencer/state';
import { openStepEditor } from './pitch-keyboard';

let gridButtons: HTMLButtonElement[] = [];
let pitchLabels: HTMLSpanElement[] = [];
let stateRef: SequencerState;

const HOLD_THRESHOLD_MS = 300;

export function initGrid(container: HTMLElement, state: SequencerState): void {
  stateRef = state;
  container.innerHTML = '';

  for (let i = 0; i < 16; i++) {
    const btn = document.createElement('button');
    btn.className = 'step-btn';
    btn.dataset.step = String(i);
    btn.setAttribute('aria-label', `Step ${i + 1}`);

    const pitchLabel = document.createElement('span');
    pitchLabel.className = 'pitch-label';
    btn.appendChild(pitchLabel);
    pitchLabels.push(pitchLabel);

    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let overlayOpened = false;

    btn.addEventListener('pointerdown', () => {
      overlayOpened = false;
      const track = state.tracks[state.activeTrackIndex];

      holdTimer = setTimeout(() => {
        holdTimer = null;
        overlayOpened = true;
        if (!track.pattern[i]) {
          toggleStep(state, i);
          updateGrid();
        }
        openStepEditor(i, state);
        // Reflect any changes when overlay closes (OK saves directly)
        // updateGrid is called after OK via the observer pattern in openStepEditor
      }, HOLD_THRESHOLD_MS);
    });

    const endHold = () => {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
        toggleStep(state, i);
        updateGrid();
        saveState(state);
        return;
      }
      if (overlayOpened) {
        overlayOpened = false;
        updateGrid(); // Refresh opacity/labels after editor may have changed values
        return;
      }
    };

    btn.addEventListener('pointerup', endHold);
    btn.addEventListener('pointercancel', endHold);

    container.appendChild(btn);
    gridButtons.push(btn);
  }

  updateGrid();
}

function updatePitchLabel(label: HTMLSpanElement, semitones: number): void {
  if (semitones === 0) {
    label.textContent = '';
  } else {
    label.textContent = semitones > 0 ? `+${semitones}` : String(semitones);
  }
}

export function updateGrid(): void {
  const track = stateRef.tracks[stateRef.activeTrackIndex];
  for (let i = 0; i < 16; i++) {
    gridButtons[i].classList.toggle('active', track.pattern[i]);
    if (track.pattern[i]) {
      gridButtons[i].style.opacity = String(0.3 + track.volumes[i] * 0.7);
      gridButtons[i].style.setProperty('--vol', String(track.volumes[i]));
    } else {
      gridButtons[i].style.opacity = '';
      gridButtons[i].style.removeProperty('--vol');
    }
    updatePitchLabel(pitchLabels[i], track.pitches[i]);
  }
}

export function setPlayingStep(step: number | null): void {
  for (let i = 0; i < 16; i++) {
    gridButtons[i].classList.toggle('playing', i === step);
  }
}
