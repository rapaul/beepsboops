# beepsboops

A Pocket Operator-inspired 16-step web sequencer. Mobile-first, offline-capable, built with vanilla TypeScript and the Web Audio API.

## Quick Start

```bash
pnpm install
pnpm dev
```

Open the URL shown in your terminal (usually `http://localhost:5173`).

## Usage

- **4x4 grid**: Tap cells to toggle steps on/off for the active track
- **Track selector** (bottom row): Switch between 8 tracks — KK, SN, HH, OH, CP, RM, TM, SY
- **PLAY/STOP**: Start or stop the sequencer
- **BPM +/-**: Adjust tempo (60–180). Hold for fast repeat.

Patterns are saved to localStorage automatically.

## Build

```bash
pnpm build     # production build → dist/
pnpm preview   # preview the production build locally
```

## Project Structure

```
src/
├── main.ts              # Entry point — wires audio, state, and UI
├── audio/
│   ├── context.ts       # AudioContext singleton, iOS Safari unlock
│   ├── sample-loader.ts # Fetch + decode WAV files
│   ├── sample-player.ts # Play an AudioBuffer at a scheduled time
│   └── scheduler.ts     # Lookahead scheduler (Two Clocks pattern)
├── sequencer/
│   ├── state.ts         # Track/pattern state, localStorage persistence
│   ├── tracks.ts        # Sound bank definitions (8 tracks)
│   └── transport.ts     # Play/stop/BPM control
├── ui/
│   ├── grid.ts          # 4x4 step grid
│   ├── display.ts       # LCD-style info display
│   ├── track-selector.ts
│   ├── transport-ui.ts  # Play button + BPM controls
│   └── playhead.ts      # rAF loop for step highlighting
└── style.css            # All styles, CSS custom properties

public/samples/          # Synthesized drum WAV files
scripts/generate-samples.mjs  # Regenerate samples
```

## Tech Stack

- **TypeScript** — vanilla, no framework
- **Vite** — dev server and bundler
- **Web Audio API** — direct, no Tone.js
- **vite-plugin-pwa** — offline support via service worker

## Regenerating Samples

The drum samples are synthesized WAVs. To regenerate:

```bash
node scripts/generate-samples.mjs
```
