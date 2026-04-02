/**
 * Trim leading (and trailing) silence from an AudioBuffer.
 * Returns a new, shorter AudioBuffer with the quiet parts removed.
 *
 * `threshold` is a linear amplitude (0–1). Samples below this are "silence".
 * Default 0.01 ≈ −40 dB, which catches mic noise / near-silence reliably.
 */
export function trimSilence(
  buffer: AudioBuffer,
  threshold = 0.01,
): AudioBuffer {
  const ch0 = buffer.getChannelData(0);
  const len = ch0.length;

  // Find first sample above threshold
  let start = 0;
  for (let i = 0; i < len; i++) {
    if (Math.abs(ch0[i]) >= threshold) {
      start = i;
      break;
    }
  }

  // Find last sample above threshold
  let end = len - 1;
  for (let i = len - 1; i >= start; i--) {
    if (Math.abs(ch0[i]) >= threshold) {
      end = i;
      break;
    }
  }

  // Nothing above threshold — return a tiny silent buffer
  if (start >= end) {
    const ctx = new OfflineAudioContext(buffer.numberOfChannels, 1, buffer.sampleRate);
    return ctx.createBuffer(buffer.numberOfChannels, 1, buffer.sampleRate);
  }

  const trimmedLen = end - start + 1;
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, trimmedLen, buffer.sampleRate);
  const trimmed = ctx.createBuffer(buffer.numberOfChannels, trimmedLen, buffer.sampleRate);

  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = trimmed.getChannelData(c);
    for (let i = 0; i < trimmedLen; i++) {
      dst[i] = src[start + i];
    }
  }

  return trimmed;
}

/**
 * Encode an AudioBuffer as a 16-bit PCM WAV ArrayBuffer.
 * This lets us store a trimmed buffer back into IndexedDB in a format
 * that decodeAudioData can read back.
 */
export function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const dataSize = numFrames * numChannels * bytesPerSample;
  const headerSize = 44;
  const wav = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(wav);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);              // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels into 16-bit PCM
  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = buffer.getChannelData(c)[i];
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clamped * 0x7fff, true);
      offset += 2;
    }
  }

  return wav;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
