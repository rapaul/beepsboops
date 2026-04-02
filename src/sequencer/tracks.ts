export interface TrackDef {
  name: string;
  shortName: string;
  sampleUrl: string;
  melodic: boolean;
  custom?: boolean;
}

export const BUILTIN_COUNT = 8;

export const TRACK_DEFS: TrackDef[] = [
  { name: 'Kick',     shortName: 'KK', sampleUrl: '/samples/kick.wav',    melodic: false },
  { name: 'Snare',    shortName: 'SN', sampleUrl: '/samples/snare.wav',   melodic: false },
  { name: 'Hi-hat',   shortName: 'HH', sampleUrl: '/samples/hihat.wav',   melodic: false },
  { name: 'Open HH',  shortName: 'OH', sampleUrl: '/samples/openhat.wav', melodic: false },
  { name: 'Clap',     shortName: 'CP', sampleUrl: '/samples/clap.wav',    melodic: false },
  { name: 'Rim',      shortName: 'RM', sampleUrl: '/samples/rim.wav',     melodic: false },
  { name: 'Tom',      shortName: 'TM', sampleUrl: '/samples/tom.wav',     melodic: false },
  { name: 'Synth',    shortName: 'SY', sampleUrl: '/samples/synth.wav',   melodic: true  },
  { name: 'Sample 1', shortName: 'S1', sampleUrl: '',                     melodic: false, custom: true },
  { name: 'Sample 2', shortName: 'S2', sampleUrl: '',                     melodic: false, custom: true },
  { name: 'Sample 3', shortName: 'S3', sampleUrl: '',                     melodic: false, custom: true },
  { name: 'Sample 4', shortName: 'S4', sampleUrl: '',                     melodic: false, custom: true },
  { name: 'Sample 5', shortName: 'S5', sampleUrl: '',                     melodic: false, custom: true },
  { name: 'Sample 6', shortName: 'S6', sampleUrl: '',                     melodic: false, custom: true },
  { name: 'Sample 7', shortName: 'S7', sampleUrl: '',                     melodic: false, custom: true },
  { name: 'Sample 8', shortName: 'S8', sampleUrl: '',                     melodic: false, custom: true },
];
