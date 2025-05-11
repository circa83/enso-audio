// src/lib/player/services/AudioUnlocker.ts

export class AudioUnlocker {
  private audioContext: AudioContext | null = null;
  private audioUnlocked = false;
  private unlockFunction: ((e: Event) => void) | null = null;
  
  constructor(audioContext: AudioContext | null) {
    this.audioContext = audioContext;
  }
  
  setupUnlocking(): void {
    if (!this.audioContext || this.audioUnlocked) return;
    
    this.unlockFunction = (e: Event) => {
      if (this.audioUnlocked || !this.audioContext) return;
      
      console.log('AudioUnlocker - Attempting to unlock audio context');
      
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
      this.removeListeners();
      
      console.log('AudioUnlocker - Audio context unlocked');
    };
    
    // Add listeners for mobile audio unlocking
    ['touchstart', 'touchend', 'click'].forEach(event => {
      document.addEventListener(event, this.unlockFunction!, true);
    });
  }
  
  removeListeners(): void {
    if (this.unlockFunction) {
      ['touchstart', 'touchend', 'click'].forEach(event => {
        document.removeEventListener(event, this.unlockFunction!, true);
      });
      this.unlockFunction = null;
    }
  }
  
  destroy(): void {
    this.removeListeners();
    this.audioUnlocked = false;
    this.audioContext = null;
  }
  
  isUnlocked(): boolean {
    return this.audioUnlocked;
  }
  
  setAudioContext(audioContext: AudioContext | null): void {
    this.audioContext = audioContext;
    this.audioUnlocked = false;
  }
}