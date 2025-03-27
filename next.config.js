/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Temporarily disable strict mode for debugging
  experimental: {
    // Increase timeout for API routes - helps with auth timeouts
    serverTimeout: 15000, // 15 seconds in milliseconds (equivalent to maxDuration in vercel.json)
    serverMemoryLimit: 1024 // 1GB memory limit in MB
  },
  // Specify headers for API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ]
  },
  // For Vercel deployment
  poweredByHeader: false,
  // Your other config settings
  devIndicators: false
}
  
module.exports = nextConfig