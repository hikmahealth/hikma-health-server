import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { Language } from "../../src/models/language";

describe("Language.nonPrimaryLanguages", () => {
  it("should exclude the primary language", () => {
    expect(Language.nonPrimaryLanguages("en")).toEqual(["ar", "es"]);
    expect(Language.nonPrimaryLanguages("ar")).toEqual(["en", "es"]);
    expect(Language.nonPrimaryLanguages("es")).toEqual(["en", "ar"]);
  });

  it("should return all supported languages for unknown primary", () => {
    expect(Language.nonPrimaryLanguages("fr")).toEqual(["en", "ar", "es"]);
  });
});

describe("Language.friendlyLang", () => {
  it("should return friendly names for supported languages", () => {
    expect(Language.friendlyLang("en")).toBe("English");
    expect(Language.friendlyLang("ar")).toBe("Arabic");
    expect(Language.friendlyLang("es")).toBe("Spanish");
  });

  it("should return the key itself for unknown languages", () => {
    expect(Language.friendlyLang("fr")).toBe("fr");
    expect(Language.friendlyLang("de")).toBe("de");
  });

  it("property: always returns a non-empty string", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (lang) => {
        const result = Language.friendlyLang(lang);
        expect(result.length).toBeGreaterThan(0);
      }),
    );
  });
});

describe("Language.getTranslation", () => {
  it("should return the requested language translation", () => {
    const translations = { en: "Hello", ar: "مرحبا", es: "Hola" };
    expect(Language.getTranslation(translations, "ar")).toBe("مرحبا");
  });

  it("should fall back to English when requested language is missing", () => {
    const translations = { en: "Hello", es: "Hola" };
    expect(Language.getTranslation(translations, "ar")).toBe("Hello");
  });

  it("should fall back to first available when English is also missing", () => {
    const translations = { es: "Hola", ar: "مرحبا" } as Language.TranslationObject;
    expect(Language.getTranslation(translations, "fr")).toBe("Hola");
  });

  it("should return empty string for empty translations object", () => {
    const translations = {} as Language.TranslationObject;
    expect(Language.getTranslation(translations, "en")).toBe("");
  });

  it("should return exact match over fallback", () => {
    const translations = { en: "English", fr: "French" };
    expect(Language.getTranslation(translations, "fr")).toBe("French");
  });
});
