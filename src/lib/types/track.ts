export interface Track {
  id: string;
  src: string;  // Note: using 'src' not 'url' to match original
  title: string;
  artist?: string;
  artwork: string;
  duration?: number;
  
  // Enhanced metadata for library management
  metadata?: {
    genre?: string[];      // Multiple genres possible
    mood?: string[];       // Emotional qualities
    tags?: string[];       // Custom tags
    bpm?: number;          // Beats per minute
    key?: string;          // Musical key
    collection?: string;   // Collection/album name
    year?: number;         // Release year
    description?: string;  // Track description
    therapyType?: string[];// Therapy categories (meditation, breathwork, etc.)
  };
  
  // Search optimization
  searchableText?: string;   // Cached field for fast searching
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

// Type for filtering and categorization
export interface FilterOptions {
  genre?: string;
  mood?: string;
  therapyType?: string;
  collection?: string;
  minBpm?: number;
  maxBpm?: number;
  year?: number;
}

// Type for search results
export interface SearchResult {
  track: Track;
  score: number;  // Relevance score
  matches: string[]; // Which fields matched
}