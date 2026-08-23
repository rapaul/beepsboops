let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let unlocked = false;
let silentEl: HTMLAudioElement | null = null;

type AudioContextCtor = typeof AudioContext;

function getCtor(): AudioContextCtor {
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) throw new Error('Web Audio API is not supported in this browser');
  return Ctor;
}

/**
 * iOS 16.4+ exposes an audio session type. The default ("auto") makes a
 * WebAudio-only page behave like an "ambient" sound source, which the hardware
 * ringer switch silences. "playback" opts into media playback, so the page is
 * audible with the switch set to silent — the usual cause of "no sound on
 * Safari mobile" when everything else looks fine.
 */
function setPlaybackSession(): void {
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
  } catch {
    // Not supported — the silent element below is the fallback.
  }
}

/** A ~1s silent looping WAV as a blob URL, used to hold the media session open. */
function silentWavUrl(): string {
  const sampleRate = 8000;
  const frames = sampleRate; // 1 second
  const dataBytes = frames * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);
  // Samples are already zero — silence.
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/**
 * Older iOS (pre-16.4) has no audioSession API. Playing a silent looping
 * <audio> element keeps the page in a media playback session, which routes
 * WebAudio output the same way.
 */
function startSilentElement(): void {
  if (silentEl) {
    void silentEl.play().catch(() => {});
    return;
  }
  const el = document.createElement('audio');
  el.src = silentWavUrl();
  el.loop = true;
  el.volume = 0.001;
  el.setAttribute('playsinline', '');
  el.setAttribute('webkit-playsinline', '');
  el.preload = 'auto';
  el.style.display = 'none';
  document.body.appendChild(el);
  silentEl = el;
  void el.play().catch(() => {
    // Autoplay refused outside a gesture — retried on the next unlock call.
  });
}

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const Ctor = getCtor();
    audioCtx = new Ctor();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
  }
  return audioCtx;
}

export function getMasterGain(): GainNode {
  getAudioContext();
  return masterGain!;
}

export function isAudioUnlocked(): boolean {
  return unlocked && audioCtx?.state === 'running';
}

/**
 * Must be called synchronously from inside a user-gesture handler (pointerdown).
 * Everything that iOS requires to happen in the gesture callstack — creating the
 * context, resume(), the silent buffer, the media element — is done up front,
 * before any await.
 */
export async function ensureAudioReady(): Promise<AudioContext> {
  setPlaybackSession();
  const ctx = getAudioContext();

  // Silent one-frame buffer: the classic iOS unlock, started synchronously.
  try {
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    source.connect(ctx.destination);
    source.start();
  } catch {
    // Context in a bad state — resume() below is the recovery path.
  }

  startSilentElement();

  const resuming = ctx.state !== 'running' ? ctx.resume() : Promise.resolve();

  // Race with a timeout so headless browsers without audio don't hang forever.
  await Promise.race([resuming, new Promise((r) => setTimeout(r, 2000))]);

  unlocked = true;
  return ctx;
}

/**
 * iOS suspends the context when the tab is backgrounded or the phone locks, and
 * does not always resume it on return. Re-resume once the page is visible again.
 */
export function initAudioResumeWatchers(): void {
  const resume = () => {
    if (!unlocked || !audioCtx) return;
    if (audioCtx.state !== 'running') void audioCtx.resume().catch(() => {});
    if (silentEl?.paused) void silentEl.play().catch(() => {});
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resume();
  });
  window.addEventListener('pageshow', resume);
  window.addEventListener('focus', resume);
}
