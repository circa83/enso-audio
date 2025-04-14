/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Temporarily disable strict mode for debugging
  poweredByHeader: false, // Add this to prevent Vercel from adding extra styles or scripts that might affect layout
  experimental: {
    // Increase timeout for API routes - helps with auth timeouts
    serverTimeout: 15000, // 15 seconds in milliseconds (equivalent to maxDuration in vercel.json)
    serverMemoryLimit: 1024 // 1GB memory limit in MB
  },
  // Specify headers for API routes
  async headers() {
    return [
      {
        source: '/pages/api/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ]
  },
  // For Vercel deployment
  poweredByHeader: false,
  // Your other config settings
  devIndicators: false,
  webpack: (config) => {
    config.externals = [...config.externals, 'formidable'];
    return config;
  },
}
  
module.exports = nextConfig