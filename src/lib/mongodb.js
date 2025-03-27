// lib/mongodb.js
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/enso-audio';

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable'
  );
}

// Mongoose connection options optimized for serverless
const options = {
  connectTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  serverSelectionTimeoutMS: 5000,
  bufferCommands: false, // Disable command buffering
  maxPoolSize: 10,
  minPoolSize: 1, // Ensure at least one connection is maintained
};

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    // Return cached connection
    return cached.conn;
  }

  if (!cached.promise) {
    // Log connection attempt
    console.log(`Connecting to MongoDB at ${new Date().toISOString()}`);
    
    // Set up Mongoose connection with explicit promise
    mongoose.set('strictQuery', false); // Prepare for Mongoose 7
    
    cached.promise = mongoose.connect(MONGODB_URI, options)
      .then((mongoose) => {
        console.log(`MongoDB connected successfully at ${new Date().toISOString()}`);
        return mongoose;
      })
      .catch((error) => {
        console.error('MongoDB connection error:', error);
        cached.promise = null; // Reset promise on error
        throw error; // Rethrow so the API route can handle it
      });
  }
  
  try {
    // Wait for the connection
    cached.conn = await cached.promise;
  } catch (error) {
    // Reset promise on error
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

export default dbConnect;