import type { SequencerState } from '../sequencer/state';

/**
 * Render one loop (16 steps) to an AudioBuffer using OfflineAudioContext,
 * encode as WAV, and trigger a download.
 */
export async function exportWav(state: SequencerState): Promise<void> {
  const sampleRate = 44100;
  const secondsPerStep = 60 / state.bpm / 4;
  const loopDuration = secondsPerStep * 16;

  // Add tail time so the last step's sample can ring out
  const tailSeconds = 2;
  const totalSeconds = loopDuration + tailSeconds;
  const totalFrames = Math.ceil(totalSeconds * sampleRate);

  const offline = new OfflineAudioContext(2, totalFrames, sampleRate);

  const masterGain = offline.createGain();
  masterGain.connect(offline.destination);

  // Schedule every active step across all tracks
  for (const track of state.tracks) {
    if (!track.buffer) continue;

    const trackGain = offline.createGain();
    trackGain.connect(masterGain);

    for (let step = 0; step < 16; step++) {
      if (!track.pattern[step]) continue;

      const time = step * secondsPerStep;
      const semitones = track.pitches[step];
      const rate = semitones !== 0 ? Math.pow(2, semitones / 12) : 1.0;
      const volume = track.volumes[step];

      const source = offline.createBufferSource();
      source.buffer = track.buffer;
      source.playbackRate.value = rate;

      if (volume < 1.0) {
        const stepGain = offline.createGain();
        stepGain.gain.value = volume;
        source.connect(stepGain);
        stepGain.connect(trackGain);
      } else {
        source.connect(trackGain);
      }

      source.start(time);
    }
  }

  const rendered = await offline.startRendering();

  // Trim to loop duration (keep a tiny fade-out at end)
  const loopFrames = Math.ceil(loopDuration * sampleRate);
  const trimmed = trimBuffer(rendered, loopFrames);

  const wav = encodeWav(trimmed);
  downloadBlob(wav, `beepsboops-${state.bpm}bpm.wav`);
}

function trimBuffer(buffer: AudioBuffer, frames: number): AudioBuffer {
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, frames, buffer.sampleRate);
  const trimmed = ctx.createBuffer(buffer.numberOfChannels, frames, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    trimmed.getChannelData(ch).set(src.subarray(0, frames));
  }
  return trimmed;
}

function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const headerSize = 44;

  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);            // chunk size
  view.setUint16(20, 1, true);             // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels and convert float32 → int16
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = headerSize;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
