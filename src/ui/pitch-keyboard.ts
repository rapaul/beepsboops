import { type SequencerState, setStepVolume, setStepPitch, saveState } from '../sequencer/state';
import { playSample } from '../audio/sample-player';
import { getAudioContext, getMasterGain } from '../audio/context';

const WHITE_W = 36;
const WHITE_H = 100;
const BLACK_W = 22;
const BLACK_H = 62;
const BLACK_MODS = new Set([1, 3, 6, 8, 10]); // C#, D#, F#, G#, A#

interface KeyDef {
  semitones: number;
  isBlack: boolean;
}

function buildKeys(): KeyDef[] {
  const keys: KeyDef[] = [];
  for (let s = -24; s <= 24; s++) {
    const mod = ((s % 12) + 12) % 12;
    keys.push({ semitones: s, isBlack: BLACK_MODS.has(mod) });
  }
  return keys;
}

function semitoneLabel(s: number): string {
  if (s === 0) return '±0';
  return s > 0 ? `+${s}` : String(s);
}

export function openStepEditor(
  stepIndex: number,
  state: SequencerState,
): void {
  const track = state.tracks[state.activeTrackIndex];
  let pendingVolume = track.volumes[stepIndex];
  let pendingSemitones = track.pitches[stepIndex];

  // ── Overlay ──────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'pitch-keyboard-overlay';

  const modal = document.createElement('div');
  modal.className = 'pitch-keyboard-modal';
  overlay.appendChild(modal);

  // ── Header ────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'pitch-keyboard-header';
  const title = document.createElement('span');
  title.textContent = `STEP ${stepIndex + 1}`;
  header.appendChild(title);
  if (track.melodic) {
    const pitchDisplay = document.createElement('span');
    pitchDisplay.className = 'pk-current';
    pitchDisplay.textContent = semitoneLabel(pendingSemitones);
    header.appendChild(pitchDisplay);
    // update when pitch changes
    (modal as any)._updatePitch = (s: number) => {
      pitchDisplay.textContent = semitoneLabel(s);
    };
  }
  modal.appendChild(header);

  // ── Volume ────────────────────────────────────────────────
  const volSection = document.createElement('div');
  volSection.className = 'pk-vol-section';

  const volLabel = document.createElement('div');
  volLabel.className = 'pk-vol-label';
  const volText = document.createElement('span');
  volText.textContent = 'VOLUME';
  const volValue = document.createElement('span');
  volValue.className = 'pk-current';
  volValue.textContent = `${Math.round(pendingVolume * 100)}%`;
  volLabel.appendChild(volText);
  volLabel.appendChild(volValue);

  const volSlider = document.createElement('input');
  volSlider.type = 'range';
  volSlider.className = 'pk-vol-slider';
  volSlider.min = '5';
  volSlider.max = '100';
  volSlider.step = '1';
  volSlider.value = String(Math.round(pendingVolume * 100));
  volSlider.addEventListener('input', () => {
    pendingVolume = Number(volSlider.value) / 100;
    volValue.textContent = `${volSlider.value}%`;
  });

  volSection.appendChild(volLabel);
  volSection.appendChild(volSlider);
  modal.appendChild(volSection);

  // ── Pitch keyboard (melodic tracks only) ─────────────────
  if (track.melodic) {
    const keys = buildKeys();

    const scrollEl = document.createElement('div');
    scrollEl.className = 'pitch-keyboard-scroll';
    modal.appendChild(scrollEl);

    const keysContainer = document.createElement('div');
    keysContainer.className = 'pitch-keyboard-keys';
    scrollEl.appendChild(keysContainer);

    let totalWhite = 0;
    for (const k of keys) { if (!k.isBlack) totalWhite++; }
    keysContainer.style.width = `${totalWhite * WHITE_W}px`;
    keysContainer.style.height = `${WHITE_H}px`;

    let whiteCount = 0;
    const keyElements: HTMLButtonElement[] = [];

    for (const key of keys) {
      const btn = document.createElement('button');
      btn.className = `pk-key ${key.isBlack ? 'pk-black' : 'pk-white'}`;
      if (key.isBlack) {
        btn.style.left = `${whiteCount * WHITE_W - BLACK_W / 2}px`;
        btn.style.width = `${BLACK_W}px`;
        btn.style.height = `${BLACK_H}px`;
      } else {
        btn.style.left = `${whiteCount * WHITE_W}px`;
        btn.style.width = `${WHITE_W}px`;
        btn.style.height = `${WHITE_H}px`;
        whiteCount++;
      }
      if (key.semitones === pendingSemitones) {
        btn.classList.add('pk-selected');
      }

      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        pendingSemitones = key.semitones;
        (modal as any)._updatePitch?.(pendingSemitones);
        for (const el of keyElements) el.classList.remove('pk-selected');
        btn.classList.add('pk-selected');
        if (track.buffer) {
          const ctx = getAudioContext();
          const rate = Math.pow(2, key.semitones / 12);
          playSample(track.buffer, ctx.currentTime, getMasterGain(), rate, 0.8);
        }
      });

      keysContainer.appendChild(btn);
      keyElements.push(btn);
    }

    // Scroll to center the selected key
    requestAnimationFrame(() => {
      const sel = keysContainer.querySelector<HTMLElement>('.pk-selected');
      if (sel) {
        const keyLeft = parseInt(sel.style.left, 10);
        const keyWidth = sel.offsetWidth;
        scrollEl.scrollLeft = keyLeft - scrollEl.clientWidth / 2 + keyWidth / 2;
      }
    });
  }

  // ── Footer ────────────────────────────────────────────────
  const footer = document.createElement('div');
  footer.className = 'pitch-keyboard-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'pk-cancel-btn';
  cancelBtn.textContent = 'CANCEL';
  cancelBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    overlay.remove();
  });

  const okBtn = document.createElement('button');
  okBtn.className = 'pk-ok-btn';
  okBtn.textContent = 'OK';
  okBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    overlay.remove();
    setStepVolume(state, stepIndex, pendingVolume);
    setStepPitch(state, stepIndex, pendingSemitones);
    saveState(state);
  });

  footer.appendChild(cancelBtn);
  footer.appendChild(okBtn);
  modal.appendChild(footer);

  overlay.addEventListener('pointerdown', () => overlay.remove());
  modal.addEventListener('pointerdown', (e) => e.stopPropagation());

  document.body.appendChild(overlay);
}
