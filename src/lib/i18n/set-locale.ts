'use server';

import { cookies } from 'next/headers';

const SUPPORTED_LOCALES = ['en', 'es'] as const;

/**
 * Server action to set the user's locale preference.
 * Called from the hidden language toggle in the profile page.
 * Sets a cookie that takes priority over Accept-Language detection.
 */
export async function setLocale(locale: string) {
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  const cookieStore = await cookies();
  cookieStore.set('locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  });
}
