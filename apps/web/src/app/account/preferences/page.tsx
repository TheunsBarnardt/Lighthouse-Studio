'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export default function PreferencesPage() {
  const t = useTranslations('account.preferences');
  const [saved, setSaved] = useState(false);

  return (
    <Card>
      <CardHeader><CardTitle>{t('title')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t('languageLabel')}</Label>
          <p className="text-sm text-muted-foreground">English (only language available in v1)</p>
        </div>
        {saved && <Alert><AlertDescription>{t('saved')}</AlertDescription></Alert>}
        <Button onClick={() => { setSaved(true); }}>{t('save')}</Button>
      </CardContent>
    </Card>
  );
}
