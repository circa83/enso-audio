// pages/api/ip-check.js
export default function handler(req, res) {
    // Log the IP for your checking
    console.log('Server IP:', req.socket.localAddress);
    
    // Return the IP to the client
    res.status(200).json({ 
      ip: req.socket.localAddress,
      headers: req.headers
    });
  }