// src/lib/player/services/checkWaveSurferFade.ts
import WaveSurfer from 'wavesurfer.js';

/**
 * Check if WaveSurfer supports fade options and log version info
 * 
 * Usage:
 * import { checkWaveSurferFade } from './checkWaveSurferFade';
 * checkWaveSurferFade();
 */
export function checkWaveSurferFade(): void {
  console.log('WaveSurfer version check:');
  
  // Check the webpack/package version if available
  try {
    // @ts-ignore - VERSION property might not exist
    console.log('WaveSurfer reported version:', WaveSurfer.VERSION || 'Not available');
  } catch (e) {
    console.log('Could not determine WaveSurfer version directly');
  }
  
  // Create a temporary container
  const tempContainer = document.createElement('div');
  document.body.appendChild(tempContainer);
  
  try {
    // Let's look at all available default options in WaveSurfer
    const wavesurfer = WaveSurfer.create({
      container: tempContainer
    });
    
    console.log('WaveSurfer instance created with default options');
    
    // Try to inspect all available options
    console.log('Inspecting WaveSurfer instance for fade-related options:');
    console.log(wavesurfer);
    
    // Clean up the first instance
    wavesurfer.destroy();
    
    // Try creating again with known options as part of a general config object
    // This avoids TypeScript errors by using a type assertion
    const config: any = {
      container: tempContainer,
      // Try various names that might be used for fade options
      fadein: 150,
      fadeIn: 150,
      fade: 150,
      fadeout: 150,
      fadeOut: 150,
      
      // Version 7 may have renamed these options, try plausible alternatives
      fadeInDuration: 150,
      fadeOutDuration: 150,
      
      // Or they might be nested under a plugins object
      plugins: {
        fadein: 150,
        fadeout: 150
      }
    };
    
    console.log('Trying to create WaveSurfer with these options:', config);
    const ws2 = WaveSurfer.create(config);
    
    // Check if any errors appear in the console
    console.log('WaveSurfer created with extra options - checking for warnings or errors above');
    
    // Based on the WaveSurfer.js v7 release notes and docs, there might be a fade plugin
    console.log('Checking for any fade-specific methods:');
    // @ts-ignore - Looking for possibly undefined methods
    if (typeof ws2.fade === 'function') {
      console.log('Found ws2.fade() method');
    }
    // @ts-ignore
    if (typeof ws2.fadeIn === 'function') {
      console.log('Found ws2.fadeIn() method');
    }
    // @ts-ignore
    if (typeof ws2.fadeOut === 'function') {
      console.log('Found ws2.fadeOut() method');
    }
    
    // Let's also directly try setting the volume to test if that has a fade option
    console.log('Testing volume methods which might support fading:');
    try {
      // @ts-ignore - setVolume might have options
      ws2.setVolume(0.5, { fadeDuration: 150 });
      console.log('setVolume with fadeDuration parameter accepted');
    } catch (e) {
      console.log('setVolume does not accept fadeDuration parameter');
    }
    
    // Clean up the second instance
    ws2.destroy();
  } catch (error) {
    console.error('Error during WaveSurfer fade diagnostics:', error);
  } finally {
    // Remove the temp container
    if (tempContainer.parentNode) {
      document.body.removeChild(tempContainer);
    }
  }
  
  console.log('WaveSurfer diagnostic complete');
  console.log('Check WaveSurfer documentation for version 7.9.5 for fade options:');
  console.log('https://wavesurfer-js.org/docs/');
}