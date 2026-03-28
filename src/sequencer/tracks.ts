export interface TrackDef {
  name: string;
  shortName: string;
  sampleUrl: string;
  melodic: boolean;
}

export const TRACK_DEFS: TrackDef[] = [
  { name: 'Kick',    shortName: 'KK', sampleUrl: '/samples/kick.wav',    melodic: false },
  { name: 'Snare',   shortName: 'SN', sampleUrl: '/samples/snare.wav',   melodic: false },
  { name: 'Hi-hat',  shortName: 'HH', sampleUrl: '/samples/hihat.wav',   melodic: false },
  { name: 'Open HH', shortName: 'OH', sampleUrl: '/samples/openhat.wav', melodic: false },
  { name: 'Clap',    shortName: 'CP', sampleUrl: '/samples/clap.wav',    melodic: false },
  { name: 'Rim',     shortName: 'RM', sampleUrl: '/samples/rim.wav',     melodic: false },
  { name: 'Tom',     shortName: 'TM', sampleUrl: '/samples/tom.wav',     melodic: false },
  { name: 'Synth',   shortName: 'SY', sampleUrl: '/samples/synth.wav',   melodic: true  },
];
