import React from "react";
import { useImmer, useImmerReducer } from "use-immer";
import { type FormBuildAction, reducer } from "./reducer";
import {
  FormBuildFormFieldInit,
  FormBuildState,
  schemaFormField,
} from "./types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hh/ui/components/select";
import { Button } from "@hh/ui/components/button";

const FormBuildContext = React.createContext<
  [FormBuildState, React.Dispatch<FormBuildAction>] | null
>(null);

/**
 * Creates the state required to render the form for use, or on a form creator.
 * Should be a state that can be pulled from database all good
 */
export const createFormBuild = function (opts: {
  name: string;
}): FormBuildState {
  return {
    form: {
      name: opts?.name,
      version: "0.1",
      fields: [
        {
          baseField: true,
          name: "given_name",
          label: { en: "First Name" }, // { [language: string]: string }
          fieldType: "text",
          required: true,
        },
      ],
      created_at: new Date(),
    },
    language: "en",
  };
};

// 1. create reducer
// 2. attach to provider
// 3. use state to render the form on the "registration form section"
// 4. use state to also render the form in the register new patient
// 5. think about test suite + zero runtime error philosophy (building towards it)

export const FormBuildContextProvider = function ({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = useImmerReducer(reducer, createFormBuild({ name: "sample" }));
  console.log({ ctxFirst: ctx });
  return (
    <FormBuildContext.Provider value={ctx}>
      {children}
    </FormBuildContext.Provider>
  );
};

const useFormBuildContext = function () {
  const ctx = React.useContext(FormBuildContext);
  console.log({ ctx });
  if (!ctx) {
    throw new Error(
      "FormBuildContext is not available. Make sure to use under <FormBuildContextProvider />",
    );
  }

  return ctx;
};

export const useFormBuildState = function () {
  const [state] = useFormBuildContext();
  return state;
};

export const useStateSelector = function <T>(
  selector: (state: FormBuildState) => T,
) {
  const state = useFormBuildState();
  return selector(state);
};

/**
 * Given a translation object and a language key to, return that language label, or default to the english version.
 * If the english version does not exist, return the first available translation.
 *
 * @param {TranslationObject} translations
 * @param {string} language
 * @return {string} translation
 */
export function getTranslation(
  translations: { [lang: string]: string },
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

function EditFormField({ field }: { field: FormBuildFormFieldInit }) {
  const build = useFormBuildState();

  switch (field.fieldType) {
    case "select": {
      return (
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {getTranslation(field.label, build.language)}
            {!field.visible && (
              <span className="text-muted-foreground">(hidden)</span>
            )}
          </label>
          <Select
            value={
              field.options.length > 0 && field.options[0][build.language]
                ? field.options[0][build.language]
                : "placeholder-value"
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option, index) => (
                <SelectItem
                  key={index}
                  value={option.value || `option-${index}`}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.required && (
            <span className="text-xs text-destructive">*Required</span>
          )}
        </div>
      );
    }
    case "text":
    case "number": {
      return (
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {getTranslation(field.label, build.language)}
            {!field.visible && (
              <span className="text-muted-foreground"> (hidden)</span>
            )}
          </label>
          <input
            type={field.fieldType}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={field.fieldType === "number" ? "0" : "Enter text..."}
          />
          {field.required && (
            <span className="text-xs text-destructive">*Required</span>
          )}
        </div>
      );
    }
  }
}

export function FormEditor({ className }: { className?: string }) {
  const [{ form }, dispatch] = useFormBuildContext();
  const [editField, setEditField] = useImmer({
    id: "",
  });

  return (
    <div className={className}>
      {form.fields.map((state, index) => {
        const field = schemaFormField.safeParse(state);
        const id = state.id;
        const isInEditMode = editField.id === state.id;
        if (!field.success) {
          return (
            <div>
              X - Failed to render the form field: {field.error.message}
            </div>
          );
        }

        return (
          <div
            className={`border rounded-lg p-4 ${
              isInEditMode ? "border-primary" : "border-border"
            }`}
            key={`form-${form.name}-${index}`}
          >
            {editField.id === "" && (
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditField((draft) => {
                      draft.id = id;
                    });
                  }}
                  size="sm"
                >
                  Edit Field
                </Button>

                {field.data.baseField !== true && (
                  <Button
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() =>
                      dispatch({
                        type: "remove-field",
                        payload: { id: field.id },
                      })
                    }
                    size="sm"
                  >
                    Delete Field
                  </Button>
                )}
              </div>
            )}
            <EditFormField field={field.data} />
            <div className="col-span-12 space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`visible-${id}`}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  checked={field.data.visible}
                  onChange={() =>
                    dispatch({
                      type: "toggle-visibility",
                      payload: { id },
                    })
                  }
                />
                <label
                  htmlFor={`visible-${id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  This field is visible to clinicians
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`required-${id}`}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  checked={field.data.required}
                  onChange={() =>
                    dispatch({
                      type: "toggle-field-required",
                      payload: { id },
                    })
                  }
                />
                <label
                  htmlFor={`required-${id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  This field is required
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`searchable-${id}`}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  checked={field.data.isSearchField}
                  onChange={() =>
                    dispatch({
                      type: "toggle-field-searchable",
                      payload: { id },
                    })
                  }
                />
                <label
                  htmlFor={`searchable-${id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  This field is included in advanced search
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`summary-${id}`}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  checked={field.data.showsInSummary}
                  onChange={() =>
                    dispatch({
                      type: "toggle-field-shows-in-summary",
                      payload: { id },
                    })
                  }
                />
                <label
                  htmlFor={`summary-${id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  This field is visible in the patient file summary
                </label>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
