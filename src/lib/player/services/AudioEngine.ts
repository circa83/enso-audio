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
  private audioContext: AudioContext | null = null;
  private audioUnlocked = false;
  private unlockFunction: ((e: Event) => void) | null = null;
  
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
      // Create AudioContext first for iOS
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Try to unlock audio on iOS
      this.unlockAudioContext();
     
     
      // Initialize WaveSurfer
const options: any = {
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
  audioContext: this.audioContext
};
this.wavesurfer = WaveSurfer.create(options);  


      
      this.setupEventListeners();
    } catch (error) {
      console.error('AudioEngine - Error initializing WaveSurfer:', error);
    }
  }
  
  // This function attempts to unlock the AudioContext on iOS
  unlockAudioContext() {
    if (!this.audioContext || this.audioUnlocked) return;
    
    // Store the unlock function so we can remove it later
    this.unlockFunction = (e: Event) => {
      if (this.audioUnlocked) return;
      
      // Create an empty buffer and play it
      const buffer = this.audioContext!.createBuffer(1, 1, 22050);
      const source = this.audioContext!.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext!.destination);
      
      // Play the empty buffer
      if (source.start) {
        source.start(0);
      } else {
        (source as any).noteOn(0);
      }
      
      // Resume the audio context if it's suspended
      if (this.audioContext!.state === 'suspended') {
        this.audioContext!.resume();
      }
      
      this.audioUnlocked = true;
      console.log('AudioEngine - Audio context unlocked');
      
      // Remove the event listeners
      this.removeUnlockListeners();
    };
    
    // Add event listeners to unlock audio
    document.addEventListener('touchstart', this.unlockFunction, true);
    document.addEventListener('touchend', this.unlockFunction, true);
    document.addEventListener('click', this.unlockFunction, true);
  }
  
  // Helper to remove unlock listeners
  private removeUnlockListeners() {
    if (this.unlockFunction) {
      document.removeEventListener('touchstart', this.unlockFunction, true);
      document.removeEventListener('touchend', this.unlockFunction, true);
      document.removeEventListener('click', this.unlockFunction, true);
      this.unlockFunction = null;
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
      
      // Make sure URL is properly formatted
      let audioUrl = track.url;
      
      // Handle relative URLs properly
      if (!audioUrl.startsWith('http') && !audioUrl.startsWith('blob:')) {
        // Remove leading slash if it exists to avoid double slashes
        audioUrl = audioUrl.startsWith('/') ? audioUrl : `/${audioUrl}`;
        
        // Make sure we have the full URL
        if (typeof window !== 'undefined') {
          const baseUrl = window.location.origin;
          audioUrl = `${baseUrl}${audioUrl}`;
        }
      }
      
      console.log('AudioEngine - Final URL:', audioUrl);
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
    
    // Try to resume AudioContext first (important for iOS)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => {
        if (this.wavesurfer) {
          this.wavesurfer.play();
        }
      }).catch(err => {
        console.error('Failed to resume audio context:', err);
      });
    } else {
      this.wavesurfer.play();
    }
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
    
    // Clean up AudioContext
    if (this.audioContext) {
      // Close the AudioContext if it's not already closed
      if (this.audioContext.state !== 'closed') {
        try {
          this.audioContext.close();
          console.log('AudioEngine - AudioContext closed');
        } catch (error) {
          console.error('AudioEngine - Error closing AudioContext:', error);
        }
      }
      this.audioContext = null;
      this.audioUnlocked = false;
    }
    
    // Remove any lingering event listeners
    this.removeUnlockListeners();
    
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

  // Add this method to the AudioEngine class
  resumeAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      console.log('AudioEngine - Resuming suspended AudioContext');
      return this.audioContext.resume();
    }
    return Promise.resolve();
  }
}

export const audioEngine = new AudioEngine();