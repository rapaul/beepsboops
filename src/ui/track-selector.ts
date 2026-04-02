import { type SequencerState, saveState } from '../sequencer/state';
import { BUILTIN_COUNT } from '../sequencer/tracks';
import { updateGrid } from './grid';
import { openSampleModal } from './sample-modal';

const HOLD_THRESHOLD_MS = 500;

let trackButtons: HTMLButtonElement[] = [];
let stateRef: SequencerState;
let onTrackChangeRef: () => void;

export function initTrackSelector(
  container: HTMLElement,
  state: SequencerState,
  onTrackChange: () => void,
): void {
  container.innerHTML = '';
  trackButtons = [];
  stateRef = state;
  onTrackChangeRef = onTrackChange;

  const builtinRow = document.createElement('div');
  builtinRow.className = 'track-row';

  const customRow = document.createElement('div');
  customRow.className = 'track-row';

  state.tracks.forEach((track, i) => {
    const btn = document.createElement('button');
    const isCustom = i >= BUILTIN_COUNT;
    btn.className = 'track-btn' + (isCustom ? ' custom' : '');
    btn.textContent = track.shortName;
    btn.setAttribute('aria-label', track.name);

    if (isCustom && !track.buffer) {
      btn.classList.add('empty');
    }

    if (isCustom) {
      // Long-press opens modal, tap selects track
      let holdTimer: ReturnType<typeof setTimeout> | null = null;
      let didLongPress = false;

      btn.addEventListener('pointerdown', (e) => {
        didLongPress = false;
        holdTimer = setTimeout(() => {
          didLongPress = true;
          openSampleModal(i, state, () => {
            refreshTrackButtons(state);
            onTrackChange();
          });
        }, HOLD_THRESHOLD_MS);
        e.preventDefault();
      });

      btn.addEventListener('pointerup', () => {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        if (!didLongPress) {
          selectTrack(i);
        }
      });

      btn.addEventListener('pointercancel', () => {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      });

      btn.addEventListener('pointerleave', () => {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      });
    } else {
      btn.addEventListener('pointerdown', () => {
        selectTrack(i);
      });
    }

    if (isCustom) {
      customRow.appendChild(btn);
    } else {
      builtinRow.appendChild(btn);
    }
    trackButtons.push(btn);
  });

  container.appendChild(builtinRow);
  container.appendChild(customRow);

  updateTrackSelection(state);
}

function selectTrack(i: number): void {
  stateRef.activeTrackIndex = i;
  updateTrackSelection(stateRef);
  updateGrid();
  saveState(stateRef);
  onTrackChangeRef();
}

function updateTrackSelection(state: SequencerState): void {
  trackButtons.forEach((btn, i) => {
    btn.classList.toggle('track-active', i === state.activeTrackIndex);
  });
}

export function refreshTrackButtons(state: SequencerState): void {
  trackButtons.forEach((btn, i) => {
    if (i >= BUILTIN_COUNT) {
      btn.classList.toggle('empty', !state.tracks[i].buffer);
    }
  });
  updateTrackSelection(state);
}
