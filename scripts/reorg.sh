# Create new directories as needed
mkdir -p src/components/player
mkdir -p src/components/library
mkdir -p src/components/loading
mkdir -p src/services/storage
mkdir -p src/styles/globals
mkdir -p src/styles/components
mkdir -p src/styles/pages
mkdir -p src/hooks

# Move components
mv src/components/Player.js src/components/player/Player.js
mv src/components/Library.js src/components/library/Library.js
mv src/components/TapePlayerGraphic.js src/components/player/TapePlayerGraphic.js
mv src/components/loading/LoadingScreen.js src/components/loading/LoadingScreen.js

# Move services
mv src/services/audio/PresetManager.js src/services/storage/PresetManager.js

# Rename context file
mv src/contexts/StreamingAudioContext.js src/contexts/AudioContext.js

# Move styles
mv src/styles/App.css src/styles/globals/App.css
mv src/styles/globals.css src/styles/globals/globals.css
mv src/styles/index.css src/styles/globals/index.css
mv src/SimplePlayerDark.css src/styles/components/SimplePlayer.css

# Move pages
mv src/pages/login.js src/pages/auth/login.js
mv src/pages/register.js src/pages/auth/register.js

# (Optional) Example for page that might not exist
mkdir -p src/pages/dashboard
mv src/pages/dashboard/library.js src/pages/dashboard/library.js 2>/dev/null || true
