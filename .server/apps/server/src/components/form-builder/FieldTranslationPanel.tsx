import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LucideLanguages } from "lucide-react";
import Language from "@/models/language";
import EventForm from "@/models/event-form";

type FieldTranslationPanelProps = {
  field: EventForm.Field;
  primaryLanguage: string;
  translation: EventForm.FieldTranslation | undefined;
  onTranslationChange: (
    fieldId: string,
    lang: string,
    key: "name" | "description",
    value: string,
  ) => void;
  onOptionTranslationChange: (
    fieldId: string,
    optionId: string,
    lang: string,
    value: string,
  ) => void;
};

export function FieldTranslationPanel({
  field,
  primaryLanguage,
  translation,
  onTranslationChange,
  onOptionTranslationChange,
}: FieldTranslationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const languages = Language.nonPrimaryLanguages(primaryLanguage);

  // No translations for separators
  if (field.fieldType === "separator") return null;

  const hasOptions =
    "options" in field &&
    Array.isArray(field.options) &&
    field.options.length > 0 &&
    field.options.some((opt: any) => typeof opt === "object");

  return (
    <div className="pt-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        <LucideLanguages size="1rem" />
        {isOpen ? "Hide Translations" : "Manage Translations"}
      </Button>

      {isOpen && (
        <div className="mt-3 ml-2 space-y-4 border-l-2 border-muted pl-4">
          {languages.map((lang) => (
            <div key={lang} className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {Language.friendlyLang(lang)}
              </p>

              {/* Field name translation */}
              <Input
                label="Name"
                size="sm"
                placeholder={`${field.name || "Name"} in ${Language.friendlyLang(lang)}`}
                value={translation?.name?.[lang] ?? ""}
                onChange={(e) =>
                  onTranslationChange(field.id, lang, "name", e.target.value)
                }
              />

              {/* Field description translation (skip for text display fields) */}
              {field.fieldType !== "text" && (
                <Input
                  label="Description"
                  size="sm"
                  placeholder={`${field.description || "Description"} in ${Language.friendlyLang(lang)}`}
                  value={translation?.description?.[lang] ?? ""}
                  onChange={(e) =>
                    onTranslationChange(
                      field.id,
                      lang,
                      "description",
                      e.target.value,
                    )
                  }
                />
              )}

              {/* Option translations */}
              {hasOptions &&
                (field.options as EventForm.FieldOption[]).map(
                  (opt: EventForm.FieldOption) => {
                    const optId = EventForm.getOptionId(opt);
                    return (
                      <Input
                        key={optId}
                        label={`Option: ${opt.label}`}
                        size="sm"
                        placeholder={`${opt.label} in ${Language.friendlyLang(lang)}`}
                        value={
                          translation?.options?.[optId]?.[lang] ?? ""
                        }
                        onChange={(e) =>
                          onOptionTranslationChange(
                            field.id,
                            optId,
                            lang,
                            e.target.value,
                          )
                        }
                      />
                    );
                  },
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
