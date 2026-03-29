import type { SequencerState } from '../sequencer/state';
import { loadPatternFromBank, saveCurrentToBank } from '../sequencer/state';

let buttons: HTMLButtonElement[] = [];

export function initPatternSelector(
  container: HTMLElement,
  state: SequencerState,
  onPatternChange: () => void,
): void {
  container.innerHTML = '';

  for (let i = 0; i < 8; i++) {
    const btn = document.createElement('button');
    btn.className = 'pattern-btn';
    btn.textContent = String(i + 1);
    btn.setAttribute('aria-label', `Pattern ${i + 1}`);

    btn.addEventListener('pointerdown', () => {
      const targetIndex = i;
      if (state.isPlaying) {
        // Queue pattern switch at end of loop
        if (targetIndex === state.activePatternIndex) {
          // Clicking the active pattern cancels any pending switch
          state.pendingPatternIndex = null;
        } else {
          saveCurrentToBank(state);
          state.pendingPatternIndex = targetIndex;
        }
      } else {
        if (targetIndex === state.activePatternIndex) return;
        loadPatternFromBank(state, targetIndex);
      }
      onPatternChange();
    });

    container.appendChild(btn);
    buttons.push(btn);
  }

  updatePatternSelector(state);
}

export function updatePatternSelector(state: SequencerState): void {
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].classList.toggle('pattern-active', i === state.activePatternIndex);
    buttons[i].classList.toggle('pattern-pending', i === state.pendingPatternIndex);
  }
}
