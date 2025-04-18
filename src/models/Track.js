// src/models/Track.js
import mongoose from 'mongoose';

// Schema for track variations
const VariationSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  audioUrl: {
    type: String,
    required: true,
  }
}, { _id: false }); // No separate _id for embedded documents

const TrackSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  audioUrl: {
    type: String,
    required: true,
  },
  // Reference to the collection this track belongs to
  collectionId: {
    type: String,  // Changed from ObjectId to String to match Collection schema
    required: true,
    index: true,
  },
  // Layer folder (e.g., 'Layer_1', 'Layer_2', 'Layer_3', 'Layer_4')
  layerFolder: {
    type: String,
    enum: ['Layer_1', 'Layer_2', 'Layer_3', 'Layer_4'],
    required: true,
  },
  // Track variations
  variations: [VariationSchema],
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

// Update the 'updatedAt' field on save
TrackSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create compound indexes for frequent query patterns
TrackSchema.index({ collectionId: 1, layerFolder: 1 });
TrackSchema.index({ id: 1, collectionId: 1 }, { unique: true });

// Export both the model and schema
const Track = mongoose.models.Track || mongoose.model('Track', TrackSchema);

export default Track;
export { TrackSchema };