import { writable } from 'svelte/store';

export type Track = {
  url: string;
  title: string;
};

/** currently‐loaded track */
export const current = writable<Track | null>(null);

/** playing / paused */
export const isPlaying = writable(false);

/** playback time (seconds) */
export const time = writable(0);

/** track duration (seconds) */
export const duration = writable(0);
