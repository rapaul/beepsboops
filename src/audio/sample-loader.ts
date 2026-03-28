import { getAudioContext } from './context';

const bufferCache = new Map<string, AudioBuffer>();

export async function loadSample(url: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(url);
  if (cached) return cached;

  const ctx = getAudioContext();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  bufferCache.set(url, audioBuffer);
  return audioBuffer;
}

export async function loadAllSamples(urls: string[]): Promise<Map<string, AudioBuffer>> {
  await Promise.all(urls.map(loadSample));
  return bufferCache;
}

export function getBuffer(url: string): AudioBuffer | undefined {
  return bufferCache.get(url);
}
