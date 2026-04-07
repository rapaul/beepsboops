import { getMasterGain, getAudioContext } from '../audio/context';
import { decodeAllSamples, decodeInjectedSample } from '../audio/sample-loader';
import { TRACK_DEFS } from './tracks';

export interface Track {
  name: string;
  shortName: string;
  sampleUrl: string;
  melodic: boolean;
  buffer: AudioBuffer | null;
  pattern: boolean[];
  pitches: number[];   // per-step semitone offset (melodic tracks)
  volumes: number[];   // per-step volume 0.0–1.0 (default 1.0)
  gain: GainNode | null;
  sampleStart: number; // normalized 0.0–1.0 trim start (non-destructive)
  sampleEnd: number;   // normalized 0.0–1.0 trim end
}

export interface PatternSlot {
  patterns: boolean[][];  // [trackIndex][step]
  pitches: number[][];
  volumes: number[][];
}

export interface SequencerState {
  tracks: Track[];
  bpm: number;
  isPlaying: boolean;
  currentStep: number;
  activeTrackIndex: number;
  activePatternIndex: number;
  pendingPatternIndex: number | null;
  patternBank: PatternSlot[];
}

export const STORAGE_KEY = 'beepsboops-state';

function createEmptyPattern(): boolean[] {
  return new Array(16).fill(false);
}

function createEmptyPitches(): number[] {
  return new Array(16).fill(0);
}

function createDefaultVolumes(): number[] {
  return new Array(16).fill(1);
}

function createEmptyPatternSlot(): PatternSlot {
  return {
    patterns: TRACK_DEFS.map(() => createEmptyPattern()),
    pitches: TRACK_DEFS.map(() => createEmptyPitches()),
    volumes: TRACK_DEFS.map(() => createDefaultVolumes()),
  };
}

export function createState(): SequencerState {
  const tracks: Track[] = TRACK_DEFS.map((def) => ({
    name: def.name,
    shortName: def.shortName,
    sampleUrl: def.sampleUrl,
    melodic: def.melodic,
    buffer: null,
    pattern: createEmptyPattern(),
    pitches: createEmptyPitches(),
    volumes: createDefaultVolumes(),
    gain: null,
    sampleStart: 0,
    sampleEnd: 1,
  }));

  const patternBank: PatternSlot[] = [];
  for (let i = 0; i < 8; i++) patternBank.push(createEmptyPatternSlot());

  return {
    tracks,
    bpm: 120,
    isPlaying: false,
    currentStep: 0,
    activeTrackIndex: 0,
    activePatternIndex: 0,
    pendingPatternIndex: null,
    patternBank,
  };
}

export function saveCurrentToBank(state: SequencerState): void {
  const slot = state.patternBank[state.activePatternIndex];
  for (let i = 0; i < state.tracks.length; i++) {
    slot.patterns[i] = [...state.tracks[i].pattern];
    slot.pitches[i] = [...state.tracks[i].pitches];
    slot.volumes[i] = [...state.tracks[i].volumes];
  }
}

export function loadPatternFromBank(state: SequencerState, index: number): void {
  saveCurrentToBank(state);
  state.activePatternIndex = index;
  const slot = state.patternBank[index];
  for (let i = 0; i < state.tracks.length; i++) {
    state.tracks[i].pattern = [...slot.patterns[i]];
    state.tracks[i].pitches = [...slot.pitches[i]];
    state.tracks[i].volumes = [...slot.volumes[i]];
  }
}

/** Apply pending pattern switch if one is queued. Called by scheduler at loop boundary. */
export function applyPendingPattern(state: SequencerState): void {
  if (state.pendingPatternIndex === null) return;
  loadPatternFromBank(state, state.pendingPatternIndex);
  state.pendingPatternIndex = null;
}

/** Wire up GainNodes and decode samples. Call after AudioContext is live. */
export async function initAudio(state: SequencerState): Promise<void> {
  const ctx = getAudioContext();
  const master = getMasterGain();

  for (const track of state.tracks) {
    if (!track.gain) {
      track.gain = ctx.createGain();
      track.gain.connect(master);
    }
  }

  // Decode built-in samples (those with URLs)
  const urls = state.tracks.filter((t) => t.sampleUrl).map((t) => t.sampleUrl);
  const buffers = await decodeAllSamples(urls);
  for (const track of state.tracks) {
    if (track.sampleUrl) {
      track.buffer = buffers.get(track.sampleUrl) ?? null;
    }
  }

  // Decode custom samples (injected into rawCache on startup)
  for (const track of state.tracks) {
    if (TRACK_DEFS.find((d) => d.shortName === track.shortName)?.custom) {
      const key = `custom:${track.shortName}`;
      const buf = await decodeInjectedSample(key);
      if (buf) track.buffer = buf;
    }
  }
}

export function toggleStep(state: SequencerState, step: number): void {
  const track = state.tracks[state.activeTrackIndex];
  track.pattern[step] = !track.pattern[step];
}

export function setStepPitch(state: SequencerState, step: number, pitch: number): void {
  const track = state.tracks[state.activeTrackIndex];
  track.pitches[step] = pitch;
}

export function setStepVolume(state: SequencerState, step: number, volume: number): void {
  const track = state.tracks[state.activeTrackIndex];
  track.volumes[step] = Math.max(0, Math.min(1, volume));
}

export function getActiveTrack(state: SequencerState): Track {
  return state.tracks[state.activeTrackIndex];
}

// Persistence

export interface TrackTrimPoint {
  sampleStart: number;
  sampleEnd: number;
}

export interface SavedStateV2 {
  version: 2;
  patternBank: PatternSlot[];
  activePatternIndex: number;
  bpm: number;
  activeTrackIndex: number;
  trackSettings?: TrackTrimPoint[];
}

interface SavedPatternLegacy {
  patterns: boolean[][];
  pitches: number[][];
  volumes?: number[][];
  bpm: number;
  activeTrackIndex: number;
}

export function saveState(state: SequencerState): void {
  saveCurrentToBank(state);
  const data: SavedStateV2 = {
    version: 2,
    patternBank: state.patternBank.map((slot) => ({
      patterns: slot.patterns.map((p) => [...p]),
      pitches: slot.pitches.map((p) => [...p]),
      volumes: slot.volumes.map((v) => [...v]),
    })),
    activePatternIndex: state.activePatternIndex,
    bpm: state.bpm,
    activeTrackIndex: state.activeTrackIndex,
    trackSettings: state.tracks.map((t) => ({ sampleStart: t.sampleStart, sampleEnd: t.sampleEnd })),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadSavedState(state: SequencerState): void {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);

    if (data.version === 2) {
      // V2 format: full pattern bank
      const saved = data as SavedStateV2;
      for (let s = 0; s < saved.patternBank.length && s < 8; s++) {
        const slot = saved.patternBank[s];
        for (let i = 0; i < state.tracks.length; i++) {
          if (slot.patterns?.[i]) state.patternBank[s].patterns[i] = [...slot.patterns[i]];
          if (slot.pitches?.[i]) state.patternBank[s].pitches[i] = [...slot.pitches[i]];
          if (slot.volumes?.[i]) state.patternBank[s].volumes[i] = [...slot.volumes[i]];
        }
      }
      state.activePatternIndex = saved.activePatternIndex ?? 0;
      if (saved.bpm) state.bpm = saved.bpm;
      if (saved.activeTrackIndex !== undefined) state.activeTrackIndex = saved.activeTrackIndex;
      if (saved.trackSettings) {
        for (let i = 0; i < state.tracks.length && i < saved.trackSettings.length; i++) {
          state.tracks[i].sampleStart = saved.trackSettings[i].sampleStart ?? 0;
          state.tracks[i].sampleEnd = saved.trackSettings[i].sampleEnd ?? 1;
        }
      }
    } else {
      // Legacy format: load into slot 0
      const legacy = data as SavedPatternLegacy;
      if (legacy.patterns && legacy.patterns.length === state.tracks.length) {
        for (let i = 0; i < state.tracks.length; i++) {
          state.patternBank[0].patterns[i] = legacy.patterns[i];
          if (legacy.pitches?.[i]) state.patternBank[0].pitches[i] = legacy.pitches[i];
          if (legacy.volumes?.[i]) state.patternBank[0].volumes[i] = legacy.volumes[i];
        }
      }
      state.activePatternIndex = 0;
      if (legacy.bpm) state.bpm = legacy.bpm;
      if (legacy.activeTrackIndex !== undefined) state.activeTrackIndex = legacy.activeTrackIndex;
    }

    // Load active pattern into live tracks
    const slot = state.patternBank[state.activePatternIndex];
    for (let i = 0; i < state.tracks.length; i++) {
      state.tracks[i].pattern = [...slot.patterns[i]];
      state.tracks[i].pitches = [...slot.pitches[i]];
      state.tracks[i].volumes = [...slot.volumes[i]];
    }
  } catch {
    // Corrupted storage, ignore
  }
}
