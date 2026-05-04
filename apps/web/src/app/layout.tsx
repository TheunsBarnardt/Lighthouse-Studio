import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';

import { QueryProvider } from '@/components/query-provider';
import { ThemeProvider } from '@/components/theme-provider';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Lighthouse Studio',
  description: 'Self-hosted AI development platform',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>
        <ThemeProvider>
          <QueryProvider>
            <div id="root">{children}</div>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
