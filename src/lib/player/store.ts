import { writable, derived } from 'svelte/store';
import type { Track } from '$lib/types/track';

/** Currently playing track */
export const current = writable<Track | null>(null);

/** Playing / paused */
export const isPlaying = writable(false);

/** Current playback time (seconds) */
export const time = writable(0);

/** Track duration (seconds) */
export const duration = writable(0);

/** Queue of tracks */
export const queue = writable<Track[]>([]);

/** Crossfade duration in seconds */
export const crossfadeDuration = writable(3);

// Queue management functions
export function addToQueue(track: Track) {
  queue.update(q => [...q, track]);
}

export function removeFromQueue(trackId: string) {
  queue.update(q => q.filter(t => t.id !== trackId));
}

export function clearQueue() {
  queue.set([]);
}