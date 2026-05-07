'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { authApi } from '@/lib/auth-client';

const MagicLinkSchema = z.object({ email: z.string().email() });

export default function MagicLinkPage() {
  const t = useTranslations('auth.magicLink');
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [consumeError, setConsumeError] = useState<string | null>(null);

  // If token in URL, consume it
  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        await authApi.consumeMagicLink(token);
        router.replace('/');
      } catch {
        setConsumeError(t('invalidToken'));
      }
    })();
  }, [token, router, t]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm({
    resolver: zodResolver(MagicLinkSchema as any),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: { email: string }) {
    await authApi.requestMagicLink(values.email);
    setSentEmail(values.email);
    setSent(true);
  }

  if (token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('consumingTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {consumeError ? (
            <Alert variant="destructive">
              <AlertDescription>{consumeError}</AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Signing you in…
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('successTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('successMessage', { email: sentEmail })}
          </p>
        </CardContent>
        <CardFooter className="justify-center">
          <Link href="/auth/sign-in" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('requestTitle')}</CardTitle>
        <CardDescription>{t('requestSubtitle')}</CardDescription>
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('emailLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t('emailPlaceholder')}
                      aria-required
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('submitting') : t('submit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
