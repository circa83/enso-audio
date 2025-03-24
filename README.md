# Ensō Audio

A therapeutic sound platform for guided sessions with real-time audio layer control.

## Overview

Ensō Audio is a Next.js web application designed for therapists conducting therapeutic sessions. The platform allows real-time control of multiple audio layers (drones, melody, rhythm, nature) to create customized soundscapes during therapy sessions, with a dark minimalist UI optimized for low-distraction therapeutic environments.

## Current Features

- **Multi-layered Audio Engine**: Independent control of four distinct sound layers (drones, melody, rhythm, nature)
- **Real-time Volume Control**: Adjust volume levels of each layer during sessions
- **Session Timer**: Track therapy session duration
- **Dark Minimalist UI**: Low-distraction interface optimized for therapeutic settings
- **Sound Library**: Select different audio samples for each layer
- **Responsive Design**: Works on both desktop and mobile devices
- **Session Flow Guide**: Recommendations for audio balance during different phases

## Technical Stack

- **Framework**: Next.js 15.x
- **Audio Engine**: Web Audio API
- **State Management**: React Context API
- **Styling**: CSS Modules
- **UI Components**: Custom React components

## Project Structure

Key components and files:

- `src/contexts/StreamingAudioContext.js` - Core audio management system
- `src/components/Player.js` - Main interface for controlling audio layers
- `src/components/Library.js` - Interface for selecting different audio samples
- `src/components/LoadingScreen.js` - Manages audio initialization
- `src/components/audio/LayerControl.js` - Volume adjustment for each audio layer
- `src/components/audio/SessionTimer.js` - Tracks therapy duration
- `src/components/audio/TapePlayerGraphic.js` - Visual reel-to-reel element
- `src/pages/_app.js` - Main app entry point

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/enso-audio.git
cd enso-audio
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Start the development server
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Development Status

The application is currently in Phase 1 of development with the following core functionality implemented:

- Basic audio playback engine
- Multi-layer volume control
- Session timing
- Dark, minimal UI
- Library interface for audio sample selection

## Next Development Focus

- **Audio Crossfading**: Implement seamless transitions between audio files within the same layer
- **Buffer Preloading**: Create a preloading system for upcoming audio transitions
- **Gain Smoothing**: Develop algorithms for natural-sounding transitions
- **Session Timeline**: Design UI component for tracking session phases

## File Structure

```
enso-audio/
├── public/
│   ├── images/
│   └── samples/         # Audio samples
├── src/
│   ├── components/      # React components
│   │   ├── audio/       # Audio-specific components
│   │   └── layout/      # Layout components
│   ├── contexts/        # React context providers
│   ├── pages/           # Next.js pages
│   │   ├── _app.js      # Main app component
│   │   ├── _document.js # Document customization
│   │   └── index.js     # Home page
│   ├── styles/          # CSS modules
│   └── utils/           # Utility functions
├── next.config.js       # Next.js configuration
└── package.json         # Project dependencies
```

## License

[Private] - © 2025 circa83 / Ensō Audio

## Contact

For more information, contact hello@enso-audio.com

---

**Note**: This is a work in progress. Additional features and improvements are planned for future releases.