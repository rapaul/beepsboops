import type { SequencerState } from '../sequencer/state';
import { saveState } from '../sequencer/state';
import { togglePlayback, setBpm } from '../sequencer/transport';
import { exportWav } from '../audio/export';
import { exportProjectFile, importProjectFile } from '../sequencer/file-io';

function openPatchModal(state: SequencerState): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const box = document.createElement('div');
  box.className = 'modal-tui';

  const title = '╔══ PATCH ══╗';
  const footer = '╚' + '═'.repeat(title.length - 2) + '╝';

  const options: { label: string; action: () => Promise<void> | void }[] = [
    {
      label: 'EXPORT WAV',
      action: async () => {
        close();
        await exportWav(state);
      },
    },
    {
      label: 'SAVE FILE',
      action: async () => {
        close();
        await exportProjectFile(state);
      },
    },
    {
      label: 'LOAD FILE',
      action: () => {
        close();
        importProjectFile();
      },
    },
    {
      label: 'CANCEL',
      action: () => close(),
    },
  ];

  function render() {
    box.innerHTML = '';
    const lines = [title, ''];
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
        div.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          opt.action();
        });
      }
      box.appendChild(div);
    }
  }

  function close() {
    overlay.remove();
  }

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) close();
  });

  render();
}

export function initTransportUI(
  container: HTMLElement,
  state: SequencerState,
  onTransportChange: () => void,
): void {
  container.innerHTML = `
    <div class="transport-row">
      <button class="play-btn" id="play-btn" aria-label="Play/Stop">PLAY</button>
      <button class="action-btn" id="patch-btn" aria-label="Patch menu">PATCH</button>
      <div class="bpm-controls">
        <button class="bpm-btn" id="bpm-down" aria-label="Decrease BPM">-</button>
        <span class="bpm-value" id="bpm-display">${state.bpm}</span>
        <button class="bpm-btn" id="bpm-up" aria-label="Increase BPM">+</button>
      </div>
    </div>
  `;

  const playBtn = document.getElementById('play-btn')!;
  const patchBtn = document.getElementById('patch-btn')!;
  const bpmDown = document.getElementById('bpm-down')!;
  const bpmUp = document.getElementById('bpm-up')!;
  const bpmDisplay = document.getElementById('bpm-display')!;

  playBtn.addEventListener('pointerdown', () => {
    // play() flips isPlaying synchronously, so the button can respond straight
    // away. Awaiting it would stall the UI behind the audio unlock and the
    // first-run sample decode — on iOS resume() can stay pending for seconds.
    const pending = togglePlayback(state);
    playBtn.textContent = state.isPlaying ? 'STOP' : 'PLAY';
    playBtn.classList.toggle('playing', state.isPlaying);
    onTransportChange();
    void Promise.resolve(pending).catch(() => {});
  });

  patchBtn.addEventListener('pointerdown', () => {
    openPatchModal(state);
  });

  const adjustBpm = (delta: number) => {
    setBpm(state, state.bpm + delta);
    bpmDisplay.textContent = String(state.bpm);
    saveState(state);
    onTransportChange();
  };

  // Tap for single increment, hold for fast repeat
  let holdInterval: ReturnType<typeof setInterval> | null = null;
  const startHold = (delta: number) => {
    adjustBpm(delta); // immediate first step
    holdInterval = setInterval(() => adjustBpm(delta), 100);
  };
  const stopHold = () => {
    if (holdInterval) {
      clearInterval(holdInterval);
      holdInterval = null;
    }
  };

  for (const [btn, delta] of [[bpmDown, -1], [bpmUp, 1]] as const) {
    btn.addEventListener('pointerdown', () => startHold(delta));
    btn.addEventListener('pointerup', stopHold);
    btn.addEventListener('pointerleave', stopHold);
  }
}
