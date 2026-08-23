import { type SequencerState } from '../sequencer/state';
import { getAudioContext } from '../audio/context';
import { requestMicAccess, startRecording, stopRecording, blobToArrayBuffer, releaseMic, type MicRecording } from '../audio/mic-recorder';
import { storeSample, deleteSample } from '../audio/sample-store';
import { injectRawSample, decodeInjectedSample, clearBuffer } from '../audio/sample-loader';
import { trimSilence, audioBufferToWav } from '../audio/trim';

const MAX_RECORD_S = 10;

let overlay: HTMLElement | null = null;

/**
 * getUserMedia rejects for several reasons that are not a refused permission
 * prompt; reporting them all as "denied" sends people to reset a permission
 * that was never the problem.
 */
function micFailureReason(err: unknown): { status: string; message: string } {
  const name = (err as { name?: string } | null)?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return { status: 'MIC DENIED', message: 'MIC ACCESS DENIED' };
    case 'NotFoundError':
    case 'OverconstrainedError':
      return { status: 'NO MIC', message: 'NO MICROPHONE FOUND' };
    case 'NotReadableError':
      return { status: 'MIC BUSY', message: 'MIC IN USE ELSEWHERE' };
    default: {
      const msg = (err as { message?: string } | null)?.message;
      return { status: 'MIC ERROR', message: (msg || 'MIC UNAVAILABLE').toUpperCase() };
    }
  }
}

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
    if (track.buffer) opts.push('TRIM SAMPLE');
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
      } else if (line.startsWith('  TRIM') || line.startsWith('> TRIM')) {
        div.className = 'modal-tui-option';
        div.addEventListener('pointerdown', (e) => { e.stopPropagation(); showTrim(); });
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

  function showTrim() {
    // Close the sample menu overlay (skip onDone until trim editor exits)
    if (recordTimer) { clearInterval(recordTimer); recordTimer = null; }
    if (overlay) { overlay.remove(); overlay = null; }

    const buf = track.buffer!;
    const dur = buf.duration;
    let startNorm = track.sampleStart;
    let endNorm = track.sampleEnd;

    const trimOverlay = document.createElement('div');
    trimOverlay.className = 'modal-overlay';

    const panel = document.createElement('div');
    panel.className = 'trim-panel';

    const header = document.createElement('div');
    header.className = 'trim-header';
    header.textContent = `\u2554\u2550\u2550 ${slotKey}: TRIM \u2550\u2550\u2557`;
    panel.appendChild(header);

    const canvas = document.createElement('canvas');
    canvas.className = 'trim-canvas';
    panel.appendChild(canvas);

    const infoEl = document.createElement('div');
    infoEl.className = 'trim-info';
    panel.appendChild(infoEl);

    const doneBtn = document.createElement('div');
    doneBtn.className = 'modal-tui-option trim-btn';
    doneBtn.textContent = '> DONE';

    const cancelBtn = document.createElement('div');
    cancelBtn.className = 'modal-tui-option trim-btn';
    cancelBtn.textContent = '  CANCEL';

    const btnRow = document.createElement('div');
    btnRow.className = 'trim-btn-row';
    btnRow.appendChild(doneBtn);
    btnRow.appendChild(cancelBtn);
    panel.appendChild(btnRow);

    const footerEl = document.createElement('div');
    footerEl.className = 'trim-header';
    footerEl.textContent = '\u255A' + '\u2550'.repeat((`\u2554\u2550\u2550 ${slotKey}: TRIM \u2550\u2550\u2557`).length - 2) + '\u255D';
    panel.appendChild(footerEl);

    trimOverlay.appendChild(panel);
    document.body.appendChild(trimOverlay);

    let canvasCtx: CanvasRenderingContext2D | null = null;
    let cssW = 0;
    let cssH = 0;

    function updateInfo() {
      const s = (startNorm * dur).toFixed(2);
      const e = (endNorm * dur).toFixed(2);
      infoEl.textContent = `  \u25b6 ${s}s \u2015\u2015\u2015 ${e}s \u25c0`;
    }

    function draw() {
      if (!canvasCtx || !cssW || !cssH) return;
      const ctx = canvasCtx;
      const w = cssW;
      const h = cssH;

      const style = getComputedStyle(document.documentElement);
      const lcdBg = style.getPropertyValue('--lcd-bg').trim() || '#1e2d1e';
      const lcdText = style.getPropertyValue('--lcd-text').trim() || '#7ec87e';

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = lcdBg;
      ctx.fillRect(0, 0, w, h);

      // Draw waveform peaks
      ctx.fillStyle = lcdText;
      const totalSamples = buf.length;
      for (let px = 0; px < w; px++) {
        const s0 = Math.floor((px / w) * totalSamples);
        const s1 = Math.max(s0 + 1, Math.floor(((px + 1) / w) * totalSamples));
        let min = 0;
        let max = 0;
        for (let c = 0; c < buf.numberOfChannels; c++) {
          const data = buf.getChannelData(c);
          for (let i = s0; i < s1; i++) {
            const v = data[i];
            if (v < min) min = v;
            if (v > max) max = v;
          }
        }
        const yTop = ((1 - max) / 2) * h;
        const yBot = ((1 - min) / 2) * h;
        ctx.fillRect(px, yTop, 1, Math.max(1, yBot - yTop));
      }

      // Dim excluded regions
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = lcdBg;
      ctx.fillRect(0, 0, startNorm * w, h);
      ctx.fillRect(endNorm * w, 0, w - endNorm * w, h);
      ctx.restore();

      // Handle lines
      ctx.strokeStyle = lcdText;
      ctx.lineWidth = 2;
      const sx = Math.round(startNorm * w);
      const ex = Math.round(endNorm * w);
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex, 0); ctx.lineTo(ex, h); ctx.stroke();

      updateInfo();
    }

    requestAnimationFrame(() => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      cssW = rect.width;
      cssH = rect.height;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvasCtx = canvas.getContext('2d')!;
      canvasCtx.scale(dpr, dpr);
      draw();
    });

    // Preview playback
    let previewSource: AudioBufferSourceNode | null = null;

    function stopPreview() {
      if (previewSource) { try { previewSource.stop(); } catch { /* already ended */ } previewSource = null; }
    }

    function playPreview() {
      stopPreview();
      if (!track.gain) return;
      const ctx = getAudioContext();
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.connect(track.gain);
      const offset = startNorm * dur;
      const trimDur = (endNorm - startNorm) * dur;
      source.start(ctx.currentTime, offset, trimDur);
      previewSource = source;
      source.onended = () => { if (previewSource === source) previewSource = null; };
    }

    // Drag handles
    let dragging: 'start' | 'end' | null = null;

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const ds = Math.abs(x - startNorm);
      const de = Math.abs(x - endNorm);
      dragging = ds <= de ? 'start' : 'end';
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (dragging === 'start') {
        startNorm = Math.min(x, endNorm - 0.01);
      } else {
        endNorm = Math.max(x, startNorm + 0.01);
      }
      draw();
    });

    canvas.addEventListener('pointerup', () => {
      if (dragging) playPreview();
      dragging = null;
    });

    doneBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      stopPreview();
      track.sampleStart = startNorm;
      track.sampleEnd = endNorm;
      trimOverlay.remove();
      onDone();
    });

    cancelBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      stopPreview();
      trimOverlay.remove();
      onDone();
    });
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
    } catch (err) {
      const reason = micFailureReason(err);
      render(`STATUS: ${reason.status}`, ['CANCEL'], -1);
      rebindCancel(reason.message);
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
      track.sampleStart = 0;
      track.sampleEnd = 1;
      await storeSample(slotKey, rawBuf);
      showDone();
      return;
    }

    const trimmed = trimSilence(audioBuf);
    track.buffer = trimmed;
    track.sampleStart = 0;
    track.sampleEnd = 1;

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

  function rebindCancel(message = 'MIC ACCESS DENIED') {
    box.innerHTML = '';
    const msg = title + '\n\n  ' + message + '\n\n> CANCEL\n\n' + footer;
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
      if (recording.mediaRecorder.state !== 'inactive') {
        recording.mediaRecorder.stop();
      }
      releaseMic(recording.stream);
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
