// src/lib/player/services/SessionManager.ts
import { get } from 'svelte/store';
import { current, currentSessionItemId, session } from '../store';
import type { Track } from '$lib/types/track';
import type { SessionItem } from '$lib/types/session';

export class SessionManager {
  private currentIndex: number = -1;
  private autoPlayNext: boolean = false;

  constructor() {
    console.log('SessionManager - Initialized');
    
    // Subscribe to currentSessionItemId changes to update index
    currentSessionItemId.subscribe(itemId => {
      if (itemId) {
        this.updateCurrentIndex(itemId);
      }
    });
  }

  private updateCurrentIndex(sessionItemId: string): void {
    const currentSession = get(session);
    this.currentIndex = currentSession.findIndex(item => item.id === sessionItemId);
    console.log('SessionManager - Updated current index:', this.currentIndex);
  }

  /**
   * Get the next track in the session
   * Returns null if there's no next track
   */
  getNextTrack(): Track | null {
    console.log('SessionManager - getNextTrack');
    const currentSession = get(session);
    
    if (currentSession.length === 0) {
      console.log('SessionManager - No tracks in session');
      return null;
    }

    // If current track is in session and not the last one
    if (this.currentIndex >= 0 && this.currentIndex < currentSession.length - 1) {
      const nextItem = currentSession[this.currentIndex + 1];
      console.log('SessionManager - Next track:', nextItem.track.title);
      // Set the session item ID when returning next track
      currentSessionItemId.set(nextItem.id);
      return nextItem.track;
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