interface CaptchaProvider {
  verify(token: string, remoteIp?: string): Promise<boolean>;
}

class NullCaptchaProvider implements CaptchaProvider {
  verify(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

class HCaptchaProvider implements CaptchaProvider {
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  async verify(token: string, remoteIp?: string): Promise<boolean> {
    const body = new URLSearchParams({ secret: this.secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  }
}

class TurnstileProvider implements CaptchaProvider {
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  async verify(token: string, remoteIp?: string): Promise<boolean> {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: this.secret, response: token, ...(remoteIp ? { remoteip: remoteIp } : {}) }),
    });

    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  }
}

let _provider: CaptchaProvider | null = null;

export function getCaptchaProvider(): CaptchaProvider {
  if (_provider) return _provider;

  // eslint-disable-next-line no-restricted-syntax -- CAPTCHA_* not yet in env schema
  const providerName = process.env['CAPTCHA_PROVIDER'] ?? 'none';
  // eslint-disable-next-line no-restricted-syntax -- CAPTCHA_* not yet in env schema
  const secret = process.env['CAPTCHA_SECRET_KEY'] ?? '';

  if (providerName === 'hcaptcha') {
    _provider = new HCaptchaProvider(secret);
  } else if (providerName === 'turnstile') {
    _provider = new TurnstileProvider(secret);
  } else {
    _provider = new NullCaptchaProvider();
  }

  return _provider;
}

export function captchaEnabled(): boolean {
  // eslint-disable-next-line no-restricted-syntax -- CAPTCHA_* not yet in env schema
  const p = process.env['CAPTCHA_PROVIDER'] ?? 'none';
  return p === 'hcaptcha' || p === 'turnstile';
}
