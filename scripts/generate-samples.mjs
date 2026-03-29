/**
 * Generates basic drum sample WAV files using synthesis.
 * Run with: node scripts/generate-samples.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'samples');
mkdirSync(outDir, { recursive: true });

const SAMPLE_RATE = 44100;

function createWav(samples) {
  const numSamples = samples.length;
  const byteRate = SAMPLE_RATE * 2; // 16-bit mono
  const blockAlign = 2;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);        // chunk size
  buffer.writeUInt16LE(1, 20);         // PCM
  buffer.writeUInt16LE(1, 22);         // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);        // bits per sample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
  }

  return buffer;
}

function generateSamples(durationSec, fn) {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const samples = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    samples[i] = fn(t, i, numSamples);
  }
  return samples;
}

// Kick: sine wave with pitch sweep down
function kick() {
  return generateSamples(0.4, (t) => {
    const freq = 150 * Math.exp(-t * 10) + 40;
    const env = Math.exp(-t * 6);
    return Math.sin(2 * Math.PI * freq * t) * env * 0.9;
  });
}

// Snare: sine body + noise burst
function snare() {
  return generateSamples(0.25, (t) => {
    const body = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 20) * 0.5;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 12) * 0.6;
    return body + noise;
  });
}

// Hi-hat: filtered noise, short
function hihat() {
  return generateSamples(0.08, (t) => {
    const env = Math.exp(-t * 60);
    return (Math.random() * 2 - 1) * env * 0.4;
  });
}

// Open hi-hat: longer noise
function openhat() {
  return generateSamples(0.3, (t) => {
    const env = Math.exp(-t * 8);
    return (Math.random() * 2 - 1) * env * 0.35;
  });
}

// Clap: multiple noise bursts
function clap() {
  return generateSamples(0.2, (t) => {
    let val = 0;
    // Three quick bursts then a tail
    for (let b = 0; b < 3; b++) {
      const offset = b * 0.01;
      if (t >= offset && t < offset + 0.015) {
        val += (Math.random() * 2 - 1) * 0.5;
      }
    }
    // Tail
    if (t >= 0.03) {
      val += (Math.random() * 2 - 1) * Math.exp(-(t - 0.03) * 15) * 0.6;
    }
    return val;
  });
}

// Rim: short, bright click
function rim() {
  return generateSamples(0.06, (t) => {
    const env = Math.exp(-t * 80);
    const tone = Math.sin(2 * Math.PI * 800 * t) * 0.6;
    const click = (Math.random() * 2 - 1) * 0.4;
    return (tone + click) * env;
  });
}

// Tom: pitched sine with decay
function tom() {
  return generateSamples(0.35, (t) => {
    const freq = 100 * Math.exp(-t * 3) + 80;
    const env = Math.exp(-t * 8);
    return Math.sin(2 * Math.PI * freq * t) * env * 0.7;
  });
}

// Synth: simple saw-ish wave (will be pitched by the sequencer)
function synth() {
  return generateSamples(0.5, (t) => {
    const freq = 261.63; // Middle C
    const env = Math.exp(-t * 4);
    // Simple saw approximation with 4 harmonics
    let val = 0;
    for (let h = 1; h <= 4; h++) {
      val += Math.sin(2 * Math.PI * freq * h * t) / h;
    }
    return val * env * 0.3;
  });
}

const samples = {
  kick, snare, hihat, openhat, clap, rim, tom, synth,
};

for (const [name, fn] of Object.entries(samples)) {
  const data = fn();
  const wav = createWav(data);
  const path = join(outDir, `${name}.wav`);
  writeFileSync(path, wav);
  console.log(`wrote ${path} (${wav.length} bytes)`);
}

console.log('done!');
