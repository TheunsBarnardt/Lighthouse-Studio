// @ts-check
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';

// Load the root .env so all packages share one source of truth.
// apps/web/.env.local still takes precedence (Next.js loads it after this).
const rootDir = resolve(fileURLToPath(import.meta.url), '../../..');
loadEnv({ path: resolve(rootDir, '.env'), override: false });

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ['ts', 'tsx'],
  experimental: {
    optimizePackageImports: [],
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
  /**
   * @param {import('webpack').Configuration} config
   * @param {{ isServer: boolean, webpack: typeof import('webpack'), nextRuntime?: 'edge' | 'nodejs' }} options
   */
  webpack(config, { isServer, webpack, nextRuntime }) {
    config.resolve ??= {};
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };

    if (isServer && nextRuntime !== 'edge') {
      config.externals ??= [];
      if (Array.isArray(config.externals)) {
        config.externals.push((/** @type {{ request?: string }} */ { request }, callback) => {
          if (request?.startsWith('node:')) {
            return callback(null, `commonjs ${request.slice(5)}`);
          }
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
    } else if (!isServer) {
      config.plugins ??= [];
      config.plugins.push(
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
