import { getMasterGain, getAudioContext } from '../audio/context';
import { TRACK_DEFS } from './tracks';

export interface Track {
  name: string;
  shortName: string;
  sampleUrl: string;
  melodic: boolean;
  buffer: AudioBuffer | null;
  pattern: boolean[];
  pitches: number[];   // per-step semitone offset (melodic tracks)
  gain: GainNode;
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

export function createState(): SequencerState {
  const ctx = getAudioContext();
  const master = getMasterGain();

  const tracks: Track[] = TRACK_DEFS.map((def) => {
    const gain = ctx.createGain();
    gain.connect(master);
    return {
      name: def.name,
      shortName: def.shortName,
      sampleUrl: def.sampleUrl,
      melodic: def.melodic,
      buffer: null,
      pattern: createEmptyPattern(),
      pitches: createEmptyPitches(),
      gain,
    };
  });

  return {
    tracks,
    bpm: 120,
    isPlaying: false,
    currentStep: 0,
    activeTrackIndex: 0,
  };
}

export function toggleStep(state: SequencerState, step: number): void {
  const track = state.tracks[state.activeTrackIndex];
  track.pattern[step] = !track.pattern[step];
}

export function setStepPitch(state: SequencerState, step: number, pitch: number): void {
  const track = state.tracks[state.activeTrackIndex];
  track.pitches[step] = pitch;
}

export function getActiveTrack(state: SequencerState): Track {
  return state.tracks[state.activeTrackIndex];
}

// Persistence

interface SavedPattern {
  patterns: boolean[][];
  pitches: number[][];
  bpm: number;
  activeTrackIndex: number;
}

export function saveState(state: SequencerState): void {
  const data: SavedPattern = {
    patterns: state.tracks.map((t) => [...t.pattern]),
    pitches: state.tracks.map((t) => [...t.pitches]),
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
      }
    }
    if (data.bpm) state.bpm = data.bpm;
    if (data.activeTrackIndex !== undefined) state.activeTrackIndex = data.activeTrackIndex;
  } catch {
    // Corrupted storage, ignore
  }
}
