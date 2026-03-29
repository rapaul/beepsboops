import { getMasterGain, getAudioContext } from '../audio/context';
import { decodeAllSamples } from '../audio/sample-loader';
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
}

export interface SequencerState {
  tracks: Track[];
  bpm: number;
  isPlaying: boolean;
  currentStep: number;
  activeTrackIndex: number;
}

const STORAGE_KEY = 'beepsboops-state';

function createEmptyPattern(): boolean[] {
  return new Array(16).fill(false);
}

function createEmptyPitches(): number[] {
  return new Array(16).fill(0);
}

function createDefaultVolumes(): number[] {
  return new Array(16).fill(1);
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
  }));

  return {
    tracks,
    bpm: 120,
    isPlaying: false,
    currentStep: 0,
    activeTrackIndex: 0,
  };
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

  const urls = state.tracks.map((t) => t.sampleUrl);
  const buffers = await decodeAllSamples(urls);
  for (const track of state.tracks) {
    track.buffer = buffers.get(track.sampleUrl) ?? null;
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

interface SavedPattern {
  patterns: boolean[][];
  pitches: number[][];
  volumes?: number[][];
  bpm: number;
  activeTrackIndex: number;
}

export function saveState(state: SequencerState): void {
  const data: SavedPattern = {
    patterns: state.tracks.map((t) => [...t.pattern]),
    pitches: state.tracks.map((t) => [...t.pitches]),
    volumes: state.tracks.map((t) => [...t.volumes]),
    bpm: state.bpm,
    activeTrackIndex: state.activeTrackIndex,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadSavedState(state: SequencerState): void {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const data: SavedPattern = JSON.parse(raw);
    if (data.patterns && data.patterns.length === state.tracks.length) {
      for (let i = 0; i < state.tracks.length; i++) {
        state.tracks[i].pattern = data.patterns[i];
        if (data.pitches?.[i]) {
          state.tracks[i].pitches = data.pitches[i];
        }
        if (data.volumes?.[i]) {
          state.tracks[i].volumes = data.volumes[i];
        }
      }
    }
    if (data.bpm) state.bpm = data.bpm;
    if (data.activeTrackIndex !== undefined) state.activeTrackIndex = data.activeTrackIndex;
  } catch {
    // Corrupted storage, ignore
  }
}
