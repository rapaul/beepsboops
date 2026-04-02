import { type SequencerState } from '../sequencer/state';
import { getAudioContext } from '../audio/context';
import { requestMicAccess, startRecording, stopRecording, blobToArrayBuffer, type MicRecording } from '../audio/mic-recorder';
import { storeSample, deleteSample } from '../audio/sample-store';
import { injectRawSample, decodeInjectedSample, clearBuffer } from '../audio/sample-loader';
import { trimSilence, audioBufferToWav } from '../audio/trim';

const MAX_RECORD_S = 10;

let overlay: HTMLElement | null = null;

export function openSampleModal(
  trackIndex: number,
  state: SequencerState,
  onDone: () => void,
): void {
  if (overlay) return;

  const track = state.tracks[trackIndex];
  const slotKey = track.shortName;
  const hasSample = !!track.buffer;

  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const box = document.createElement('div');
  box.className = 'modal-tui';

  const title = `\u2554\u2550\u2550 ${slotKey}: SAMPLE \u2550\u2550\u2557`;
  const footer = '\u255A' + '\u2550'.repeat(title.length - 2) + '\u255D';

  let recording: MicRecording | null = null;
  let recordTimer: ReturnType<typeof setInterval> | null = null;
  let recordStart = 0;

  function render(status: string, options: string[], selected: number) {
    const lines: string[] = [];
    lines.push(title);
    lines.push('');
    for (let i = 0; i < options.length; i++) {
      const cursor = i === selected ? '> ' : '  ';
      lines.push(cursor + options[i]);
    }
    lines.push('');
    lines.push(status);
    lines.push('');
    lines.push(footer);
    box.textContent = lines.join('\n');
  }

  function showMenu() {
    const opts = ['RECORD SAMPLE'];
    if (hasSample || track.buffer) opts.push('CLEAR SAMPLE');
    opts.push('CANCEL');
    const statusText = track.buffer
      ? `STATUS: READY  LENGTH: ${track.buffer.duration.toFixed(1)}s`
      : 'STATUS: EMPTY';
    render(statusText, opts, -1);

    // Make each option tappable
    const lines = box.textContent!.split('\n');
    box.innerHTML = '';
    for (const line of lines) {
      const div = document.createElement('div');
      div.textContent = line;

      if (line.startsWith('  RECORD') || line.startsWith('> RECORD')) {
        div.className = 'modal-tui-option';
        div.addEventListener('pointerdown', (e) => { e.stopPropagation(); startRecord(); });
      } else if (line.startsWith('  CLEAR') || line.startsWith('> CLEAR')) {
        div.className = 'modal-tui-option';
        div.addEventListener('pointerdown', (e) => { e.stopPropagation(); clearSample(); });
      } else if (line.startsWith('  CANCEL') || line.startsWith('> CANCEL')) {
        div.className = 'modal-tui-option';
        div.addEventListener('pointerdown', (e) => { e.stopPropagation(); close(); });
      }
      box.appendChild(div);
    }
  }

  async function startRecord() {
    render('STATUS: REQUESTING MIC...', [], -1);
    box.innerHTML = '';
    const div = document.createElement('div');
    div.textContent = box.textContent || '';
    box.appendChild(div);

    let stream: MediaStream;
    try {
      stream = await requestMicAccess();
    } catch {
      render('STATUS: MIC DENIED', ['CANCEL'], -1);
      rebindCancel();
      return;
    }

    recording = startRecording(stream);
    recordStart = performance.now();

    function updateTimer() {
      const elapsed = (performance.now() - recordStart) / 1000;
      const lines: string[] = [];
      lines.push(title);
      lines.push('');
      lines.push('  >> RECORDING... ' + elapsed.toFixed(1) + 's');
      lines.push('');
      lines.push('  TAP TO STOP');
      lines.push('');
      lines.push(footer);
      box.innerHTML = '';
      for (const l of lines) {
        const d = document.createElement('div');
        d.textContent = l;
        if (l.includes('RECORDING')) d.className = 'modal-recording';
        box.appendChild(d);
      }
    }

    updateTimer();
    recordTimer = setInterval(() => {
      const elapsed = (performance.now() - recordStart) / 1000;
      if (elapsed >= MAX_RECORD_S) {
        finishRecord();
      } else {
        updateTimer();
      }
    }, 100);

    // Tap anywhere on overlay to stop
    overlay!.addEventListener('pointerdown', onStopTap, { once: true });
  }

  function onStopTap(e: Event) {
    e.stopPropagation();
    finishRecord();
  }

  async function finishRecord() {
    if (!recording) return;
    if (recordTimer) { clearInterval(recordTimer); recordTimer = null; }

    const rec = recording;
    recording = null;

    render('STATUS: PROCESSING...', [], -1);
    box.innerHTML = '';
    const d = document.createElement('div');
    d.textContent = title + '\n\n  PROCESSING...\n\n' + footer;
    box.appendChild(d);

    const blob = await stopRecording(rec);
    const rawBuf = await blobToArrayBuffer(blob);

    // Decode, trim leading/trailing silence, then re-encode as WAV for storage
    const ctx = getAudioContext();
    let audioBuf: AudioBuffer;
    try {
      audioBuf = await ctx.decodeAudioData(rawBuf.slice(0));
    } catch {
      const key = `custom:${slotKey}`;
      injectRawSample(key, rawBuf);
      const decoded = await decodeInjectedSample(key);
      track.buffer = decoded;
      await storeSample(slotKey, rawBuf);
      showDone();
      return;
    }

    const trimmed = trimSilence(audioBuf);
    track.buffer = trimmed;

    // Store the trimmed version as WAV so it loads trimmed on next visit
    const wavBuf = audioBufferToWav(trimmed);
    const key = `custom:${slotKey}`;
    injectRawSample(key, wavBuf);
    await storeSample(slotKey, wavBuf);

    showDone();
  }

  function showDone() {
    const dur = track.buffer ? track.buffer.duration.toFixed(1) + 's' : '?';
    box.innerHTML = '';
    const lines = (
      title + '\n\n' +
      `  SAMPLE LOADED (${dur})\n\n` +
      '> OK\n\n' +
      footer
    ).split('\n');
    for (const l of lines) {
      const el = document.createElement('div');
      el.textContent = l;
      if (l.startsWith('> OK')) {
        el.className = 'modal-tui-option';
        el.addEventListener('pointerdown', (e) => { e.stopPropagation(); close(); });
      }
      box.appendChild(el);
    }
  }

  async function clearSample() {
    const key = `custom:${slotKey}`;
    clearBuffer(key);
    track.buffer = null;
    await deleteSample(slotKey);
    close();
  }

  function rebindCancel() {
    box.innerHTML = '';
    const msg = title + '\n\n  MIC ACCESS DENIED\n\n> CANCEL\n\n' + footer;
    for (const l of msg.split('\n')) {
      const el = document.createElement('div');
      el.textContent = l;
      if (l.startsWith('> CANCEL')) {
        el.className = 'modal-tui-option';
        el.addEventListener('pointerdown', (e) => { e.stopPropagation(); close(); });
      }
      box.appendChild(el);
    }
  }

  function close() {
    if (recording) {
      recording.stream.getTracks().forEach((t) => t.stop());
      if (recording.mediaRecorder.state !== 'inactive') {
        recording.mediaRecorder.stop();
      }
      recording = null;
    }
    if (recordTimer) { clearInterval(recordTimer); recordTimer = null; }
    if (overlay) { overlay.remove(); overlay = null; }
    onDone();
  }

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Tap on backdrop (not box) closes
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) close();
  });

  showMenu();
}
