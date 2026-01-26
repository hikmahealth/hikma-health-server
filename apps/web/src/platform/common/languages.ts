export const langauges = {
  en: "English",
  ar: "Arabic",
  es: "Spanish",
};

export const SUPPORTED_LANGUAGES = Object.keys(langauges) as Array<
  keyof typeof langauges
>;

export type LanguageKey = string;

/**
 * Given a language key, return the expanded version of the key
 *
 * @param {LanguageKey} language
 * @returns {string}
 */
export function friendlyLang(language: LanguageKey): string {
  switch (language) {
    case "es": {
      return "Spanish";
    }
    case "ar": {
      return "Arabic";
    }
    case "en": {
      return "English";
    }
    default: {
      return language;
    }
  }
}

/**
 * Given a translation object and a language key to, return that language label, or default to the english version.
 * If the english version does not exist, return the first available translation.
 *
 * @return {string} translation
 */
export function getTranslation<
  TranslationMap extends Record<string, string>,
  TranslationKey extends keyof TranslationMap = keyof TranslationMap,
>(
  translations: TranslationMap,
  language: TranslationKey,
  fallbackLanugage: string = "en",
): string {
  const translationKeys = Object.keys(translations);

  // in the case of no translations, return an empty string
  if (translationKeys.length === 0) {
    return "";
  }
  if (language in translations) {
    return translations[language];
  } else if (translations[fallbackLanugage]) {
    return translations[fallbackLanugage];
  } else {
    return translations[translationKeys[0]];
  }
}
