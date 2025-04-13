export interface Collection {
  id: string;
  name: string;
  description: string;
  coverImage?: string;
  tracks: {
    id: string;
    title: string;
    duration: number;
    audioUrl: string;
    coverImage?: string;
  }[];
  metadata?: {
    artist?: string;
    year?: number;
    tags?: string[];
  };
} 