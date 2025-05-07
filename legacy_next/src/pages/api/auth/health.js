// pages/api/auth/health.js
import dbConnect from '../../../lib/mongodb';

export default async function handler(req, res) {
  // Only GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  
  try {
    // Check MongoDB connection
    const startTime = Date.now();
    
    // Set a reasonable timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('MongoDB connection timeout')), 5000);
    });
    
    // Try to connect with timeout
    await Promise.race([dbConnect(), timeoutPromise]);
    
    const connectionTime = Date.now() - startTime;
    
    return res.status(200).json({
      success: true,
      message: 'Authentication system is healthy',
      details: {
        database: 'Connected',
        connectionTime: `${connectionTime}ms`,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Auth health check failed:', error);
    
    return res.status(503).json({
      success: false,
      message: 'Authentication system is not healthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}