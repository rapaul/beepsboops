let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
  }
  return audioCtx;
}

export function getMasterGain(): GainNode {
  getAudioContext();
  return masterGain!;
}

export async function ensureAudioReady(): Promise<AudioContext> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    // resume() must be awaited inside the user-gesture callstack.
    // Race with a timeout so headless browsers don't hang forever.
    await Promise.race([
      ctx.resume(),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
  }
  // iOS Safari unlock: play a silent buffer on first interaction
  const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = silent;
  source.connect(ctx.destination);
  source.start();
  return ctx;
}
