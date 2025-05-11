// src/lib/player/store.ts
import { writable, derived } from 'svelte/store';
import type { Track } from '$lib/types/track';
import type { SessionItem } from '$lib/types/session';

/** Currently playing track */
export const current = writable<Track | null>(null);

/** Currently playing session item ID */
export const currentSessionItemId = writable<string | null>(null);

/** Playing / paused */
export const isPlaying = writable(false);

/** Current playback time (seconds) */
export const time = writable(0);

/** Track duration (seconds) */
export const duration = writable(0);

/** Session of session items (not tracks) */
export const session = writable<SessionItem[]>([]);

/** Crossfade duration in seconds */
export const crossfadeDuration = writable(3);

// Updated session management functions
export function addToSession(track: Track) {
  session.update(items => [...items, {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    track,
    addedAt: Date.now()
  }]);
}

export function removeFromSession(sessionItemId: string) {
  session.update(items => items.filter(item => item.id !== sessionItemId));
}

export function clearSession() {
  session.set([]);
  currentSessionItemId.set(null);
}