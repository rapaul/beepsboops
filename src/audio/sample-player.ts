import { getAudioContext } from './context';

export function playSample(
  buffer: AudioBuffer,
  time: number,
  destination: AudioNode,
  rate: number = 1.0,
  volume: number = 1.0,
): void {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;

  if (volume < 1.0) {
    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;
    source.connect(gainNode);
    gainNode.connect(destination);
  } else {
    source.connect(destination);
  }

  source.start(time);
}
