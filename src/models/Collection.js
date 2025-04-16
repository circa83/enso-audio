// src/models/Collection.js
import mongoose from 'mongoose';

const CollectionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  coverImage: {
    type: String,
    required: false,
  },
  metadata: {
    artist: { type: String },
    year: { type: Number },
    tags: [{ type: String }]
  },
  // Reference to tracks that belong to this collection
  tracks: [{
    type: String,  // Changed from ObjectId to String to match Track schema
    required: true
  }],
  // Timestamps for when the record was created/updated
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
CollectionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create a compound index for improved query performance
CollectionSchema.index({ name: 1, 'metadata.artist': 1 });

// Export both the model and schema
const Collection = mongoose.models.Collection || mongoose.model('Collection', CollectionSchema);

export default Collection;
export { CollectionSchema };