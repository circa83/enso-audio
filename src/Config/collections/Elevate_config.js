/**
 * Elevate Configuration
 * 
 * Audio configuration for Elevate collection
 * Created: 4/30/2025, 07:03:24 AM
 */

const ElevateConfig = {
  "name": "Elevate",
  "description": "Audio configuration for Elevate collection",
  "sessionDuration": 60000,
  "transitionDuration": 4000,
  "volumes": {
    "Layer 1": 0,
    "Layer 2": 0,
    "Layer 3": 0.17,
    "Layer 4": 0
  },
  "activeAudio": {
    "Layer 1": "layer_1",
    "Layer 2": "layer_2",
    "Layer 3": "layer_3",
    "Layer 4": "layer_4"
  },
  "phaseMarkers": [
    {
      "id": "pre-onset",
      "name": "Pre-Onset",
      "position": 0,
      "color": "#4A6670",
      "state": {
        "volumes": {
          "Layer 1": 0,
          "Layer 2": 0,
          "Layer 3": 0,
          "Layer 4": 0.18
        },
        "activeAudio": {
          "Layer 1": "layer_1",
          "Layer 2": "layer_2",
          "Layer 3": "layer_3",
          "Layer 4": "layer_4"
        }
      },
      "locked": true
    },
    {
      "id": "onset",
      "name": "Onset & Buildup",
      "position": 20,
      "color": "#6E7A8A",
      "state": {
        "volumes": {
          "Layer 1": 0,
          "Layer 2": 0,
          "Layer 3": 0.17,
          "Layer 4": 0
        },
        "activeAudio": {
          "Layer 1": "layer_1",
          "Layer 2": "layer_2",
          "Layer 3": "layer_3",
          "Layer 4": "layer_4"
        }
      },
      "locked": false
    },
    {
      "id": "peak",
      "name": "Peak",
      "position": 40,
      "color": "#8A8A8A",
      "state": {
        "volumes": {
          "Layer 1": 0,
          "Layer 2": 0.22,
          "Layer 3": 0,
          "Layer 4": 0
        },
        "activeAudio": {
          "Layer 1": "layer_1",
          "Layer 2": "layer_2",
          "Layer 3": "layer_3",
          "Layer 4": "layer_4"
        }
      },
      "locked": false
    },
    {
      "id": "return",
      "name": "Return & Integration",
      "position": 60,
      "color": "#A98467",
      "state": {
        "volumes": {
          "Layer 1": 0.21,
          "Layer 2": 0.22,
          "Layer 3": 0,
          "Layer 4": 0
        },
        "activeAudio": {
          "Layer 1": "layer_1",
          "Layer 2": "layer_2-2025",
          "Layer 3": "layer_3",
          "Layer 4": "layer_4"
        }
      },
      "locked": false
    }
  ]
};

export default ElevateConfig;