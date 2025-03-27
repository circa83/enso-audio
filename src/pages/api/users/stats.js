// pages/api/users/stats.js
import { getToken } from 'next-auth/jwt';
import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';

export default async function handler(req, res) {
  // Get the JWT token directly - more reliable than getSession
  const token = await getToken({ 
    req,
    secret: process.env.NEXTAUTH_SECRET
  });
  
  // Debug log to help troubleshoot
  console.log('Token in stats API:', token ? 'Token exists' : 'No token found');
  
  // Check authentication
  if (!token) {
    console.log('No valid token found, returning 401');
    return res.status(401).json({ message: 'Unauthorized - No valid token found' });
  }
  
  // Connect to database
  try {
    await dbConnect();
  } catch (error) {
    console.error('Database connection error:', error);
    return res.status(500).json({ message: 'Database connection failed' });
  }
  
  // Get user ID from token
  const userId = token.id || token.sub;
  
  // Debug log to help troubleshoot
  console.log('User ID from token:', userId);
  
  if (!userId) {
    console.log('Token exists but no user ID found');
    return res.status(401).json({ message: 'Unauthorized - Invalid token (no user ID)' });
  }
  
  switch (req.method) {
    case 'GET':
      // Get user stats
      try {
        const user = await User.findById(userId);
        if (!user) {
          console.log('User not found with ID:', userId);
          return res.status(404).json({ message: 'User not found' });
        }
        
        // If the user has no stats yet, return defaults
        const stats = user.stats || {
          sessionsCompleted: 0,
          activeClients: 0,
          totalSessionTime: 0,
        };
        
        // Log success
        console.log('Successfully retrieved stats for user:', userId);
        
        // Return user data (password is automatically excluded by the schema)
        return res.status(200).json(stats);
      } catch (error) {
        console.error('Error getting user stats:', error);
        return res.status(500).json({ message: 'Error getting user stats' });
      }
    
    case 'PUT':
      // Update user stats
      try {
        const { sessionsCompleted, activeClients, totalSessionTime } = req.body;
        
        // Find user
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        // Initialize stats object if it doesn't exist
        if (!user.stats) {
          user.stats = {
            sessionsCompleted: 0,
            activeClients: 0,
            totalSessionTime: 0
          };
        }
        
        // Update stats if provided
        if (sessionsCompleted !== undefined) {
          user.stats.sessionsCompleted = sessionsCompleted;
        }
        
        if (activeClients !== undefined) {
          user.stats.activeClients = activeClients;
        }
        
        if (totalSessionTime !== undefined) {
          user.stats.totalSessionTime = totalSessionTime;
        }
        
        // Save changes
        await user.save();
        
        return res.status(200).json({ 
          message: 'Stats updated successfully',
          stats: user.stats
        });
      } catch (error) {
        console.error('Error updating user stats:', error);
        return res.status(500).json({ message: 'Error updating user stats' });
      }
      
    default:
      return res.status(405).json({ message: 'Method not allowed' });
  }
}