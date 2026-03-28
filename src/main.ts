import './style.css';
import { getAudioContext } from './audio/context';
import { loadAllSamples } from './audio/sample-loader';
import { createState, loadSavedState } from './sequencer/state';
import { TRACK_DEFS } from './sequencer/tracks';
import { initGrid } from './ui/grid';
import { initDisplay, updateDisplay } from './ui/display';
import { initTrackSelector } from './ui/track-selector';
import { initTransportUI } from './ui/transport-ui';
import { startPlayhead, stopPlayhead } from './ui/playhead';

async function init(): Promise<void> {
  // Force AudioContext creation so GainNodes can be wired
  getAudioContext();

  // Create sequencer state (wires up audio graph)
  const state = createState();
  loadSavedState(state);

  // Load all samples
  const sampleUrls = TRACK_DEFS.map((t) => t.sampleUrl);
  const buffers = await loadAllSamples(sampleUrls);

  // Assign loaded buffers to tracks
  for (const track of state.tracks) {
    track.buffer = buffers.get(track.sampleUrl) ?? null;
  }

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
