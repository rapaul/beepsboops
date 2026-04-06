import type { SequencerState } from './state';
import { saveCurrentToBank, STORAGE_KEY, SavedStateV2 } from './state';
import { loadAllCustomSamples, storeSample } from '../audio/sample-store';

interface BeepsBoopsFile {
  magic: 'beepsboops';
  version: 1;
  state: SavedStateV2;
  samples: Record<string, string>;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(result);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function exportProjectFile(state: SequencerState): Promise<void> {
  saveCurrentToBank(state);

  const savedState: SavedStateV2 = {
    version: 2,
    patternBank: state.patternBank.map((slot) => ({
      patterns: slot.patterns.map((p) => [...p]),
      pitches: slot.pitches.map((p) => [...p]),
      volumes: slot.volumes.map((v) => [...v]),
    })),
    activePatternIndex: state.activePatternIndex,
    bpm: state.bpm,
    activeTrackIndex: state.activeTrackIndex,
  };

  const customSamples = await loadAllCustomSamples();
  const samples: Record<string, string> = {};
  for (const [key, buf] of customSamples) {
    samples[key] = arrayBufferToBase64(buf);
  }

  const file: BeepsBoopsFile = {
    magic: 'beepsboops',
    version: 1,
    state: savedState,
    samples,
  };

  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'beat.beepsboops.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function importProjectFile(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string) as BeepsBoopsFile;
        if (parsed.magic !== 'beepsboops' || parsed.version !== 1 || parsed.state?.version !== 2) {
          alert('Invalid beepsboops file');
          return;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.state));
        for (const [key, b64] of Object.entries(parsed.samples)) {
          try {
            await storeSample(key, base64ToArrayBuffer(b64));
          } catch (err) {
            console.error(`Failed to restore sample "${key}":`, err);
          }
        }
        location.reload();
      } catch {
        alert('Invalid beepsboops file');
      }
    };
    reader.readAsText(file);
  });
  input.click();
}
