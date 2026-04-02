import './style.css';
import { fetchAllSamples, injectRawSample } from './audio/sample-loader';
import { loadAllCustomSamples } from './audio/sample-store';
import { createState, loadSavedState, saveState } from './sequencer/state';
import { TRACK_DEFS } from './sequencer/tracks';
import { initGrid, updateGrid } from './ui/grid';
import { initPatternSelector, updatePatternSelector } from './ui/display';
import { initTrackSelector } from './ui/track-selector';
import { initTransportUI } from './ui/transport-ui';
import { startPlayhead, stopPlayhead, setOnLoop } from './ui/playhead';

async function init(): Promise<void> {
  // Create sequencer state (no audio yet — deferred to first user gesture)
  const state = createState();
  loadSavedState(state);

  // Load custom samples from IndexedDB and inject into raw cache
  try {
    const customSamples = await loadAllCustomSamples();
    for (const [slotKey, raw] of customSamples) {
      injectRawSample(`custom:${slotKey}`, raw);
    }
  } catch {
    // IndexedDB unavailable — custom samples won't persist
  }

  // Fetch raw sample data for built-in tracks (no AudioContext needed)
  const sampleUrls = TRACK_DEFS.map((t) => t.sampleUrl).filter((u) => u);
  await fetchAllSamples(sampleUrls);

  // Build UI
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div id="display"></div>
    <div id="grid"></div>
    <div id="tracks"></div>
    <div id="transport"></div>
  `;

  initGrid(document.getElementById('grid')!, state);
  initPatternSelector(document.getElementById('display')!, state, () => {
    updateGrid();
    saveState(state);
    updatePatternSelector(state);
  });
  initTrackSelector(document.getElementById('tracks')!, state, () => {});

  // Transport with playhead integration
  initTransportUI(document.getElementById('transport')!, state, () => {
    if (state.isPlaying) {
      startPlayhead(state);
    } else {
      stopPlayhead(state);
    }
  });

  // When the loop wraps, sync UI if the scheduler applied a pending pattern
  setOnLoop(() => {
    updatePatternSelector(state);
    updateGrid();
    saveState(state);
  });

  updatePatternSelector(state);
}

init();
