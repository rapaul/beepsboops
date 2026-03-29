import { type SequencerState, toggleStep, setStepVolume, saveState } from '../sequencer/state';

let gridButtons: HTMLButtonElement[] = [];
let stateRef: SequencerState;

const HOLD_THRESHOLD_MS = 300;
const DRAG_SENSITIVITY = 200; // pixels for full 0→1 range

export function initGrid(container: HTMLElement, state: SequencerState): void {
  stateRef = state;
  container.innerHTML = '';

  for (let i = 0; i < 16; i++) {
    const btn = document.createElement('button');
    btn.className = 'step-btn';
    btn.dataset.step = String(i);
    btn.setAttribute('aria-label', `Step ${i + 1}`);

    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let isHolding = false;
    let startY = 0;
    let startVolume = 0;

    btn.addEventListener('pointerdown', (e) => {
      startY = e.clientY;
      isHolding = false;

      const track = state.tracks[state.activeTrackIndex];

      holdTimer = setTimeout(() => {
        isHolding = true;
        // Only allow volume adjust on active steps
        if (!track.pattern[i]) {
          toggleStep(state, i);
          updateGrid();
        }
        startVolume = track.volumes[i];
        btn.setPointerCapture(e.pointerId);
      }, HOLD_THRESHOLD_MS);
    });

    btn.addEventListener('pointermove', (e) => {
      if (!isHolding) return;
      const dy = startY - e.clientY; // up = positive = louder
      const newVol = Math.max(0.05, Math.min(1, startVolume + dy / DRAG_SENSITIVITY));
      setStepVolume(state, i, newVol);
      updateStepAppearance(i);
    });

    const endHold = () => {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      if (isHolding) {
        isHolding = false;
        saveState(state);
        return;
      }
      // Quick tap — toggle step
      toggleStep(state, i);
      updateGrid();
      saveState(state);
    };

    btn.addEventListener('pointerup', endHold);
    btn.addEventListener('pointercancel', endHold);

    container.appendChild(btn);
    gridButtons.push(btn);
  }

  updateGrid();
}

function updateStepAppearance(i: number): void {
  const track = stateRef.tracks[stateRef.activeTrackIndex];
  const btn = gridButtons[i];
  const isActive = track.pattern[i];
  btn.classList.toggle('active', isActive);
  if (isActive) {
    btn.style.opacity = String(0.3 + track.volumes[i] * 0.7);
  } else {
    btn.style.opacity = '';
  }
}

export function updateGrid(): void {
  const track = stateRef.tracks[stateRef.activeTrackIndex];
  for (let i = 0; i < 16; i++) {
    gridButtons[i].classList.toggle('active', track.pattern[i]);
    if (track.pattern[i]) {
      gridButtons[i].style.opacity = String(0.3 + track.volumes[i] * 0.7);
    } else {
      gridButtons[i].style.opacity = '';
    }
  }
}

export function setPlayingStep(step: number | null): void {
  for (let i = 0; i < 16; i++) {
    gridButtons[i].classList.toggle('playing', i === step);
  }
}
