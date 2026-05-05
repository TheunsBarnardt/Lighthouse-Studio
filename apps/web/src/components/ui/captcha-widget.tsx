'use client';

import { useEffect, useId, useRef } from 'react';

// eslint-disable-next-line no-restricted-syntax -- client-side: must use NEXT_PUBLIC_* directly
const SITE_KEY = process.env['NEXT_PUBLIC_CAPTCHA_SITE_KEY'] ?? '';
// eslint-disable-next-line no-restricted-syntax -- client-side: must use NEXT_PUBLIC_* directly
const PROVIDER = process.env['NEXT_PUBLIC_CAPTCHA_PROVIDER'] ?? 'none';

interface CaptchaWidgetProps {
  onToken: (token: string) => void;
  onExpire?: () => void;
}

declare global {
  interface Window {
    hcaptcha?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (t: string) => void; 'expired-callback'?: () => void },
      ) => string;
      reset: (widgetId: string) => void;
    };
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (t: string) => void; 'expired-callback'?: () => void },
      ) => string;
      reset: (widgetId: string) => void;
    };
  }
}

export function CaptchaWidget({ onToken, onExpire }: CaptchaWidgetProps) {
  const containerId = useId();
  const widgetIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!SITE_KEY || PROVIDER === 'none') return;

    const scriptSrc =
      PROVIDER === 'hcaptcha'
        ? 'https://js.hcaptcha.com/1/api.js?render=explicit'
        : 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

    function mount() {
      const el = containerRef.current;
      if (!el) return;

      if (PROVIDER === 'hcaptcha' && window.hcaptcha) {
        widgetIdRef.current = window.hcaptcha.render(el, {
          sitekey: SITE_KEY,
          callback: onToken,
          ...(onExpire && { 'expired-callback': onExpire }),
        });
      } else if (PROVIDER === 'turnstile' && window.turnstile) {
        widgetIdRef.current = window.turnstile.render(el, {
          sitekey: SITE_KEY,
          callback: onToken,
          ...(onExpire && { 'expired-callback': onExpire }),
        });
      }
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="${scriptSrc.split('?')[0] ?? scriptSrc}"]`,
    );
    if (existing) {
      mount();
      return;
    }

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.defer = true;
    script.onload = mount;
    document.head.appendChild(script);

    return () => {
      if (widgetIdRef.current !== null) {
        if (PROVIDER === 'hcaptcha') window.hcaptcha?.reset(widgetIdRef.current);
        if (PROVIDER === 'turnstile') window.turnstile?.reset(widgetIdRef.current);
      }
    };
  }, [onToken, onExpire]);

  if (!SITE_KEY || PROVIDER === 'none') return null;

  return <div ref={containerRef} id={containerId} aria-label="Security check" />;
}
