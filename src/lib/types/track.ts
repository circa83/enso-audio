export interface Track {
  id: string;
  src: string;  // Note: using 'src' not 'url' to match original
  title: string;
  artist?: string;
  artwork: string;
  duration?: number;
}