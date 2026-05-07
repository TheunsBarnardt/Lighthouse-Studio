import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ['ts', 'tsx'],
  experimental: {
    optimizePackageImports: [],
    // Packages that use Node.js built-ins (node: protocol) must stay server-side only
    serverComponentsExternalPackages: [
      'mssql',
      'tedious',
      'msnodesqlv8',
      'mongodb',
      'pg',
      'pg-native',
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Allow node: protocol imports on server side
      config.externals = config.externals ?? [];
      if (Array.isArray(config.externals)) {
        config.externals.push(({ request }, callback) => {
          if (request?.startsWith('node:')) {
            return callback(null, `commonjs ${request.slice(5)}`);
          }
          callback();
        });
      }
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
