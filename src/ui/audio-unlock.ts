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

  const dismiss = () => {
    overlay.remove();
    onReady?.();
  };

  const unlock = (e: Event) => {
    e.preventDefault();
    // Kick off the unlock synchronously so we stay inside the gesture callstack.
    void ensureAudioReady().finally(dismiss);
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
    if (!isAudioUnlocked()) void ensureAudioReady();
  };
  document.addEventListener('pointerdown', fallback, { capture: true });
}
