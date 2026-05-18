import type { ReactNode } from 'react';

/**
 * Bare layout for the preview iframe target. No app-shell, no nav, no auth chrome.
 * Renders the body in isolation so the iframe is just the generated UI plus the
 * selection agent.
 */
export default function PreviewLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export const metadata = {
  title: 'Lighthouse preview',
  robots: { index: false, follow: false },
};
