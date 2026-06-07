import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCN from './zh-CN'
import enUS from './en-US'

export const LANGUAGES = ['en-US', 'zh-CN'] as const
export type Language = (typeof LANGUAGES)[number]

export const LANGUAGE_STORAGE_KEY = 'labourboard.language'

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'en-US'
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (stored === 'zh-CN' || stored === 'en-US') return stored
  } catch {
    // localStorage unavailable
  }
  return 'en-US'
}

void i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
  lng: readStoredLanguage(),
  fallbackLng: 'en-US',
  interpolation: {
    escapeValue: false,
  },
})

export function changeLanguage(lang: Language): void {
  void i18n.changeLanguage(lang)
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
  } catch {
    // localStorage unavailable
  }
}

export default i18n
