// src/lib/types/session.ts (new file)
import type { Track } from './track';

export interface SessionItem {
  id: string;        // Unique session item ID
  track: Track;      // Original track data
  addedAt: number;   // Timestamp when added
}