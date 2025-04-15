import { list } from '@vercel/blob';
import { getToken } from 'next-auth/jwt';

export default async function handler(req, res) {
  // Only allow GET method
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the prefix from query parameters
    const { prefix = '' } = req.query;
    
    // List blobs with the given prefix
    const { blobs } = await list({
      prefix,
      limit: 1000 // Adjust this limit as needed
    });
    
    return res.status(200).json(blobs);
  } catch (error) {
    console.error('[API: blob/list] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to list blobs',
      message: error.message
    });
  }
} 