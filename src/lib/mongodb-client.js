// lib/mongodb-client.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/enso-audio';

// Validate MongoDB URI
if (!uri) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

// Configure MongoDB options for optimal serverless performance
const options = {
  useUnifiedTopology: true,
  connectTimeoutMS: 5000, // Reduced timeout for faster failure
  socketTimeoutMS: 30000, // Increased for long-running operations
  maxPoolSize: 10, // Limit connections in the pool
  serverSelectionTimeoutMS: 5000, // Faster server selection timeout
};

let client;
let clientPromise;

// Check if we're in development or production
if (process.env.NODE_ENV === 'development') {
  // In development, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect()
      .catch(err => {
        console.error('Failed to connect to MongoDB', err);
        throw err;
      });
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect()
    .catch(err => {
      console.error('Failed to connect to MongoDB', err);
      throw err;
    });
}

// Export the promise - client will attempt to connect when imported
export default clientPromise;