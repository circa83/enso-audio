import { writable, derived } from 'svelte/store';
import type { Track } from '$lib/types/track';

/** currently‐loaded track */
export const current = writable<Track | null>(null);

/** playing / paused */
export const isPlaying = writable(false);

/** playback time (seconds) */
export const time = writable(0);

/** track duration (seconds) */
export const duration = writable(0);

/** Queue management */
export const queue = writable<Track[]>([]);

/** Upcoming track (for crossfade) */
export const nextTrack = writable<Track | null>(null);

/** Crossfade duration in seconds */
export const crossfadeDuration = writable(5);

/** Add track to queue */
export function addToQueue(track: Track) {
  queue.update(q => [...q, track]);
}

/** Remove track from queue */
export function removeFromQueue(trackId: string) {
  queue.update(q => q.filter(t => t.id !== trackId));
}

/** Clear the queue */
export function clearQueue() {
  queue.set([]);
}

/** Play next track in queue */
export function playNext() {
  queue.update(q => {
    const [next, ...rest] = q;
    if (next) {
      current.set(next);
      isPlaying.set(true);
    }
    return rest;
  });
}

/** Set up next track for crossfade */
export function prepareNextTrack(track: Track) {
  nextTrack.set(track);
}