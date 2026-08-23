import { ensureAudioReady, isAudioUnlocked, initAudioResumeWatchers } from '../audio/context';

/**
 * Mobile Safari will not start audio outside a user gesture, and a WebAudio-only
 * page is silenced by the ringer switch until the media session is claimed.
 * A single explicit tap on load handles both.
 */
export function initAudioUnlock(container: HTMLElement, onReady?: () => void): void {
  initAudioResumeWatchers();

  const overlay = document.createElement('div');
  overlay.className = 'audio-unlock-overlay';
  overlay.innerHTML = `
    <button class="audio-unlock-btn" type="button">
      <span class="audio-unlock-icon">▶</span>
      <span class="audio-unlock-label">TAP TO ENABLE SOUND</span>
    </button>
  `;

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    overlay.remove();
    onReady?.();
  };

  const unlock = (e: Event) => {
    e.preventDefault();
    // Everything iOS requires inside the gesture callstack happens in the
    // synchronous part of ensureAudioReady, so the overlay can go straight
    // away. Waiting on the promise leaves it up until resume() settles, which
    // on iOS can stall long enough to look like the first tap did nothing.
    void ensureAudioReady();
    dismiss();
  };

  overlay.addEventListener('pointerdown', unlock);
  // Keyboard/desktop fallback — pointerdown covers touch and mouse.
  overlay.querySelector('.audio-unlock-btn')!.addEventListener('keydown', (e) => {
    const key = (e as KeyboardEvent).key;
    if (key === 'Enter' || key === ' ') unlock(e);
  });

  container.appendChild(overlay);

  // Safety net: if the overlay is somehow bypassed, the first tap anywhere
  // still unlocks audio.
  const fallback = () => {
    if (!dismissed) return; // the overlay's own handler covers this tap
    if (!isAudioUnlocked()) void ensureAudioReady();
  };
  document.addEventListener('pointerdown', fallback, { capture: true });
}
