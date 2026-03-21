/**
 * I18nProvider — Mobile internationalization with expo-localization.
 *
 * Detects device language automatically (Carlos Standard: zero config).
 * Falls back to English. Hidden toggle in profile for manual override.
 *
 * Uses i18next + react-i18next, loading translations from @readyboard/shared.
 *
 * Observability: logs detected locale on initialization.
 */

import { createElement, type ReactNode } from 'react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import {
  translations,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type SupportedLocale,
} from '@readyboard/shared';

function detectDeviceLocale(): SupportedLocale {
  try {
    const deviceLocales = getLocales();
    for (const locale of deviceLocales) {
      const lang = locale.languageCode?.toLowerCase();
      if (lang && SUPPORTED_LOCALES.includes(lang as SupportedLocale)) {
        return lang as SupportedLocale;
      }
    }
  } catch (error) {
    console.warn('[i18n] Failed to detect device locale:', error);
  }
  return DEFAULT_LOCALE;
}

// Initialize i18next singleton (runs once at module load)
const i18nInstance = i18next.createInstance();

i18nInstance.use(initReactI18next).init({
  lng: detectDeviceLocale(),
  fallbackLng: DEFAULT_LOCALE,
  resources: {
    en: { translation: translations.en },
    es: { translation: translations.es },
  },
  interpolation: {
    escapeValue: false, // React already escapes
  },
  react: {
    useSuspense: false, // Avoid Suspense on mobile
  },
});

console.log('[I18nProvider] Initialized with locale:', i18nInstance.language);

export { i18nInstance };

export function I18nProvider({ children }: { children: ReactNode }) {
  // createElement pattern — avoids @types/react 18/19 conflict in monorepo
  return createElement(I18nextProvider, { i18n: i18nInstance }, children);
}

/** Change language at runtime (for the hidden profile toggle) */
export async function changeLanguage(locale: SupportedLocale): Promise<void> {
  await i18nInstance.changeLanguage(locale);
  console.log('[I18nProvider] Language changed to:', locale);
}
