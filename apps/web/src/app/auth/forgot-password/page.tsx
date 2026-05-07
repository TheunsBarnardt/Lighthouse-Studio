'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
import { authApi } from '@/lib/auth-client';

const ForgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword');
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string>('');

  const form = useForm({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(ForgotPasswordSchema as any),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: { email: string }) {
    await authApi.forgotPassword(values.email, captchaToken || undefined);
    setSentEmail(values.email);
    setSent(true);
    setCaptchaToken('');
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
        <CardFooter className="justify-center text-sm">
          <Link href="/auth/sign-in" className="text-primary hover:underline">
            {t('backToSignIn')}
          </Link>
        </CardFooter>
      </Card>
    );
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
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('submitting') : t('submit')}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <Link href="/auth/sign-in" className="text-muted-foreground hover:text-primary">
          {t('backToSignIn')}
        </Link>
      </CardFooter>
    </Card>
  );
}
