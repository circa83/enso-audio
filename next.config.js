/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // This appears twice in your original config, removing duplicate
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
  devIndicators: false,
  webpack: (config) => {
    config.externals = [...config.externals, 'formidable'];
    return config;
  },
}
  
module.exports = nextConfig