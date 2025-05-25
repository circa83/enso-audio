// src/lib/player/services/WebAudioEngine.ts
import { writable, get, type Writable } from 'svelte/store';

// EXACTLY match existing AudioTrack interface - no name changes
export interface AudioTrack {
  url: string;
  title: string;
  artwork?: string;
  duration?: number;
  peaksUrl?: string;
}

// Audio state interface - matches existing
export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  error: string | null;
}

export class WebAudioEngine {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private isInitialized: boolean = false;
  private animationFrameId: number | null = null;
  private finishCallback: (() => void) | null = null;
  
  // State stores - EXACTLY match existing AudioEngine
  public isPlaying: Writable<boolean> = writable(false);
  public currentTime: Writable<number> = writable(0);
  public duration: Writable<number> = writable(0);
  public isLoading: Writable<boolean> = writable(false);
  public error: Writable<string | null> = writable(null);
  public volume: Writable<number> = writable(1);
  
  constructor() {
    console.log('WebAudioEngine - Constructor called');
  }
  
  // EXACTLY match existing signature: initialize(container: HTMLElement): void
  initialize(container: HTMLElement): void {
    if (typeof window === 'undefined') {
      console.log('WebAudioEngine - Cannot initialize: no window object (SSR)');
      return;
    }
    
    console.log('WebAudioEngine - initialize() called with container:', container);
    
    try {
      // Check if Web Audio API is supported
      if (!window.AudioContext && !(window as any).webkitAudioContext) {
        throw new Error('Web Audio API not supported in this browser');
      }
      
      // Create AudioContext
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('WebAudioEngine - AudioContext created, state:', this.audioContext.state);
      
      // Create gain node for volume and fade control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.gain.value = 1;
      console.log('WebAudioEngine - GainNode created and connected');
      
      this.isInitialized = true;
      console.log('WebAudioEngine - Initialized successfully');
      
    } catch (error) {
      console.error('WebAudioEngine - Error initializing:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.error.set(`Failed to initialize Web Audio API: ${errorMessage}`);
      this.isInitialized = false;
    }
  }
  
  // EXACTLY match existing signature: load(track: AudioTrack, autoPlay?: boolean): Promise<void>
  async load(track: AudioTrack, autoPlay: boolean = false): Promise<void> {
    console.log('WebAudioEngine - load() called for track:', track.title);
    console.log('WebAudioEngine - isInitialized:', this.isInitialized);
    console.log('WebAudioEngine - audioContext exists:', !!this.audioContext);
    
    if (!this.isInitialized) {
      const errorMsg = 'WebAudioEngine not initialized - call initialize() first';
      console.error('WebAudioEngine - ' + errorMsg);
      this.error.set(errorMsg);
      return;
    }
    
    if (!this.audioContext) {
      const errorMsg = 'AudioContext not available';
      console.error('WebAudioEngine - ' + errorMsg);
      this.error.set(errorMsg);
      return;
    }
    
    this.isLoading.set(true);
    this.error.set(null);
    
    // Reset playback state
    this.stop();
    this.currentTime.set(0);
    this.pauseTime = 0;
    
    try {
      // Handle relative URLs properly - EXACTLY like existing AudioEngine
      let audioUrl = track.url;
      if (!audioUrl.startsWith('http') && !audioUrl.startsWith('blob:')) {
        audioUrl = audioUrl.startsWith('/') ? audioUrl : `/${audioUrl}`;
        
        if (typeof window !== 'undefined') {
          audioUrl = `${window.location.origin}${audioUrl}`;
        }
      }
      
      console.log('WebAudioEngine - Loading track:', track.title, 'autoPlay:', autoPlay);
      console.log('WebAudioEngine - Loading audio with URL:', audioUrl);
      
      // Fetch audio data
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Decode audio data
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Set duration
      this.duration.set(this.audioBuffer.duration);
      
      console.log('WebAudioEngine - Track loaded successfully, duration:', this.audioBuffer.duration);
      
      // Auto-play if requested - EXACTLY like existing AudioEngine
      if (autoPlay) {
        console.log('WebAudioEngine - Auto-playing track after load');
        this.play();
      }
      
    } catch (error) {
      console.error('WebAudioEngine - Error loading track:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.error.set(`Failed to load audio track: ${errorMessage}`);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }
  
  // EXACTLY match existing signature: play(): void (synchronous, not async)
  play(): void {
    console.log('WebAudioEngine - play() called');
    console.log('WebAudioEngine - Dependencies check:');
    console.log('- audioContext:', !!this.audioContext, this.audioContext?.state);
    console.log('- audioBuffer:', !!this.audioBuffer, this.audioBuffer?.duration);
    console.log('- gainNode:', !!this.gainNode);
    console.log('- isInitialized:', this.isInitialized);
    
    if (!this.audioContext || !this.audioBuffer || !this.gainNode) {
      console.error('WebAudioEngine - Cannot play: missing dependencies');
      console.error('- audioContext missing:', !this.audioContext);
      console.error('- audioBuffer missing:', !this.audioBuffer);
      console.error('- gainNode missing:', !this.gainNode);
      this.error.set('Audio engine not properly initialized');
      return;
    }
    
    // Handle suspended AudioContext (mobile requirement) - but don't await
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => {
        this.startPlayback();
      }).catch(err => {
        console.error('WebAudioEngine - Failed to resume audio context:', err);
        this.error.set('Failed to play audio');
      });
    } else {
      this.startPlayback();
    }
  }
  
  private startPlayback(): void {
    if (!this.audioContext || !this.audioBuffer || !this.gainNode) return;
    
    // Stop any existing playback
    this.stop();
    
    // Create new source node
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.gainNode);
    
    // Set up finish callback
    this.sourceNode.onended = () => {
      console.log('WebAudioEngine - Track finished naturally');
      this.isPlaying.set(false);
      this.stopProgressTracking();
      if (this.finishCallback) {
        this.finishCallback();
      }
    };
    
    // Apply fade-in
    this.fadeIn();
    
    // Start playback from pause position
    const startOffset = this.pauseTime;
    this.sourceNode.start(0, startOffset);
    this.startTime = this.audioContext.currentTime - startOffset;
    
    this.isPlaying.set(true);
    this.startProgressTracking();
    
    console.log('WebAudioEngine - Playback started with fade-in, offset:', startOffset);
  }
  
  // EXACTLY match existing signature: pause(): void (synchronous, not async)
  pause(): void {
    if (!this.audioContext || !this.sourceNode) {
      console.log('WebAudioEngine - Cannot pause: no active playback');
      return;
    }
    
    console.log('WebAudioEngine - pause() called');
    
    // Apply fade-out before stopping (but don't await - make it non-blocking)
    this.fadeOut().then(() => {
      // Calculate current position for resume
      if (this.audioContext) {
        this.pauseTime = this.audioContext.currentTime - this.startTime;
      }
      
      // Stop the source
      this.stop();
      
      console.log('WebAudioEngine - Paused at position:', this.pauseTime);
    });
  }
  
  // EXACTLY match existing signature: seek(position: number): void (synchronous, not async)
  seek(position: number): void {
    if (!this.audioBuffer) {
      console.log('WebAudioEngine - Cannot seek: no audio loaded');
      return;
    }
    
    console.log('WebAudioEngine - seek() called, position:', position);
    
    const wasPlaying = get(this.isPlaying);
    
    // Update pause time to seek position
    this.pauseTime = position;
    this.currentTime.set(position);
    
    if (wasPlaying) {
      // Quick fade and restart playback
      this.fadeOut(50).then(() => {
        this.stop();
        this.startPlayback();
      });
    }
    
    console.log('WebAudioEngine - Seek completed to:', position);
  }
  
  // EXACTLY match existing signature
  setVolume(level: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = level;
      this.volume.set(level);
      console.log('WebAudioEngine - Volume set to:', level);
    }
  }
  
  // EXACTLY match existing signature
  destroy(): void {
    console.log('WebAudioEngine - destroy() called');
    
    this.stop();
    
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }
    
    this.audioBuffer = null;
    this.isInitialized = false;
    
    // Reset all stores
    this.isPlaying.set(false);
    this.currentTime.set(0);
    this.duration.set(0);
    this.isLoading.set(false);
    this.error.set(null);
    this.volume.set(1);
  }
  
  // EXACTLY match existing signature - CRITICAL: This method was missing!
  resumeAudioContext(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      console.log('WebAudioEngine - resumeAudioContext() called');
      return this.audioContext.resume();
    }
    return Promise.resolve();
  }
  
  // EXACTLY match existing signature
  onFinish(callback: () => void): void {
    this.finishCallback = callback;
  }
  
  private stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (error) {
        // Source might already be stopped
      }
      this.sourceNode = null;
    }
    
    this.isPlaying.set(false);
    this.stopProgressTracking();
  }
  
  // Perfect exponential fade-in using Web Audio API
  private async fadeIn(duration: number = 100): Promise<void> {
    if (!this.gainNode || !this.audioContext) return;
    
    console.log('WebAudioEngine - fadeIn starting, duration:', duration);
    
    const currentTime = this.audioContext.currentTime;
    const fadeDuration = duration / 1000; // Convert to seconds
    
    // Set initial volume to near-zero (can't use 0 with exponentialRampToValueAtTime)
    this.gainNode.gain.setValueAtTime(0.001, currentTime);
    
    // Exponential ramp to full volume - this is hardware-smooth!
    this.gainNode.gain.exponentialRampToValueAtTime(1, currentTime + fadeDuration);
    
    // Wait for fade to complete
    return new Promise(resolve => {
      setTimeout(() => {
        console.log('WebAudioEngine - fadeIn completed');
        resolve();
      }, duration);
    });
  }
  
  // Perfect exponential fade-out using Web Audio API
  private async fadeOut(duration: number = 100): Promise<void> {
    if (!this.gainNode || !this.audioContext) return;
    
    console.log('WebAudioEngine - fadeOut starting, duration:', duration);
    
    const currentTime = this.audioContext.currentTime;
    const fadeDuration = duration / 1000; // Convert to seconds
    
    // Start from current volume
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, currentTime);
    
    // Exponential ramp to near-zero - hardware-smooth!
    this.gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + fadeDuration);
    
    // Wait for fade to complete
    return new Promise(resolve => {
      setTimeout(() => {
        console.log('WebAudioEngine - fadeOut completed');
        resolve();
      }, duration);
    });
  }
  
  // Progress tracking using requestAnimationFrame
  private startProgressTracking(): void {
    if (!this.audioContext) return;
    
    const updateProgress = () => {
      if (get(this.isPlaying) && this.audioContext) {
        const currentTime = this.audioContext.currentTime - this.startTime;
        this.currentTime.set(Math.max(0, currentTime));
        
        // Continue tracking
        this.animationFrameId = requestAnimationFrame(updateProgress);
      }
    };
    
    this.animationFrameId = requestAnimationFrame(updateProgress);
  }
  
  private stopProgressTracking(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}

// Export singleton instance
export const webAudioEngine = new WebAudioEngine();