// src/lib/player/services/SessionManager.ts
import { get } from 'svelte/store';
import { current, session } from '../store';
import type { Track } from '$lib/types/track';

export class SessionManager {
  private currentIndex: number = -1;
  private autoPlayNext: boolean = false;

  constructor() {
    console.log('SessionManager - Initialized');
    
    // Subscribe to current track changes to update index
    current.subscribe(track => {
      if (track) {
        this.updateCurrentIndex(track);
      }
    });
  }

  private updateCurrentIndex(track: Track): void {
    const currentSession = get(session);
    this.currentIndex = currentSession.findIndex(t => t.id === track.id);
    console.log('SessionManager - Updated current index:', this.currentIndex);
  }

  /**
   * Get the next track in the session
   * Returns null if there's no next track
   */
  getNextTrack(): Track | null {
    console.log('SessionManager - getNextTrack');
    const currentSession = get(session);
    const currentTrack = get(current);
    
    if (currentSession.length === 0) {
      console.log('SessionManager - No tracks in session');
      return null;
    }

    // If current track is in session and not the last one
    if (this.currentIndex >= 0 && this.currentIndex < currentSession.length - 1) {
      const nextTrack = currentSession[this.currentIndex + 1];
      console.log('SessionManager - Next track:', nextTrack.title);
      return nextTrack;
    }
    
    // If we're at the end of the session, don't loop back
    if (this.currentIndex >= currentSession.length - 1) {
      console.log('SessionManager - End of session reached');
      return null;
    }
    
    console.log('SessionManager - No next track available');
    return null;
  }

  /**
   * Play the next track in the session
   */
  playNext(): void {
    const nextTrack = this.getNextTrack();
    if (nextTrack) {
      console.log('SessionManager - Playing next track:', nextTrack.title);
      this.autoPlayNext = true;
      current.set(nextTrack);
    }
  }

  /**
   * Check if auto-play is requested
   */
  shouldAutoPlay(): boolean {
    const shouldPlay = this.autoPlayNext;
    this.autoPlayNext = false; // Reset after checking
    return shouldPlay;
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();