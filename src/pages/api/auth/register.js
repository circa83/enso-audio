// pages/api/auth/register.js
import bcrypt from 'bcrypt';
import { users } from './[...nextauth]';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  try {
    const { name, email, password } = req.body;
    
    console.log("Registration attempt for:", email);
    
    // Basic validation
    if (!name || !email || !password) {
      console.log("Missing required fields");
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check if user already exists
    const userExists = users.find(user => user.email === email);
    if (userExists) {
      console.log("User already exists:", email);
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create a new user
    const newUser = {
      id: (users.length + 1).toString(),
      name,
      email,
      password: hashedPassword,
      role: 'therapist', // Default role
      createdAt: new Date().toISOString(),
    };
    
    // Add user to the array (in a real app, you would add to the database)
    users.push(newUser);
    
    console.log("User registered successfully:", email);
    
    // Return success
    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'An error occurred during registration' });
  }
}