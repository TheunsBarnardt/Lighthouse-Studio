'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CaptchaWidget } from '@/components/ui/captcha-widget';
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
import { AuthApiError, authApi } from '@/lib/auth-client';

const SignUpSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(255),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type SignUpValues = z.infer<typeof SignUpSchema>;

export default function SignUpPage() {
  const t = useTranslations('auth.signUp');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string>('');

  const form = useForm<SignUpValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zod 3.25 / hookform 3.10 type incompatibility
    resolver: zodResolver(SignUpSchema as any),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  async function onSubmit(values: SignUpValues) {
    setError(null);
    setSuccess(null);
    try {
      await authApi.signUp({ ...values, ...(captchaToken ? { captchaToken } : {}) });
      setSuccess(t('successMessage', { email: values.email }));
      form.reset();
      setCaptchaToken('');
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t('error'));
    }
  }

  if (success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('successTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{success}</p>
        </CardContent>
        <CardFooter className="justify-center text-sm">
          <Link href="/auth/sign-in" className="text-primary hover:underline">
            {t('signIn')}
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription />
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
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('displayNameLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="name"
                      placeholder={t('displayNamePlaceholder')}
                      aria-required
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('emailLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder={t('emailPlaceholder')}
                      aria-required
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('passwordLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder={t('passwordPlaceholder')}
                      aria-required
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <CaptchaWidget
              onToken={setCaptchaToken}
              onExpire={() => {
                setCaptchaToken('');
              }}
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
      <CardFooter className="flex justify-center text-sm text-muted-foreground">
        {t('alreadyHaveAccount')}&nbsp;
        <Link href="/auth/sign-in" className="font-medium text-primary hover:underline">
          {t('signIn')}
        </Link>
      </CardFooter>
    </Card>
  );
}
