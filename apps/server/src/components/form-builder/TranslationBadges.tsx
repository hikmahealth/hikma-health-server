import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Language from "@/models/language";

type TranslationBadgesProps = {
  primaryLanguage: string;
  translations: Language.TranslationObject;
  onTranslationChange: (lang: string, value: string) => void;
  inputType?: "text" | "textarea";
};

export function TranslationBadges({
  primaryLanguage,
  translations,
  onTranslationChange,
  inputType = "text",
}: TranslationBadgesProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const languages = Language.nonPrimaryLanguages(primaryLanguage);

  const toggle = (lang: string) =>
    setExpanded((prev) => ({ ...prev, [lang]: !prev[lang] }));

  if (languages.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex flex-row flex-wrap gap-1">
        {languages.map((lang) => {
          const hasValue = !!translations[lang];
          return (
            <Button
              key={lang}
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => toggle(lang)}
            >
              {hasValue ? "" : "+ "}
              {Language.friendlyLang(lang)}
            </Button>
          );
        })}
      </div>
      {languages.map((lang) => {
        if (!expanded[lang]) return null;
        const value = translations[lang] ?? "";
        const InputComponent = inputType === "textarea" ? Textarea : Input;
        return (
          <div key={lang} className="ml-4">
            <InputComponent
              placeholder={`${Language.friendlyLang(lang)} translation`}
              value={value}
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                onTranslationChange(lang, e.target.value)
              }
            />
          </div>
        );
      })}
    </div>
  );
}
