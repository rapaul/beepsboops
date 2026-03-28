import { getAudioContext } from './context';

export function playSample(
  buffer: AudioBuffer,
  time: number,
  destination: AudioNode,
  rate: number = 1.0,
): void {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  source.connect(destination);
  source.start(time);
}
