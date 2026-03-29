import './style.css';
import { fetchAllSamples } from './audio/sample-loader';
import { createState, loadSavedState } from './sequencer/state';
import { TRACK_DEFS } from './sequencer/tracks';
import { initGrid } from './ui/grid';
import { initDisplay, updateDisplay } from './ui/display';
import { initTrackSelector } from './ui/track-selector';
import { initTransportUI } from './ui/transport-ui';
import { startPlayhead, stopPlayhead } from './ui/playhead';

async function init(): Promise<void> {
  // Create sequencer state (no audio yet — deferred to first user gesture)
  const state = createState();
  loadSavedState(state);

  // Fetch raw sample data (no AudioContext needed)
  const sampleUrls = TRACK_DEFS.map((t) => t.sampleUrl);
  await fetchAllSamples(sampleUrls);

  // Build UI
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div id="display"></div>
    <div id="grid"></div>
    <div id="tracks"></div>
    <div id="transport"></div>
  `;

  initDisplay(document.getElementById('display')!);
  initGrid(document.getElementById('grid')!, state);
  initTrackSelector(document.getElementById('tracks')!, state, () => {
    updateDisplay(state, null);
  });

  // Transport with playhead integration
  initTransportUI(document.getElementById('transport')!, state, () => {
    if (state.isPlaying) {
      startPlayhead(state);
    } else {
      stopPlayhead(state);
    }
    updateDisplay(state, null);
  });

  updateDisplay(state, null);
}

init();
