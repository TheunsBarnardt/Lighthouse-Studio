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
      '@sentry/node',
      '@sentry/core',
      '@opentelemetry/sdk-node',
      '@opentelemetry/api',
      'pino',
      '@platform/adapter-observability-errors',
      '@platform/adapter-observability-metrics',
      '@platform/adapter-observability-traces',
    ],
  },
  webpack: (config, { isServer, webpack }) => {
    // Resolve .js imports to .ts/.tsx for ESM-style imports
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };

    if (isServer) {
      // Allow node: protocol imports on server side, and keep Sentry/OTel as externals
      config.externals = config.externals ?? [];
      if (Array.isArray(config.externals)) {
        config.externals.push(({ request }, callback) => {
          if (request?.startsWith('node:')) {
            return callback(null, `commonjs ${request.slice(5)}`);
          }
          // Keep Sentry and OpenTelemetry out of the webpack bundle to avoid native module issues
          if (
            request?.startsWith('@sentry/') ||
            request?.startsWith('@opentelemetry/') ||
            request?.startsWith('@platform/adapter-observability')
          ) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        });
      }
    } else {
      // On the client side, strip node: prefix so webpack fallback can handle them
      config.plugins.push(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, '');
        }),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        fs: false,
        path: false,
        url: false,
        os: false,
        child_process: false,
        stream: false,
        buffer: false,
        events: false,
        net: false,
        tls: false,
        http: false,
        https: false,
        zlib: false,
        assert: false,
        util: false,
        querystring: false,
        vm: false,
      };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
