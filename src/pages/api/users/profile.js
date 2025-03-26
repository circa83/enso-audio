// pages/api/users/profile.js
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
      // Get user profile
      try {
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        // Return user data (password is automatically excluded by the schema)
        return res.status(200).json(user);
      } catch (error) {
        console.error('Error getting user profile:', error);
        return res.status(500).json({ message: 'Error getting user profile' });
      }
    
    case 'PUT':
      // Update user profile
      try {
        const { name, email, profile } = req.body;
        
        // Find user
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        // Update fields
        if (name) user.name = name;
        if (email) user.email = email;
        
        // Update profile if provided
        if (profile) {
          user.profile = {
            ...user.profile,
            ...profile
          };
        }
        
        // Save changes
        await user.save();
        
        return res.status(200).json({ 
          message: 'Profile updated successfully',
          user
        });
      } catch (error) {
        console.error('Error updating user profile:', error);
        
        if (error.name === 'ValidationError') {
          const validationErrors = Object.values(error.errors).map(err => err.message);
          return res.status(400).json({ 
            message: 'Validation error', 
            errors: validationErrors 
          });
        }
        
        return res.status(500).json({ message: 'Error updating user profile' });
      }
      
    default:
      return res.status(405).json({ message: 'Method not allowed' });
  }
}