import { createFileRoute } from "@tanstack/react-router";
import { Language } from "@/models/language";
import sortBy from "lodash/sortBy";
import { useEffect, useMemo, useState } from "react";
import { useImmer, useImmerReducer } from "use-immer";
import { Option } from "effect";
import PatientRegistrationForm from "@/models/patient-registration-form";
import { v1 as uuidv1 } from "uuid";
import { baseFields } from "@/data/registration-form-base-fields";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import React from "react";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getPatientRegistrationForm } from "@/lib/server-functions/patient-registration-forms";

export const saveForm = createServerFn({ method: "POST" })
  .validator((data: PatientRegistrationForm.T) => data)
  .handler(async ({ data }) => {
    return PatientRegistrationForm.upsertPatientRegistrationForm(data);
  });

export const Route = createFileRoute(
  "/app/patients/customize-registration-form"
)({
  component: RouteComponent,
  loader: async () => {
    return {
      patientRegistrationForm: await getPatientRegistrationForm(),
    };
  },
});

const registrationFormFieldSchema = z.object({
  id: z.string().min(1),
  position: z.number().min(1),
  column: z.string().min(1),
  label: z.record(z.string().min(0)),
  fieldType: z.enum(PatientRegistrationForm.inputTypes),
  options: z.array(z.record(z.string().min(1))),
  required: z.boolean(),
  baseField: z.boolean(),
  visible: z.boolean(),
  deleted: z.boolean(),
  showsInSummary: z.boolean(),
  isSearchField: z.boolean(),
});

const registrationFormSchema = z.object({
  id: z.string().min(10),
  clinic_id: z.custom<Option.Option<string>>(),
  name: z.custom<Option.Option<string>>(),
  fields: z.array(registrationFormFieldSchema),
  metadata: z.record(z.any()),
  is_deleted: z.boolean(),
  created_at: z.date(),
  updated_at: z.date(),
  last_modified: z.date(),
  server_created_at: z.date(),
  deleted_at: z.custom<Option.Option<Date>>(),
});

type State = PatientRegistrationForm.T;
type Action =
  | { type: "set-form-state"; payload: { form: State } } // sets the entire form to a specific value. usefull for initial states and setting values to what is in the database.
  | { type: "add-field" } // generates a fieldID by default
  | { type: "remove-field"; payload: { id: string } } // only removes fields that are not base fields
  | { type: "restore-field"; payload: { id: string } } // restores previously deleted fields
  | { type: "change-position"; payload: { id: string; position: number } }
  | {
      type: "update-field-label";
      payload: { translation: string; label: string; id: string };
    }
  | { type: "toggle-field-required"; payload: { id: string } }
  | { type: "toggle-field-searchable"; payload: { id: string } }
  | { type: "toggle-field-shows-in-summary"; payload: { id: string } }
  | {
      type: "toggle-visibility";
      payload: {
        id: string;
      };
    }
  | {
      type: "update-field-translation";
      payload: {
        language: string;
        text: string;
      };
    }
  | {
      type: "update-field-type";
      payload: {
        id: string;
        type: PatientRegistrationForm.InputType;
      };
    }
  | {
      type: "add-select-option";
      payload: { id: string };
    }
  | {
      type: "remove-select-option";
      payload: { id: string; index: number };
    }
  | {
      type: "add-select-option-translation";
      payload: {
        id: string;
        index: number;
        language: Language.LanguageKey;
      };
    }
  | {
      type: "remove-select-option-translation";
      payload: {
        id: string;
        index: number;
        language: Language.LanguageKey;
      };
    }
  | {
      type: "update-select-option-translation";
      payload: {
        id: string;
        index: number;
        language: Language.LanguageKey;
        value: string;
      };
    };

function reducer(state: State, action: Action) {
  switch (action.type) {
    case "set-form-state": {
      const { form } = action.payload;
      // due to immutable data structures not triggering the reload, have to set each field
      // manually
      state.name = form.name;
      state.created_at = form.created_at;
      state.id = form.id;
      state.updated_at = form.updated_at;
      state.metadata = form.metadata;

      state.fields = [...form.fields];
      break;
    }
    case "add-field": {
      // do something
      const position = state.fields.length + 1;
      const newField: PatientRegistrationForm.Field = {
        id: uuidv1(),
        baseField: false,
        fieldType: "text",
        isSearchField: false,
        column: "",
        label: {
          en: "New Field " + position,
          es: "Nueva Entrada " + position,
          ar: "مدخلات جديدة",
        },
        options: [],
        position: position,
        required: true,
        visible: true,
        deleted: false,
        showsInSummary: false,
      };

      state.fields.push(newField);
      break;
    }
    case "update-field-label": {
      const { label, id, translation } = action.payload;
      const field = state.fields.find((f) => f.id === id);

      if (field) {
        field.label[translation] = label;

        // edit the column name to be the english translation of a field && is not a base field
        // IMPORTANT: never edit a base field. these fields map to the column names in the mobile application
        if (translation === "en" && field.baseField === false) {
          if (field.label["en"].length > 0) {
            field.column = encodeURI(field.label["en"]);
          }
        }

        //update the column name
        // FIXME: Should you be able to update the column name for even base fields?? Probably not!
        // FIXME: Are the column names even needed for the additional fields???
        // field.column = getTranslation(field.label, translation)
      }
      break;
    }
    case "update-field-type": {
      const { id, type } = action.payload;
      const field = state.fields.find((f) => f.id === id);

      if (field) {
        const oldFieldType = field.fieldType;
        field.fieldType = type;

        // if the new field is of type "select", insert a new starting option in the options field
        if (oldFieldType !== "select" && type === "select") {
          field.options.length === 0 &&
            field.options.push({
              en: "",
            });
        } else if (oldFieldType === "select" && type !== "select") {
          // when you leave the select input type, clear the options to reduce the clutter in the stored form
          field.options = [];
        }
      }
      break;
    }
    case "add-select-option": {
      const { id } = action.payload;
      const field = state.fields.find((f) => f.id === id);

      if (field && field.fieldType === "select") {
        field.options.push({ en: "" });
      }
      break;
    }
    case "remove-select-option": {
      const { id, index } = action.payload;
      const field = state.fields.find((f) => f.id === id);

      if (field && field.fieldType === "select") {
        field.options.splice(index, 1);
      }
      break;
    }
    case "add-select-option-translation": {
      const { id, index, language } = action.payload;
      const field = state.fields.find((f) => f.id === id);

      if (field && field.fieldType === "select") {
        field.options.forEach((field, idx) => {
          if (idx === index) {
            field[language] = "";
          }
        });
      }
      break;
    }
    case "remove-select-option-translation": {
      const { id, index, language } = action.payload;
      const field = state.fields.find((f) => f.id === id);

      if (field && field.fieldType === "select") {
        field.options.forEach((field, idx) => {
          if (idx === index) {
            delete field[language];
          }
        });
      }
      break;
    }
    case "update-select-option-translation": {
      const { id, index, language, value } = action.payload;
      const field = state.fields.find((f) => f.id === id);

      if (field && field.fieldType === "select") {
        field.options.forEach((field, idx) => {
          if (idx === index) {
            field[language] = value;
          }
        });
      }
      break;
    }
    case "remove-field": {
      const { id } = action.payload;
      const field = state.fields.find((f) => f.id === id);
      // if there is no field, or if the field is a base field
      if (field === undefined || field?.baseField) return;

      // state.fields = state.fields.filter((field) => field.id !== id);
      // simply marking the field as deleted
      state.fields = state.fields.map((field) => {
        if (field.id === id) {
          return { ...field, deleted: true };
        } else {
          return field;
        }
      });

      break;
    }
    case "restore-field": {
      const { id } = action.payload;
      const field = state.fields.find((f) => f.id === id);
      // if there is no field, or if the field is a base field
      if (field === undefined) return;

      // simply marking the field as *NOT* deleted
      state.fields = state.fields.map((field) => {
        if (field.id === id) {
          return { ...field, deleted: false };
        } else {
          return field;
        }
      });

      break;
    }
    case "change-position": {
      const { id, position } = action.payload;

      // no position is lower than 0
      if (position <= 0) return;

      // no position is greated than the length of the fields
      if (position > state.fields.length) return;

      const field = state.fields.find((f) => f.id === id);

      if (field) {
        // sort all the items in order of their position
        const sorted = sortBy(state.fields, ["position"]);

        // array without the moving field
        const remainingSorted = sorted.filter((f) => f.id !== id);

        // place the field in the new position
        remainingSorted.splice(position - 1, 0, field);
        state.fields = remainingSorted.map((field, idx) => ({
          ...field,
          position: idx + 1,
        }));
      }

      break;
    }
    case "toggle-visibility": {
      const { id } = action.payload;
      const field = state.fields.find((f) => f.id === id);

      if (field) {
        field.visible = !field.visible;
      }
      break;
    }
    case "toggle-field-required": {
      const { id } = action.payload;
      const field = state.fields.find((f) => f.id === id);
      if (field?.baseField) return;

      if (field) {
        field.required = !field.required;
      }
      break;
    }
    case "toggle-field-searchable": {
      const { id } = action.payload;
      const field = state.fields.find((f) => f.id === id);
      if (!field) return;

      field.isSearchField = !field.isSearchField;
      break;
    }
    case "toggle-field-shows-in-summary": {
      const { id } = action.payload;
      const field = state.fields.find((f) => f.id === id);
      if (!field) return;

      field.showsInSummary = !field.showsInSummary;
      break;
    }
  }
}

const defaultEmptyForm: PatientRegistrationForm.T = {
  id: uuidv1(),
  // Remove when the migrating to multiple forms support
  name: Option.some("Patient Registration Form"),
  fields: baseFields,
  metadata: {},
  created_at: new Date(),
  updated_at: new Date(),
  clinic_id: Option.none(),
  is_deleted: false,
  last_modified: new Date(),
  server_created_at: new Date(),
  deleted_at: Option.none(),
};

function RouteComponent() {
  const { patientRegistrationForm } = Route.useLoaderData();
  // initial state is either loaded from the DB or on first deployment its loaded from a local state

  const initialState =
    (patientRegistrationForm as PatientRegistrationForm.T) ?? defaultEmptyForm;

  const [formLanguage, setFormLanguage] = useState<Language.LanguageKey>("en");
  const [state, dispatch] = useImmerReducer(reducer, initialState);
  const [editField, setEditField] = useImmer({
    id: "",
    // language: "en"
  });
  const { fields } = state;
  const [loading, setLoading] = useState(false);
  const deletedFields = useMemo(
    () => fields.filter((f) => f.deleted),
    [fields, fields.length]
  );

  useEffect(() => {
    const handleEsc = (event: any) => {
      if (event.key === "Escape") {
        setEditField((draft) => {
          draft.id = "";
        });
      }
    };
    window.addEventListener("keydown", handleEsc);

    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const submit = async () => {
    if (loading) return;
    const result = registrationFormSchema.safeParse(state);

    let ignoreErrors = false;

    if (!result.success) {
      console.error(result.error);
      if (result.error.errors.find((err) => err.path.includes("options"))) {
        // ther eis an error with one of the options supported for a select field
        return alert(
          "Please make sure all select fields have at least one option"
        );
      } else {
        ignoreErrors = window.confirm(
          "Some fields of the form are incomplete or empty. Are you sure you want to continue?"
        );
      }
    }

    if ((!result.success && ignoreErrors === true) || result.success === true) {
      setLoading(true);

      try {
        const res = await saveForm({ data: state });
        alert("Form saved successfully!");
      } catch (error) {
        console.error("Failed to save form:", error);
        alert("Failed to save the form. Please try again later.");
      } finally {
        setLoading(false);
      }

      return;
    }
  };
  return (
    <div className="mb-14">
      <Select value={formLanguage} onValueChange={setFormLanguage}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select a language" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Languages</SelectLabel>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="ar">Arabic</SelectItem>
            <SelectItem value="es">Spanish</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <div className="max-w-lg space-y-4 pt-6">
        {sortBy(fields, "position")
          .filter((f) => !f.deleted)
          .map((field) => {
            const {
              baseField,
              id,
              label,
              options,
              position,
              fieldType,
              required,
              isSearchField,
              showsInSummary,
            } = field;
            const isInEditMode = editField.id === id;
            const getTranslation = Language.getTranslation;
            const friendlyLang = Language.friendlyLang;
            const inputTypes = ["number", "text", "select", "date", "boolean"];

            return (
              <div
                className={`border rounded p-4 ${
                  isInEditMode ? "border-primary" : "border-border"
                }`}
                key={field.id}
              >
                {fieldType === "select" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {getTranslation(label, formLanguage)}
                      {!field.visible && (
                        <span className="text-muted-foreground"> (hidden)</span>
                      )}
                    </label>
                    <Select
                      value={
                        options.length > 0 && options[0].en
                          ? options[0].en
                          : "placeholder-value"
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        {translationObjectOptions(options, formLanguage).map(
                          (option, index) => (
                            <SelectItem
                              key={index}
                              value={option.value || `option-${index}`}
                            >
                              {option.label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    {required && (
                      <span className="text-xs text-destructive">
                        *Required
                      </span>
                    )}
                  </div>
                )}

                {(fieldType === "text" || fieldType === "number") && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {getTranslation(label, formLanguage)}
                      {!field.visible && (
                        <span className="text-muted-foreground"> (hidden)</span>
                      )}
                    </label>
                    <input
                      type={fieldType}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder={
                        fieldType === "number" ? "0" : "Enter text..."
                      }
                    />
                    {required && (
                      <span className="text-xs text-destructive">
                        *Required
                      </span>
                    )}
                  </div>
                )}

                {field.fieldType === "date" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {getTranslation(label, formLanguage)}
                      {!field.visible && (
                        <span className="text-muted-foreground"> (hidden)</span>
                      )}
                    </label>
                    <input
                      type="date"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="YYYY-MM-DD"
                    />
                    {required && (
                      <span className="text-xs text-destructive">
                        *Required
                      </span>
                    )}
                  </div>
                )}

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

                    {baseField !== true && (
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

                {editField.id === id && (
                  <div className="mt-6 border-t border-border pt-6">
                    <div className="grid grid-cols-12 gap-4">
                      {Object.keys(field.label).map((languageKey) => {
                        return (
                          <React.Fragment key={languageKey}>
                            <div className="col-span-4">
                              <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">
                                  Language
                                </label>
                                <Select value={languageKey || "en"}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="en">English</SelectItem>
                                    <SelectItem value="es">Spanish</SelectItem>
                                    <SelectItem value="ar">Arabic</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="col-span-8">
                              <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">
                                  Field Name
                                </label>
                                <input
                                  type="text"
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  value={getTranslation(label, languageKey)}
                                  onChange={(e) => {
                                    dispatch({
                                      type: "update-field-label",
                                      payload: {
                                        id: id,
                                        label: e.target.value,
                                        translation: languageKey,
                                      },
                                    });
                                  }}
                                />
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}

                      <div className="col-span-12">
                        <div className="space-y-2">
                          <label className="text-sm font-medium leading-none">
                            Field Type
                          </label>
                          <Select
                            value={fieldType || "text"}
                            onValueChange={(value) =>
                              dispatch({
                                type: "update-field-type",
                                payload: {
                                  id,
                                  type: value as PatientRegistrationForm.InputType,
                                },
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {inputTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {fieldType === "select" && (
                        <div className="col-span-12">
                          <div className="space-y-4">
                            <label className="text-sm font-medium leading-none">
                              Options
                            </label>
                            {field.options.map((option, idx) => {
                              return (
                                <div key={idx}>
                                  <div className="grid grid-cols-12 gap-2">
                                    <div className="col-span-11">
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium leading-none">{`Option ${
                                          idx + 1
                                        } (English)`}</label>
                                        <input
                                          type="text"
                                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                          value={option.en}
                                          onChange={({ target: { value } }) =>
                                            dispatch({
                                              type: "update-select-option-translation",
                                              payload: {
                                                id,
                                                index: idx,
                                                language: "en",
                                                value,
                                              },
                                            })
                                          }
                                        />
                                      </div>
                                    </div>
                                    <div className="col-span-1 flex items-end justify-center">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          dispatch({
                                            type: "remove-select-option",
                                            payload: { id, index: idx },
                                          })
                                        }
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="18"
                                          height="18"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          className="lucide lucide-circle-minus"
                                        >
                                          <circle cx="12" cy="12" r="10" />
                                          <path d="M8 12h8" />
                                        </svg>
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="flex gap-2 mt-2">
                                    {!("es" in option) && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          dispatch({
                                            type: "add-select-option-translation",
                                            payload: {
                                              id,
                                              index: idx,
                                              language: "es",
                                            },
                                          })
                                        }
                                      >
                                        + Spanish
                                      </Button>
                                    )}
                                    {!("ar" in option) && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          dispatch({
                                            type: "add-select-option-translation",
                                            payload: {
                                              id,
                                              index: idx,
                                              language: "ar",
                                            },
                                          })
                                        }
                                      >
                                        + Arabic
                                      </Button>
                                    )}
                                  </div>

                                  <div className="pl-8 space-y-2 pb-5">
                                    {Object.keys(option)
                                      .filter((k) => k !== "en")
                                      .map((languageKey) => (
                                        <div
                                          className="grid grid-cols-12 gap-2"
                                          key={languageKey}
                                        >
                                          <div className="col-span-10">
                                            <div className="space-y-2">
                                              <label className="text-sm font-medium leading-none">{`Option ${
                                                idx + 1
                                              } (${friendlyLang(
                                                languageKey
                                              )})`}</label>
                                              <input
                                                type="text"
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                value={option[languageKey]}
                                                onChange={({
                                                  target: { value },
                                                }) =>
                                                  dispatch({
                                                    type: "update-select-option-translation",
                                                    payload: {
                                                      id,
                                                      index: idx,
                                                      language: languageKey,
                                                      value,
                                                    },
                                                  })
                                                }
                                              />
                                            </div>
                                          </div>
                                          <div className="col-span-2 flex items-end">
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() =>
                                                dispatch({
                                                  type: "remove-select-option-translation",
                                                  payload: {
                                                    id,
                                                    index: idx,
                                                    language: languageKey,
                                                  },
                                                })
                                              }
                                              className="text-destructive hover:text-destructive"
                                            >
                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="18"
                                                height="18"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="lucide lucide-circle-minus"
                                              >
                                                <circle
                                                  cx="12"
                                                  cy="12"
                                                  r="10"
                                                />
                                                <path d="M8 12h8" />
                                              </svg>
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              );
                            })}
                            <Button
                              variant="outline"
                              className="w-full mt-2"
                              onClick={() =>
                                dispatch({
                                  type: "add-select-option",
                                  payload: { id },
                                })
                              }
                            >
                              Add Select Option
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="col-span-12 space-y-3">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`visible-${id}`}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={field.visible}
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
                            checked={required}
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
                            checked={isSearchField}
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
                            checked={showsInSummary}
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

                      <div className="col-span-12">
                        <div className="space-y-2">
                          <label className="text-sm font-medium leading-none">
                            Field Position
                          </label>
                          <input
                            type="number"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={position}
                            onChange={(e) =>
                              dispatch({
                                type: "change-position",
                                payload: { id, position: +e.target.value },
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="col-span-12">
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setEditField((draft) => {
                              draft.id = "";
                            });
                          }}
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/** Deleted fields show here */}
      {deletedFields.length > 0 && (
        <div>
          <hr />
          <label>Deleted fields</label>

          {deletedFields.map((field) => {
            return (
              <div className="flex items-center gap-2" key={field.id}>
                <div>
                  <label>
                    {Language.getTranslation(field.label, formLanguage)}
                  </label>
                </div>

                <Button
                  variant="outline"
                  aria-label="Settings"
                  onClick={() =>
                    dispatch({
                      type: "restore-field",
                      payload: { id: field.id },
                    })
                  }
                >
                  Restore
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className=" max-w-lg">
        <div className="flex flex-col gap-4 mt-4">
          <Button
            onClick={() => dispatch({ type: "add-field" })}
            variant="outline"
            className="w-full"
          >
            + Add Field
          </Button>

          <Button
            disabled={loading}
            className="w-full primary"
            onClick={submit}
          >
            {loading ? "Loading ..." : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
Given a translation object, create options for a dropdown

@param {TranslationObject[]} translations
@param {LanguageKey} language
@returns {Array<{label: string, value: string}>}
*/
export function translationObjectOptions(
  translations: Language.TranslationObject[],
  language: Language.LanguageKey
): Array<{ label: string; value: string }> {
  return translations
    .map((t) => Language.getTranslation(t, language))
    .map((st) => ({
      label: st,
      value: st,
    }));
}
