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

/** Inject a raw ArrayBuffer under a custom key (e.g. "custom:S1"). */
export function injectRawSample(key: string, raw: ArrayBuffer): void {
  rawCache.set(key, raw);
}

/** Decode a previously-injected raw sample by key. */
export async function decodeInjectedSample(key: string): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(key);
  if (cached) return cached;

  const raw = rawCache.get(key);
  if (!raw) return null;

  const ctx = getAudioContext();
  try {
    const audioBuffer = await ctx.decodeAudioData(raw.slice(0));
    bufferCache.set(key, audioBuffer);
    return audioBuffer;
  } catch {
    return null;
  }
}

/** Remove a cached buffer (e.g. after clearing a custom sample). */
export function clearBuffer(key: string): void {
  rawCache.delete(key);
  bufferCache.delete(key);
}
