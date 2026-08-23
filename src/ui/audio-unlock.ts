import { ensureAudioReady, isAudioUnlocked, initAudioResumeWatchers } from '../audio/context';

/**
 * Mobile Safari will not start audio outside a user gesture, and a WebAudio-only
 * page is silenced by the ringer switch until the media session is claimed.
 *
 * Pressing PLAY handles both on its own — its pointerdown handler reaches
 * ensureAudioReady() synchronously, inside the gesture callstack. But the pitch
 * keyboard and the sample modal preview sounds through getAudioContext()
 * directly, so a first tap there would otherwise build a context that was never
 * unlocked. A capture-phase listener on the document unlocks on whichever
 * gesture comes first, so no tap-to-enable gate is needed.
 */
export function initAudioUnlock(): void {
  initAudioResumeWatchers();

  const unlock = () => {
    if (isAudioUnlocked()) return;
    // Runs before the target's own handler, so audio is live by the time any
    // UI code reaches for the context.
    void ensureAudioReady();
  };

  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });
}
