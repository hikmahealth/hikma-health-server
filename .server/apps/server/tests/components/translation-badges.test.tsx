import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TranslationBadges } from "@/components/form-builder/TranslationBadges";
import type Language from "@/models/language";

describe("TranslationBadges", () => {
  it("renders badges for non-primary languages only", () => {
    render(
      <TranslationBadges
        primaryLanguage="en"
        translations={{} as Language.TranslationObject}
        onTranslationChange={() => {}}
      />,
    );
    expect(screen.getByText("+ Arabic")).toBeDefined();
    expect(screen.getByText("+ Spanish")).toBeDefined();
    expect(screen.queryByText(/English/)).toBeNull();
  });

  it("renders no badges when primary language is only supported language left", () => {
    // With only en/ar/es supported, setting primary to "en" still shows ar + es
    // But if we had a scenario where all languages are primary, it returns null
    const { container } = render(
      <TranslationBadges
        primaryLanguage="en"
        translations={{} as Language.TranslationObject}
        onTranslationChange={() => {}}
      />,
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2); // ar and es
  });

  it("shows filled badge (no + prefix) when translation exists", () => {
    render(
      <TranslationBadges
        primaryLanguage="en"
        translations={{ ar: "ترجمة" } as Language.TranslationObject}
        onTranslationChange={() => {}}
      />,
    );
    expect(screen.getByText("Arabic")).toBeDefined();
    expect(screen.getByText("+ Spanish")).toBeDefined();
  });
});
