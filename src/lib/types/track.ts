export interface Track {
    id: string;
    title: string;
    artist?: string;
    album?: string;
    src: string;
    artwork: string;
    duration?: number;
  }