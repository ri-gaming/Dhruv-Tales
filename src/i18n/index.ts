import en from './en.json';
import hi from './hi.json';
import type { LanguageCode } from '../types';

/**
 * Extensible i18n registry.
 * To add another Indian language (e.g., Marathi 'mr', Tamil 'ta', Telugu 'te'),
 * add `<lang>.json` in this directory and register it in `translations` below.
 */
export const translations: Record<LanguageCode, typeof en> = {
  en,
  hi,
};

export const SUPPORTED_LANGUAGES: { code: LanguageCode; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'EN' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिंदी' },
];

export function resolveTranslation(lang: LanguageCode, path: string): string {
  const dict = translations[lang] ?? translations.en;
  const parts = path.split('.');
  let current: unknown = dict;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return path;
    }
  }
  return typeof current === 'string' ? current : path;
}
