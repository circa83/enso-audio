import WaveSurfer from 'wavesurfer.js';
import { writable, type Writable } from 'svelte/store';

// Interface for tracks used by AudioEngine
export interface AudioTrack {
  url: string;
  title: string;
  artwork?: string;
  duration?: number;
  peaksUrl?: string;
}

// Audio state interface
export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  error: string | null;
}

export class AudioEngine {
  private wavesurfer: WaveSurfer | null = null;
  private audioContext: AudioContext | null = null;
  private audioUnlocked = false;
  private unlockFunction: ((e: Event) => void) | null = null;
  
  // State stores
  public isPlaying: Writable<boolean> = writable(false);
  public currentTime: Writable<number> = writable(0);
  public duration: Writable<number> = writable(0);
  public isLoading: Writable<boolean> = writable(false);
  public error: Writable<string | null> = writable(null);
  public volume: Writable<number> = writable(1);
  
  initialize(container: HTMLElement): void {
    if (typeof window === 'undefined') return;
    
    if (this.wavesurfer) {
      this.destroy();
    }
    
    try {
      // Detect iOS device
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      console.log('AudioEngine - Initializing. iOS detected:', isIOS);
      
      // Base WaveSurfer options
      const options: any = {
        container,
        waveColor: '#333333',
        progressColor: '#ffffff',
        cursorColor: '#ffffff',
        cursorWidth: 1,
        height: 48,
        normalize: true,
        backend: isIOS ? 'MediaElement' : 'WebAudio', // Use MediaElement for iOS
        interact: true,
        barWidth: 1,
        barGap: 1
      };
      
      // Only create AudioContext for WebAudio backend (non-iOS devices)
      if (!isIOS) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        options.audioContext = this.audioContext;
        // Setup audio unlocking for non-iOS devices
        this.setupAudioUnlocking();
      }
      
      this.wavesurfer = WaveSurfer.create(options);
      this.setupEventListeners();
    } catch (error) {
      console.error('AudioEngine - Error initializing:', error);
      this.error.set('Failed to initialize audio engine');
    }
  }
  
  async load(track: AudioTrack): Promise<void> {
    if (!this.wavesurfer || !track?.url) {
      this.error.set('Invalid audio parameters');
      return;
    }
    
    this.isLoading.set(true);
    this.error.set(null);
    
    try {
      // Handle relative URLs properly
      let audioUrl = track.url;
      if (!audioUrl.startsWith('http') && !audioUrl.startsWith('blob:')) {
        audioUrl = audioUrl.startsWith('/') ? audioUrl : `/${audioUrl}`;
        
        if (typeof window !== 'undefined') {
          audioUrl = `${window.location.origin}${audioUrl}`;
        }
      }
      
      await this.wavesurfer.load(audioUrl);
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
    
    // Handle suspended AudioContext (only for WebAudio backend)
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().then(() => {
        this.wavesurfer?.play();
      }).catch(err => {
        console.error('AudioEngine - Failed to resume audio context:', err);
        this.error.set('Failed to play audio');
      });
    } else {
      this.wavesurfer.play();
    }
  }
  
  pause(): void {
    this.wavesurfer?.pause();
  }
  
  seek(position: number): void {
    if (this.wavesurfer && this.wavesurfer.getDuration() > 0) {
      this.wavesurfer.seekTo(position);
    }
  }
  
  setVolume(level: number): void {
    if (this.wavesurfer) {
      this.wavesurfer.setVolume(level);
      this.volume.set(level);
    }
  }
  
  destroy(): void {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
      this.wavesurfer = null;
    }
    
    if (this.audioContext?.state !== 'closed') {
      this.audioContext?.close().catch(console.error);
      this.audioContext = null;
    }
    
    this.removeUnlockListeners();
    this.audioUnlocked = false;
    
    // Reset all stores
    this.isPlaying.set(false);
    this.currentTime.set(0);
    this.duration.set(0);
    this.isLoading.set(false);
    this.error.set(null);
    this.volume.set(1);
  }
  
  resumeAudioContext(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      return this.audioContext.resume();
    }
    return Promise.resolve();
  }
  
  private setupAudioUnlocking(): void {
    if (!this.audioContext || this.audioUnlocked) return;
    
    this.unlockFunction = (e: Event) => {
      if (this.audioUnlocked || !this.audioContext) return;
      
      // Create and play silent buffer to unlock audio
      const buffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
      
      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      
      this.audioUnlocked = true;
      this.removeUnlockListeners();
    };
    
    // Add listeners for mobile audio unlocking
    ['touchstart', 'touchend', 'click'].forEach(event => {
      document.addEventListener(event, this.unlockFunction!, true);
    });
  }
  
  private removeUnlockListeners(): void {
    if (this.unlockFunction) {
      ['touchstart', 'touchend', 'click'].forEach(event => {
        document.removeEventListener(event, this.unlockFunction!, true);
      });
      this.unlockFunction = null;
    }
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
      console.error('AudioEngine - Playback error:', error);
      this.error.set('Audio playback error');
    });
    
    this.wavesurfer.on('finish', () => {
      this.isPlaying.set(false);
    });
  }
}

export const audioEngine = new AudioEngine();