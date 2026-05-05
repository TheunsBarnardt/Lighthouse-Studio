'use client';

import { useTranslations } from 'next-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/auth-context';

const PROVIDER_LABELS: Record<string, string> = {
  builtin: 'Email & password',
  memory: 'Email & password',
  google: 'Google',
  github: 'GitHub',
  entra: 'Microsoft Entra',
  oidc: 'OpenID Connect',
  saml: 'SAML',
};

export default function IdentitiesPage() {
  const t = useTranslations('account.identities');
  const { user } = useAuth();
  const identities = user?.identities ?? [];

  return (
    <Card>
      <CardHeader><CardTitle>{t('title')}</CardTitle></CardHeader>
      <CardContent>
        {identities.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('noIdentities')}</p>
        )}
        <ul className="space-y-3">
          {identities.map((identity) => (
            <li key={identity.providerId} className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {PROVIDER_LABELS[identity.providerId] ?? identity.providerId}
                  </span>
                  {identity.primary && (
                    <Badge variant="secondary" className="text-xs">{t('primary')}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{identity.email}</p>
              </div>
              <div className="flex gap-2">
                {!identity.primary && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { /* TODO: make primary */ }}
                  >
                    {t('makePrimary')}
                  </Button>
                )}
                {identities.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { /* TODO: unlink */ }}
                    aria-label={`${t('unlink')} ${PROVIDER_LABELS[identity.providerId] ?? identity.providerId}`}
                  >
                    {t('unlink')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Button variant="outline" onClick={() => { /* TODO: link new provider */ }}>
            {t('link')}
          </Button>
        </div>
        {identities.length <= 1 && (
          <Alert className="mt-4">
            <AlertDescription>{t('cannotUnlinkLast')}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
