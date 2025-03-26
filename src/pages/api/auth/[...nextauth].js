// pages/api/auth/[...nextauth].js
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@next-auth/mongodb-adapter';
import clientPromise from '../../../lib/mongodb-client';
import User from '../../../models/User';
import dbConnect from '../../../lib/mongodb';

// Connect to database
export default async function auth(req, res) {
  await dbConnect();

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
                demoUser = await User.create({
                  name: 'Demo Therapist',
                  email: 'demo@enso-audio.com',
                  password: 'password', // This will be hashed by the pre-save hook
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
            
            // Regular user login
            const user = await User.findOne({ email: credentials.email });
            if (!user) {
              console.log("User not found:", credentials.email);
              return null;
            }
            
            // Verify password with the method from our model
            const isValid = await user.comparePassword(credentials.password);
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
    callbacks: {
      async jwt({ token, user }) {
        // Add user info to the JWT token when they sign in
        if (user) {
          token.id = user.id;
          token.role = user.role;
        }
        return token;
      },
      async session({ session, token }) {
        // Add user info to the session from the token
        if (token) {
          session.user.id = token.id;
          session.user.role = token.role;
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
}