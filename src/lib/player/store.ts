// src/lib/player/store.ts - NO CHANGES NEEDED
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

/** Session of tracks */
export const session = writable<Track[]>([]);

/** Crossfade duration in seconds */
export const crossfadeDuration = writable(3);

// Session management functions
export function addToSession(track: Track) {
  session.update(q => [...q, track]);
}

export function removeFromSession(trackId: string) {
  session.update(q => q.filter(t => t.id !== trackId));
}

export function clearSession() {
  session.set([]);
}