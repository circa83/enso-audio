// pages/api/auth/register.js
import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  // Connect to database
  await dbConnect();
  
  try {
    const { name, email, password } = req.body;
    
    console.log("Registration attempt for:", email);
    
    // Basic validation
    if (!name || !email || !password) {
      console.log("Missing required fields");
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log("User already exists:", email);
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Create new user
    const newUser = await User.create({
      name,
      email,
      password, // Password will be hashed by the pre-save hook
      role: 'therapist', // Default role
    });
    
    console.log("User registered successfully:", email);
    
    // Return success without password
    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Check for validation errors from Mongoose
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: validationErrors 
      });
    }
    
    // Handle duplicate key error (code 11000)
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    
    return res.status(500).json({ message: 'An error occurred during registration' });
  }
}