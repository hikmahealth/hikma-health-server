import { getTranslation } from "@/platform/common/languages";
import { useFormBuildOptions } from "./context";
import { FormField } from "./types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hh/ui/components/select";

/**
Given a translation object, create options for a dropdown

@param {TranslationObject[]} translations
@param {LanguageKey} language
@returns {Array<{label: string, value: string}>}
*/
export function translationObjectOptions<
  TranslationMap extends Record<string, string>,
  TranslationKey extends keyof TranslationMap = keyof TranslationMap,
>(
  translations: TranslationMap[],
  language: TranslationKey,
): Array<{ label: string; value: string }> {
  return translations
    .map((t) => getTranslation(t, language))
    .map((st) => ({
      label: st,
      value: st,
    }));
}
export function FormFieldLabel({
  label,
  visible,
}: {
  label: Record<string, string>;
  visible: boolean;
}) {
  const { language: formLanguage } = useFormBuildOptions();

  return (
    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
      {getTranslation(label, formLanguage)}
      {!visible && <span className="text-muted-foreground"> (hidden)</span>}
    </label>
  );
}

export function FormFieldInput({ field }: { field: FormField }) {
  const { language: formLanguage } = useFormBuildOptions();

  if (field.fieldType === "text" || field.fieldType === "number") {
    return (
      <input
        type={field.fieldType}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        placeholder={field.fieldType === "number" ? "0" : "Enter text..."}
      />
    );
  }

  if (field.fieldType === "select") {
    return (
      <Select
        value={
          field.options.length > 0 && field.options[0].en
            ? field.options[0].en
            : "placeholder-value"
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          {translationObjectOptions(field.options, formLanguage).map(
            (option, index) => (
              <SelectItem key={index} value={option.value || `option-${index}`}>
                {option.label}
              </SelectItem>
            ),
          )}
        </SelectContent>
      </Select>
    );
  }

  if (field.fieldType === "date") {
    return (
      <input
        type="date"
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        placeholder="YYYY-MM-DD"
      />
    );
  }
}
