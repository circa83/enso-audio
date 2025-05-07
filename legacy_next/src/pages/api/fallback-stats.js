// pages/api/fallback-stats.js
import { getToken } from 'next-auth/jwt';
import dbConnect from '../../lib/mongodb';
import User from '../../models/User';

/**
 * A fallback API for fetching user stats when the session-based approach fails
 * This uses JWT token directly instead of relying on the session
 */
export default async function handler(req, res) {
  // Only allow GET method
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  
  try {
    // Attempt to get the JWT token
    const token = await getToken({ 
      req,
      secret: process.env.NEXTAUTH_SECRET
    });
    
    // Log token info for debugging
    console.log('Token present:', !!token);
    
    if (!token) {
      // Check for fallback auth
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized - No valid authentication' 
        });
      }
      
      // We'll implement fallback token validation here if needed
      // For now, return an error
      return res.status(401).json({ 
        success: false, 
        message: 'No session found and fallback auth not configured' 
      });
    }
    
    // Connect to database
    await dbConnect();
    
    // Get user data from token
    const userId = token.id || token.sub;
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid token - no user ID' 
      });
    }
    
    // Find user in database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Return stats or default values
    const stats = user.stats || {
      sessionsCompleted: 0,
      activeClients: 0,
      totalSessionTime: 0
    };
    
    return res.status(200).json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('Fallback stats error:', error);
    
    // Return default stats in case of error
    return res.status(200).json({
      success: false,
      message: 'Error retrieving stats, using defaults',
      stats: {
        sessionsCompleted: 0,
        activeClients: 0,
        totalSessionTime: 0
      }
    });
  }
}