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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SsoButtons } from '@/components/ui/sso-buttons';
import { useAuth } from '@/context/auth-context';
import { AuthApiError, authApi } from '@/lib/auth-client';

const SignInSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
});

type SignInValues = z.infer<typeof SignInSchema>;

function SignInPageInner() {
  const t = useTranslations('auth.signIn');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const returnTo = searchParams.get('returnTo') ?? '/';

  const form = useForm<SignInValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zod 3.25 / hookform 3.10 type incompatibility
    resolver: zodResolver(SignInSchema as any),
    defaultValues: { email: '', password: '', remember: false },
  });

  async function onSubmit(values: SignInValues) {
    setError(null);
    try {
      const result = await authApi.signIn({
        email: values.email,
        password: values.password,
        ...(values.remember !== undefined && { remember: values.remember }),
      });

      // 2FA required — redirect to challenge page
      if ('challengeId' in result) {
        const params = new URLSearchParams({
          challengeId: result.challengeId,
          returnTo,
        });
        router.replace(`/auth/mfa-challenge?${params.toString()}`);
        return;
      }

      await refresh();
      router.replace(returnTo);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t('error'));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
                  <div className="flex items-center justify-between">
                    <FormLabel>{t('passwordLabel')}</FormLabel>
                    <Link
                      href="/auth/forgot-password"
                      className="text-sm text-muted-foreground hover:text-primary"
                    >
                      {t('forgotPassword')}
                    </Link>
                  </div>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      placeholder={t('passwordPlaceholder')}
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
              name="remember"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                      id="remember"
                    />
                  </FormControl>
                  <FormLabel htmlFor="remember" className="cursor-pointer font-normal">
                    {t('rememberMe')}
                  </FormLabel>
                </FormItem>
              )}
            />

            {error && (
              <Alert variant="destructive" aria-live="polite">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
              aria-busy={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? t('submitting') : t('submit')}
            </Button>
          </form>
        </Form>

        <SsoButtons returnTo={returnTo} />
      </CardContent>
      <CardFooter className="flex justify-center text-sm text-muted-foreground">
        {t('noAccount')}&nbsp;
        <Link href="/auth/sign-up" className="font-medium text-primary hover:underline">
          {t('signUp')}
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInPageInner />
    </Suspense>
  );
}
