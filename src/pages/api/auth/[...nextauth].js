// pages/api/auth/[...nextauth].js
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@next-auth/mongodb-adapter';
import clientPromise from '../../../lib/mongodb-client';
import User from '../../../models/User';
import dbConnect from '../../../lib/mongodb';
import bcrypt from 'bcrypt';

// Maximum time for auth request to complete
const AUTH_REQUEST_TIMEOUT = 10000; // 10 seconds

// Helper function to time out promises
const timeoutPromise = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
    )
  ]);
};

// Connect to database with built-in error handling
export default async function auth(req, res) {
  try {
    // Attempt database connection with timeout
    await timeoutPromise(dbConnect(), AUTH_REQUEST_TIMEOUT);
    
    // Log auth attempt
    console.log(`Auth request received at ${new Date().toISOString()}`);
    
    return await NextAuth(req, res, {
      adapter: MongoDBAdapter(clientPromise),
      providers: [
        CredentialsProvider({
          name: 'Credentials',
          credentials: {
            email: { label: "Email", type: "email" },
            password: { label: "Password", type: "password" }
          },
          async authorize(credentials) {
            try {
              // Log for debugging
              console.log("Authorize function called with email:", credentials.email);
              
              // Handle demo user case for easier testing
              if (credentials.email === 'demo@enso-audio.com' && credentials.password === 'password') {
                // Check if demo user exists, create if not
                let demoUser = await User.findOne({ email: 'demo@enso-audio.com' });
                
                if (!demoUser) {
                  // Hash password before storing
                  const hashedPassword = await bcrypt.hash('password', 10);
                  
                  demoUser = await User.create({
                    name: 'Demo Therapist',
                    email: 'demo@enso-audio.com',
                    password: hashedPassword,
                    role: 'therapist',
                  });
                }
                
                console.log("Demo user login successful");
                return {
                  id: demoUser._id.toString(),
                  name: demoUser.name,
                  email: demoUser.email,
                  role: demoUser.role,
                };
              }
              
              // Regular user login with timeout
              const user = await timeoutPromise(
                User.findOne({ email: credentials.email }),
                AUTH_REQUEST_TIMEOUT
              );
              
              if (!user) {
                console.log("User not found:", credentials.email);
                return null;
              }
              
              // Verify password with the method from our model
              const isValid = await timeoutPromise(
                user.comparePassword(credentials.password),
                AUTH_REQUEST_TIMEOUT
              );
              
              if (!isValid) {
                console.log("Password does not match");
                return null;
              }
              
              console.log("Authentication successful for:", user.email);
              
              // Return user object without the password
              return {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
              };
            } catch (error) {
              console.error('Auth error:', error);
              return null;
            }
          }
        }),
      ],
      session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      },
      jwt: {
        // Explicitly set JWT secret for more reliable token validation
        secret: process.env.NEXTAUTH_SECRET,
        // Increase JWT lifetime to match session
        maxAge: 30 * 24 * 60 * 60, // 30 days
      },
      cookies: {
        sessionToken: {
          name: `next-auth.session-token`,
          options: {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: process.env.NODE_ENV === 'production',
          }
        }
      },
      callbacks: {
        async jwt({ token, user }) {
          // Add user info to the JWT token when they sign in
          if (user) {
            token.id = user.id;
            token.role = user.role;
            token.email = user.email;
            token.name = user.name;
          }
          return token;
        },
        async session({ session, token }) {
          // Add user info to the session from the token
          if (token) {
            session.user.id = token.id;
            session.user.role = token.role;
            session.user.email = token.email;
            session.user.name = token.name;
          }
          return session;
        },
      },
      pages: {
        signIn: '/login',
        error: '/login', // Redirect to login page on error
      },
      debug: process.env.NODE_ENV === 'development',
    });
  } catch (error) {
    console.error('NextAuth initialization error:', error);
    
    // Send a more helpful error response
    return res.status(500).json({ 
      error: 'Internal server error during authentication',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}