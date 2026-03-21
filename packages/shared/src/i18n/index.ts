/**
 * Shared i18n — Translations + locale utilities
 *
 * Canonical translation files for both web (next-intl) and mobile (i18next).
 * Web still reads from its own messages/ directory; consolidation planned for later.
 *
 * i18next interpolation uses {{variable}} syntax (double curly braces).
 */

import en from './en.json';
import es from './es.json';

export const translations = { en, es } as const;

export type SupportedLocale = keyof typeof translations;

export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'es'];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export type TranslationKeys = typeof en;
