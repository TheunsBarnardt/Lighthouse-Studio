'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/auth-context';
import { AuthApiError, authApi } from '@/lib/auth-client';

const MfaSchema = z.object({
  code: z.string().min(6).max(10),
});

function MfaChallengePageInner() {
  const t = useTranslations('auth.mfaChallenge');
  const router = useRouter();
  const searchParams = useSearchParams();
  const challengeId = searchParams.get('challengeId') ?? '';
  const returnTo = searchParams.get('returnTo') ?? '/';
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({ resolver: zodResolver(MfaSchema), defaultValues: { code: '' } });

  async function onSubmit(values: { code: string }) {
    setError(null);
    try {
      await authApi.mfaChallenge(challengeId, values.code);
      await refresh();
      router.replace(returnTo);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t('error', { attemptsLeft: '?' }));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              void form.handleSubmit(onSubmit)(e);
            }}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('codeLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder={t('codePlaceholder')}
                      maxLength={10}
                      aria-required
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && (
              <Alert variant="destructive" aria-live="polite">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('submitting') : t('submit')}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <Link href="/auth/sign-in" className="text-muted-foreground hover:text-primary">
          {t('lostDevice')}
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function MfaChallengePage() {
  return (
    <Suspense>
      <MfaChallengePageInner />
    </Suspense>
  );
}
