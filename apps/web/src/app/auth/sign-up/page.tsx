'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { PasswordRules } from '@/components/ui/password-rules';
import { SsoButtons } from '@/components/ui/sso-buttons';
import { AuthApiError, authApi } from '@/lib/auth-client';

const SignUpSchema = z
  .object({
    displayName: z.string().min(1, 'Display name is required').max(255),
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignUpValues = z.infer<typeof SignUpSchema>;

export default function SignUpPage() {
  const t = useTranslations('auth.signUp');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string>('');

  const form = useForm<SignUpValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zod 3.25 / hookform 3.10 type incompatibility
    resolver: zodResolver(SignUpSchema as any),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
    mode: 'onChange',
  });

  async function onSubmit(values: SignUpValues) {
    setError(null);
    setVerifyNotice(null);
    try {
      const result = await authApi.signUp({
        ...values,
        ...(captchaToken ? { captchaToken } : {}),
      });
      if ('emailVerificationRequired' in result) {
        setVerifyNotice(result.message);
        form.reset();
        return;
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t('error'));
    }
  }

  if (verifyNotice) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{verifyNotice}</p>
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
                  <PasswordRules value={field.value} />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repeat your password"
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

        <SsoButtons returnTo="/" />
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
