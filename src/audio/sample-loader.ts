import { getAudioContext } from './context';

const rawCache = new Map<string, ArrayBuffer>();
const bufferCache = new Map<string, AudioBuffer>();

/** Fetch sample data without requiring an AudioContext. */
export async function fetchSample(url: string): Promise<void> {
  if (rawCache.has(url)) return;
  const response = await fetch(url);
  rawCache.set(url, await response.arrayBuffer());
}

export async function fetchAllSamples(urls: string[]): Promise<void> {
  await Promise.all(urls.map(fetchSample));
}

/** Decode a previously-fetched sample. Requires a live AudioContext. */
export async function decodeSample(url: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(url);
  if (cached) return cached;

  const ctx = getAudioContext();
  const raw = rawCache.get(url);
  if (!raw) throw new Error(`Sample not fetched: ${url}`);

  try {
    // decodeAudioData detaches the buffer, so hand it a copy
    const audioBuffer = await ctx.decodeAudioData(raw.slice(0));
    bufferCache.set(url, audioBuffer);
    return audioBuffer;
  } catch {
    // Fallback: create a short silent buffer (e.g. headless browser with no audio support)
    const silent = ctx.createBuffer(1, ctx.sampleRate * 0.01, ctx.sampleRate);
    bufferCache.set(url, silent);
    return silent;
  }
}

export async function decodeAllSamples(urls: string[]): Promise<Map<string, AudioBuffer>> {
  await Promise.all(urls.map(decodeSample));
  return bufferCache;
}

export function getBuffer(url: string): AudioBuffer | undefined {
  return bufferCache.get(url);
}
