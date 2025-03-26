// pages/api/users/stats.js
import { getSession } from 'next-auth/react';
import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';

export default async function handler(req, res) {
  const session = await getSession({ req });
  
  // Check authentication
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  // Connect to database
  await dbConnect();
  
  // Get user ID from session
  const userId = session.user.id;
  
  switch (req.method) {
    case 'GET':
      // Get user stats
      try {
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        // Return just the stats
        return res.status(200).json(user.stats);
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