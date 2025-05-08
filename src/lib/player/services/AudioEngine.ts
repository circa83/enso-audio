import WaveSurfer from 'wavesurfer.js';
import { writable, type Writable } from 'svelte/store';

// Simple type for internal use that works with both original and new track structures
interface AudioTrack {
  url: string;
  title: string;
  artwork?: string;
}

export class AudioEngine {
  private wavesurfer: WaveSurfer | null = null;
  
  // State stores
  public isPlaying: Writable<boolean> = writable(false);
  public currentTime: Writable<number> = writable(0);
  public duration: Writable<number> = writable(0);
  public isLoading: Writable<boolean> = writable(false);
  public error: Writable<string | null> = writable(null);
  
  initialize(container: HTMLElement): void {
    if (typeof window === 'undefined') return;
    
    if (this.wavesurfer) {
      this.destroy();
    }
    
    try {
      this.wavesurfer = WaveSurfer.create({
        container,
        waveColor: '#333333',
        progressColor: '#ffffff',
        cursorColor: '#ffffff',
        cursorWidth: 1,
        height: 48,
        normalize: true,
        backend: 'WebAudio',
        interact: true,
        barWidth: 1,
        barGap: 1,
      });
      
      this.setupEventListeners();
    } catch (error) {
      console.error('AudioEngine - Error initializing WaveSurfer:', error);
    }
  }
  
  async load(track: AudioTrack): Promise<void> {
    if (!this.wavesurfer || !track || !track.url) {
      console.error('AudioEngine - Invalid load parameters:', { wavesurfer: !!this.wavesurfer, track });
      return;
    }
    
    this.isLoading.set(true);
    this.error.set(null);
    
    try {
      console.log('AudioEngine - Loading track:', track.url);
      await this.wavesurfer.load(track.url);
    } catch (error) {
      console.error('AudioEngine - Error loading track:', error);
      this.error.set('Failed to load audio');
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }
  
  play(): void {
    if (!this.wavesurfer) return;
    this.wavesurfer.play();
  }
  
  pause(): void {
    if (!this.wavesurfer) return;
    this.wavesurfer.pause();
  }
  
  destroy(): void {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
      this.wavesurfer = null;
    }
    
    // Reset stores
    this.isPlaying.set(false);
    this.currentTime.set(0);
    this.duration.set(0);
    this.isLoading.set(false);
    this.error.set(null);
  }
  
  private setupEventListeners(): void {
    if (!this.wavesurfer) return;
    
    this.wavesurfer.on('ready', () => {
      this.duration.set(this.wavesurfer!.getDuration());
    });
    
    this.wavesurfer.on('audioprocess', () => {
      this.currentTime.set(this.wavesurfer!.getCurrentTime());
    });
    
    this.wavesurfer.on('play', () => {
      this.isPlaying.set(true);
    });
    
    this.wavesurfer.on('pause', () => {
      this.isPlaying.set(false);
    });
    
    this.wavesurfer.on('error', (error) => {
      console.error('AudioEngine - WaveSurfer error:', error);
      this.error.set('Audio playback error');
    });
  }
}

export const audioEngine = new AudioEngine();