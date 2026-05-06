import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlatformProvider } from '@platform/sdk-react';
import { createClient } from '@platform/sdk';
import { App } from './App.js';

const platformClient = createClient({
  url: import.meta.env['VITE_PLATFORM_URL'] ?? 'http://localhost:3000',
  anonKey: import.meta.env['VITE_PLATFORM_ANON_KEY'] ?? '',
});

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PlatformProvider client={platformClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </PlatformProvider>
  </React.StrictMode>,
);
