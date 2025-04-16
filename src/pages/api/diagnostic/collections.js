// src/pages/api/diagnostic/collections.js
export default async function handler(req, res) {
    try {
      // Step 1: Check Blob Storage
      console.log('[Diagnostic] Checking Vercel Blob Storage');
      const blobResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/blob/list?prefix=collections/`);
      if (!blobResponse.ok) throw new Error(`Blob API error: ${blobResponse.status}`);
      const blobs = await blobResponse.json();
      
      // Step 2: Extract collection folders
      const folders = new Set();
      blobs.forEach(blob => {
        const path = blob.pathname.split('/');
        if (path.length > 1 && path[0] === 'collections') {
          folders.add(path[1]);
        }
      });
      
      // Step 3: Check MongoDB
      console.log('[Diagnostic] Checking MongoDB collections');
      await dbConnect();
      const dbCollections = await Collection.find({}).select('id name');
      
      // Step 4: Find intersection
      const blobFolders = Array.from(folders);
      const dbIds = dbCollections.map(c => c.id);
      
      const inBlobButNotDB = blobFolders.filter(id => !dbIds.includes(id));
      const inDBButNotBlob = dbIds.filter(id => !blobFolders.includes(id));
      const inBoth = blobFolders.filter(id => dbIds.includes(id));
      
      return res.status(200).json({
        blobStorage: {
          status: blobs.length > 0 ? 'OK' : 'No blobs found',
          count: blobs.length,
          folders: blobFolders
        },
        mongodb: {
          status: dbCollections.length > 0 ? 'OK' : 'No collections found',
          count: dbCollections.length,
          collections: dbCollections
        },
        analysis: {
          inBlobButNotDB,
          inDBButNotBlob,
          inBoth
        }
      });
    } catch (error) {
      console.error('[Diagnostic] Error:', error);
      return res.status(500).json({
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }