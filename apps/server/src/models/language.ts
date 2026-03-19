// Define types in a namespace
export namespace Language {
  export type DefaultLanguages = {
    en: string;
    ar?: string;
    es?: string;
  };

  export const defaultLanguages: DefaultLanguages = {
    en: "English",
    ar: "Arabic",
    es: "Spanish",
  };

  export type TranslationObject = DefaultLanguages & {
    [lang: string]: string;
  };

  export type LanguageKey = "en" | "ar" | "es" | string;

  export const supportedLanguages = ["en", "ar", "es"] as const;
  export type SupportedLanguage = (typeof supportedLanguages)[number];

  /** Returns supported languages excluding the primary language */
  export function nonPrimaryLanguages(primary: string): string[] {
    return supportedLanguages.filter((lang) => lang !== primary);
  }

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
   * @param {TranslationObject} translations
   * @param {string} language
   * @return {string} translation
   */
  export function getTranslation(
    translations: TranslationObject,
    language: string,
  ): string {
    const translationKeys = Object.keys(translations);

    // in the case of no translations, return an empty string
    if (translationKeys.length === 0) {
      return "";
    }
    if (language in translations) {
      return translations[language];
    } else if (translations.en) {
      return translations.en;
    } else {
      return translations[translationKeys[0]];
    }
  }
}

export default Language;
