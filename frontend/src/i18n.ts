import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en.json';
import tlTranslation from './locales/tl.json';
import cebTranslation from './locales/ceb.json';
import warTranslation from './locales/war.json';

const resources = {
  en: { translation: enTranslation },
  tl: { translation: tlTranslation },
  ceb: { translation: cebTranslation },
  war: { translation: warTranslation }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
