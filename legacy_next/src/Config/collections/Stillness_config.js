/**
 * Stillness Configuration
 * 
 * Audio configuration for Stillness collection
 * Created: 4/29/2025, 10:48:40 AM
 */

const StillnessConfig = {
  "name": "Stillness",
  "description": "Audio configuration for Stillness collection",
  "sessionDuration": 60000,
  "transitionDuration": 5000,
  "volumes": {
    "Layer 1": 0,
    "Layer 2": 0,
    "Layer 3": 0,
    "Layer 4": 0.17
  },
  "activeAudio": {
    "Layer 1": "layer_1-01",
    "Layer 2": "layer_2-01",
    "Layer 3": "layer_3-01",
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
          "Layer 1": 0.25,
          "Layer 2": 0.15,
          "Layer 3": 0.09,
          "Layer 4": 0
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
          "Layer 1": 0.05,
          "Layer 2": 0.21,
          "Layer 3": 0.14,
          "Layer 4": 0
        },
        "activeAudio": {
          "Layer 1": "layer_1",
          "Layer 2": "layer_2-01",
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
          "Layer 1": 0.05,
          "Layer 2": 0.08,
          "Layer 3": 0.23,
          "Layer 4": 0
        },
        "activeAudio": {
          "Layer 1": "layer_1-01",
          "Layer 2": "layer_2-01",
          "Layer 3": "layer_3-01",
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
          "Layer 1": 0,
          "Layer 2": 0,
          "Layer 3": 0,
          "Layer 4": 0.17
        },
        "activeAudio": {
          "Layer 1": "layer_1-01",
          "Layer 2": "layer_2-01",
          "Layer 3": "layer_3-01",
          "Layer 4": "layer_4"
        }
      },
      "locked": false
    }
  ]
};

export default StillnessConfig;