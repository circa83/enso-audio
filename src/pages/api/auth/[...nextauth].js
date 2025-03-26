// pages/api/auth/[...nextauth].js
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';

// This is a placeholder for a real database
// In a production app, you would use a real database like MongoDB
const users = [
  {
    id: '1',
    name: 'Demo Therapist',
    email: 'demo@enso-audio.com',
    // This is "password" hashed with bcrypt
    password: '$2b$10$tZHXv0cXsRwgf17I/pYOH.aJL8GXQXxZELQ.PfvKpQhWSIv2MVl7i',
    role: 'therapist',
    createdAt: new Date().toISOString(),
  },
];

// Export a global variable to access users from the register API
export { users };

export default NextAuth({
  // Configure one or more authentication providers
  providers: [
    CredentialsProvider({
      // The name to display on the sign in form (e.g. "Sign in with...")
      name: 'Credentials',
      // The credentials is used to generate a suitable form on the sign in page.
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          // Log for debugging
          console.log("Authorize function called with email:", credentials.email);
          
          // In a real application, you would fetch the user from your database
          const user = users.find(user => user.email === credentials.email);
          
          if (!user) {
            console.log("User not found:", credentials.email);
            return null;
          }
          
          // For demo user, allow direct password check
          if (credentials.email === 'demo@enso-audio.com' && credentials.password === 'password') {
            console.log("Demo user login successful");
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
            };
          }
          
          // Compare the provided password with the stored hash
          const passwordMatch = await bcrypt.compare(credentials.password, user.password);
          
          if (!passwordMatch) {
            console.log("Password does not match");
            return null;
          }
          
          console.log("Authentication successful for:", user.email);
          
          // Return user object without the password
          return {
            id: user.id,
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
  // Generate a secret if one isn't provided
  secret: process.env.NEXTAUTH_SECRET || "ensosecret1234567890abcdefghijk",
  // Enable debug messages in development
  debug: process.env.NODE_ENV === 'development',
});