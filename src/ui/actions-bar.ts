import type { SequencerState } from '../sequencer/state';
import { saveCurrentToBank, saveState } from '../sequencer/state';
import { storeSample, loadSample } from '../audio/sample-store';
import { injectRawSample, clearBuffer } from '../audio/sample-loader';
import { BUILTIN_COUNT } from '../sequencer/tracks';
import { updateGrid } from './grid';
import { updatePatternSelector } from './display';
import { refreshTrackButtons } from './track-selector';

type CopyMode = 'idle' | 'from' | 'pattern-to' | 'sample-to';

let copyMode: CopyMode = 'idle';
let copySourceIndex = -1;
let copyBtnEl: HTMLButtonElement | null = null;
let stateRef: SequencerState | null = null;
let onChangeRef: (() => void) | null = null;

function setCopyMode(mode: CopyMode): void {
  copyMode = mode;
  if (!copyBtnEl) return;
  if (mode === 'idle') {
    copyBtnEl.textContent = 'COPY';
    copyBtnEl.classList.remove('mode-active');
  } else if (mode === 'from') {
    copyBtnEl.textContent = 'FROM';
    copyBtnEl.classList.add('mode-active');
  } else {
    copyBtnEl.textContent = 'TO';
    copyBtnEl.classList.add('mode-active');
  }
}

/**
 * Called by pattern selector on button press.
 * Returns true if copy mode intercepted the click (caller should skip normal behaviour).
 */
export function handlePatternSelect(index: number): boolean {
  if (copyMode === 'idle') return false;

  // Clicking a pattern button mid-sample-copy cancels
  if (copyMode === 'sample-to') {
    setCopyMode('idle');
    return true;
  }

  if (copyMode === 'from') {
    copySourceIndex = index;
    setCopyMode('pattern-to');
    updatePatternSelector(stateRef!);
    return true;
  }

  if (copyMode === 'pattern-to') {
    const state = stateRef!;
    saveCurrentToBank(state);
    const src = state.patternBank[copySourceIndex];
    const dst = state.patternBank[index];
    for (let i = 0; i < state.tracks.length; i++) {
      dst.patterns[i] = [...src.patterns[i]];
      dst.pitches[i] = [...src.pitches[i]];
      dst.volumes[i] = [...src.volumes[i]];
    }
    // If the destination is the currently active pattern, reload live tracks
    if (index === state.activePatternIndex) {
      for (let i = 0; i < state.tracks.length; i++) {
        state.tracks[i].pattern = [...dst.patterns[i]];
        state.tracks[i].pitches = [...dst.pitches[i]];
        state.tracks[i].volumes = [...dst.volumes[i]];
      }
      updateGrid();
    }
    saveState(state);
    onChangeRef?.();
    setCopyMode('idle');
    return true;
  }

  return false;
}

/**
 * Called by track selector on button press.
 * Returns true if copy mode intercepted the click (caller should skip normal behaviour).
 */
export function handleTrackSelect(index: number): boolean {
  if (copyMode === 'idle') return false;

  // Clicking a track button mid-pattern-copy cancels
  if (copyMode === 'pattern-to') {
    setCopyMode('idle');
    return true;
  }

  // Sample copy only works with custom tracks
  if (index < BUILTIN_COUNT) {
    setCopyMode('idle');
    return true;
  }

  if (copyMode === 'from') {
    copySourceIndex = index;
    setCopyMode('sample-to');
    return true;
  }

  if (copyMode === 'sample-to') {
    const state = stateRef!;
    copySample(state, copySourceIndex, index).then(() => {
      saveState(state);
      refreshTrackButtons(state);
      onChangeRef?.();
    });
    setCopyMode('idle');
    return true;
  }

  return false;
}

async function copySample(
  state: SequencerState,
  srcIdx: number,
  dstIdx: number,
): Promise<void> {
  const srcTrack = state.tracks[srcIdx];
  const dstTrack = state.tracks[dstIdx];

  // Copy IndexedDB entry
  const raw = await loadSample(srcTrack.shortName);
  if (raw) {
    await storeSample(dstTrack.shortName, raw);
    clearBuffer(`custom:${dstTrack.shortName}`);
    injectRawSample(`custom:${dstTrack.shortName}`, raw);
  }

  // Reuse decoded buffer (same audio data)
  dstTrack.buffer = srcTrack.buffer;
  dstTrack.sampleStart = srcTrack.sampleStart;
  dstTrack.sampleEnd = srcTrack.sampleEnd;
}

function showClearConfirm(state: SequencerState, onChange: () => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const box = document.createElement('div');
  box.className = 'modal-tui';

  const title = '╔══ CLEAR ALL ══╗';
  const footer = '╚' + '═'.repeat(title.length - 2) + '╝';

  const options: { label: string; action: () => void }[] = [
    {
      label: 'CLEAR ALL PATTERNS',
      action: () => { doClear(state, onChange); close(); },
    },
    { label: 'CANCEL', action: () => close() },
  ];

  function render() {
    box.innerHTML = '';
    const lines = [title, '', '  Wipe all steps on', '  all 8 patterns?', ''];
    for (const opt of options) {
      lines.push('  ' + opt.label);
    }
    lines.push('', footer);

    for (const line of lines) {
      const div = document.createElement('div');
      div.textContent = line;
      const opt = options.find((o) => line.trim() === o.label);
      if (opt) {
        div.className = 'modal-tui-option';
        div.addEventListener('pointerdown', (e) => { e.stopPropagation(); opt.action(); });
      }
      box.appendChild(div);
    }
  }

  function close() { overlay.remove(); }

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  render();
}

function doClear(state: SequencerState, onChange: () => void): void {
  for (const slot of state.patternBank) {
    for (let i = 0; i < state.tracks.length; i++) {
      slot.patterns[i] = new Array(16).fill(false);
      slot.pitches[i] = new Array(16).fill(0);
      slot.volumes[i] = new Array(16).fill(1);
    }
  }
  const slot = state.patternBank[state.activePatternIndex];
  for (let i = 0; i < state.tracks.length; i++) {
    state.tracks[i].pattern = [...slot.patterns[i]];
    state.tracks[i].pitches = [...slot.pitches[i]];
    state.tracks[i].volumes = [...slot.volumes[i]];
  }
  saveState(state);
  updateGrid();
  updatePatternSelector(state);
  onChange();
}

export function initActionsBar(
  container: HTMLElement,
  state: SequencerState,
  onChange: () => void,
): void {
  stateRef = state;
  onChangeRef = onChange;

  const clearBtn = document.createElement('button');
  clearBtn.className = 'action-btn';
  clearBtn.textContent = 'CLEAR';
  clearBtn.setAttribute('aria-label', 'Clear all patterns');

  copyBtnEl = document.createElement('button');
  copyBtnEl.className = 'action-btn';
  copyBtnEl.textContent = 'COPY';
  copyBtnEl.setAttribute('aria-label', 'Copy pattern or sample');

  clearBtn.addEventListener('pointerdown', () => {
    showClearConfirm(state, onChange);
  });

  copyBtnEl.addEventListener('pointerdown', () => {
    if (copyMode !== 'idle') {
      setCopyMode('idle');
      return;
    }
    setCopyMode('from');
  });

  const watLink = document.createElement('a');
  watLink.className = 'wat-link';
  watLink.textContent = 'wat?';
  watLink.href = '/help.html';
  watLink.target = '_blank';
  watLink.rel = 'noopener';
  watLink.setAttribute('aria-label', 'Open cheatsheet');

  container.appendChild(clearBtn);
  container.appendChild(copyBtnEl);
  container.appendChild(watLink);
}
