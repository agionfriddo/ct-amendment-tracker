/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
  },
  webpack: (config) => {
    // This will make webpack ignore the canvas module
    config.resolve.alias.canvas = false;

    // Ignore other problematic modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      encoding: false,
    };

    return config;
  },
};

module.exports = nextConfig;
