import type { StorybookConfig } from '@storybook/react-webpack5';

import path from 'path';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-interactions', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  webpackFinal: async (config) => {
    // Support @/* path alias
    if (config.resolve) {
      config.resolve.alias = {
        ...(config.resolve.alias as Record<string, unknown>),
        '@': path.resolve(__dirname, '../src'),
      };
    }
    return config;
  },
};

export default config;
