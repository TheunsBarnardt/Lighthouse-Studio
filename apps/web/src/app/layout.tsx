import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import { ShellWrapper } from '@/components/app-shell/shell-wrapper';
import { QueryProvider } from '@/components/query-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/context/auth-context';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Lighthouse Studio',
  description: 'Self-hosted AI development platform',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <QueryProvider>
              <AuthProvider>
                <ShellWrapper>{children}</ShellWrapper>
              </AuthProvider>
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
