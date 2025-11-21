/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Externalize packages that cause issues in browser build
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    // Fix for @metamask/sdk requiring @react-native-async-storage/async-storage
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
    };
    
    // Fallback for node modules not available in browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    
    return config;
  },
};

module.exports = nextConfig;
