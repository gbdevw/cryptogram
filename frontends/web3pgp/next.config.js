/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // Enable static export for SPA with client-side routing
  reactStrictMode: true,
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  turbopack: {},
};

module.exports = nextConfig;
