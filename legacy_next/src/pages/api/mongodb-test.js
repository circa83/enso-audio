// pages/api/mongodb-test.js
import dbConnect from '../../lib/mongodb';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  
  try {
    console.log('[mongodb-test] Attempting to connect to MongoDB...');
    const startTime = Date.now();
    
    // Try to connect with MongoDB
    await dbConnect();
    
    const connectionTime = Date.now() - startTime;
    console.log(`[mongodb-test] MongoDB connection successful in ${connectionTime}ms`);
    
    return res.status(200).json({
      success: true,
      message: 'MongoDB connection successful',
      connectionTime: `${connectionTime}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[mongodb-test] MongoDB connection failed:', error);
    
    return res.status(500).json({
      success: false,
      message: 'MongoDB connection failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}