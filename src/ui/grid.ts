import { type SequencerState, toggleStep, setStepVolume, setStepPitch, saveState } from '../sequencer/state';

let gridButtons: HTMLButtonElement[] = [];
let pitchLabels: HTMLSpanElement[] = [];
let stateRef: SequencerState;

const HOLD_THRESHOLD_MS = 300;
const DRAG_SENSITIVITY = 200;   // pixels for full 0→1 volume range
const AXIS_LOCK_THRESHOLD = 8;  // px of movement before axis is decided
const SEMITONE_SENSITIVITY = 30; // px per semitone

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
    let isHolding = false;
    let startY = 0;
    let startX = 0;
    let startVolume = 0;
    let startPitch = 0;
    let wasActiveOnHoldStart = false;
    let moveAxis: 'none' | 'vertical' | 'horizontal' = 'none';

    btn.addEventListener('pointerdown', (e) => {
      startY = e.clientY;
      startX = e.clientX;
      isHolding = false;
      moveAxis = 'none';

      const track = state.tracks[state.activeTrackIndex];

      holdTimer = setTimeout(() => {
        isHolding = true;
        wasActiveOnHoldStart = track.pattern[i];
        if (!wasActiveOnHoldStart) {
          toggleStep(state, i);
          updateGrid();
        }
        startVolume = track.volumes[i];
        startPitch = track.pitches[i];
        btn.setPointerCapture(e.pointerId);
      }, HOLD_THRESHOLD_MS);
    });

    btn.addEventListener('pointermove', (e) => {
      if (!isHolding) return;
      const dx = e.clientX - startX;
      const dy = startY - e.clientY; // up = positive = louder

      if (moveAxis === 'none') {
        if (Math.abs(dx) > AXIS_LOCK_THRESHOLD || Math.abs(dy) > AXIS_LOCK_THRESHOLD) {
          moveAxis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
        }
      }

      if (moveAxis === 'vertical') {
        const newVol = Math.max(0.05, Math.min(1, startVolume + dy / DRAG_SENSITIVITY));
        setStepVolume(state, i, newVol);
        updateStepAppearance(i);
      } else if (moveAxis === 'horizontal' && wasActiveOnHoldStart) {
        const semitones = Math.max(-24, Math.min(24, startPitch + Math.round(dx / SEMITONE_SENSITIVITY)));
        setStepPitch(state, i, semitones);
        updatePitchLabel(pitchLabel, semitones);
      }
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

function updatePitchLabel(label: HTMLSpanElement, semitones: number): void {
  if (semitones === 0) {
    label.textContent = '';
  } else {
    label.textContent = semitones > 0 ? `+${semitones}` : String(semitones);
  }
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
  updatePitchLabel(pitchLabels[i], track.pitches[i]);
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
    updatePitchLabel(pitchLabels[i], track.pitches[i]);
  }
}

export function setPlayingStep(step: number | null): void {
  for (let i = 0; i < 16; i++) {
    gridButtons[i].classList.toggle('playing', i === step);
  }
}
