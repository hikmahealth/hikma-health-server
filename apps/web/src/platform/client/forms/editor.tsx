import { useImmer } from "use-immer";
import {
  useFormBuildContext,
  useFormBuildDispatch,
  useFormBuildFieldByIndex,
  useFormBuildFields,
} from "./context";
import { FormField, SelectFormField } from "./types";
import { Button } from "@hh/ui/components/button";
import { ButtonGroup } from "@hh/ui/components/button-group";
import { FormFieldInput, FormFieldLabel } from "./components";
import {
  friendlyLang,
  getTranslation,
  SUPPORTED_LANGUAGES,
} from "@/platform/common/languages";
import React, { ChangeEvent, useCallback, useMemo } from "react";
import { Input } from "@hh/ui/components/input";
import { CircleMinusIcon } from "lucide-react";

const EditFieldComponent = ({
  id,
  index,
  edit,
  onEditValueChange,
}: {
  id: string;
  index: number;
  edit?: boolean;
  onEditValueChange: (edit: boolean) => void;
}) => {
  const field = useFormBuildFieldByIndex(index);
  const dispatch = useFormBuildDispatch();

  return (
    <div
      data-mode={edit ? "edit" : "view"}
      className={"border rounded-lg p-4 data-[mode=edit]:border-primary"}
    >
      {/* Form controls */}
      <ButtonGroup>
        <Button
          variant="outline"
          onClick={() => onEditValueChange(!edit)}
          size="sm"
        >
          {!edit ? "Edit Field" : "Cancel Edit"}
        </Button>

        {!field.required && (
          <Button
            variant="outline"
            onClick={() =>
              dispatch({
                type: "remove-field",
                payload: { index },
              })
            }
            size="sm"
          >
            Remove
          </Button>
        )}
      </ButtonGroup>

      {/* Would render the component as how it would appear on the form */}
      <div className="space-y-2">
        <FormFieldLabel label={field.label} visible={field.visible} />
        <FormFieldInput field={field} />
        {field.required && (
          <span className="text-xs text-destructive">*Required</span>
        )}
      </div>

      {/* To edit the labels */}
      <EditSelectLabelOption index={index} />

      {/*{edit && <EditFieldOption field={field} />}*/}

      {/* Edit options - only available in form editor mode */}
      {edit && (
        <EditableFieldOptions
          key={id}
          id={id}
          field={field}
          onChangeFieldConfiguration={(config) => {
            dispatch({
              type: "field/set-state",
              payload: {
                id,
                set: config,
              },
            });
          }}
        />
      )}
    </div>
  );
};

/**
 * Used to contain information needed to manage details for when the form needs to change
 */
export function FormEditor({ className }: { className?: string }) {
  const [editField, setEditField] = useImmer({
    id: "",
  });

  const fields = useFormBuildFields();

  return (
    <div className={className}>
      {fields.map((id, index) => (
        <EditFieldComponent
          key={id}
          id={id}
          index={index}
          edit={editField.id === id}
          onEditValueChange={(v) =>
            v ? setEditField({ id }) : setEditField({ id: "" })
          }
        />
      ))}
    </div>
  );
}

const renders: Record<string, number> = {};

const SelectFieldOption = ({
  opts: translations,
  index,
  fieldId,
}: {
  opts;
  index;
  fieldId: string;
}) => {
  const dispatch = useFormBuildDispatch();

  function Render({
    lang,
    text,
  }: {
    lang: string;
    text: string;
    value?: string;
    onChange?: (value: string) => void;
  }) {
    // renders[index + lang] = (renders[index + lang] ?? 0) + 1;
    // console.log(index + lang, " renders ", renders[index + lang]);
    const t = useMemo(() => getTranslation(translations, lang), [lang]);
    const onChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) =>
        dispatch({
          type: "field/select/set-label-option",
          payload: {
            id: fieldId,
            optionIndex: index,
            set: { [lang]: e.target.value },
          },
        }),
      [dispatch],
    );

    return (
      <div className="not-first:ml-6 w-full">
        <label>
          Option {index + 1} ({text})
        </label>
        <div className="flex flex-row w-full">
          <Input className="flex-1" defaultValue={t} onChange={onChange} />
          <Button variant={"ghost"} size="icon-sm">
            <CircleMinusIcon />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {SUPPORTED_LANGUAGES.map((lang, index) => {
        return (
          <Render
            key={`${lang}-${index}`}
            lang={lang}
            text={friendlyLang(lang)}
          />
        );
      })}
    </div>
  );
};

function EditSelectLabelOption({ index }: { index: number }) {
  const field = useFormBuildFieldByIndex(index);
  if (field.fieldType !== "select") {
    return null;
  }

  return (
    <React.Fragment>
      {field.options.map((opts, index) => (
        <SelectFieldOption
          fieldId={field.id}
          opts={opts}
          index={index}
          key={`${field.column}-${index}`}
        />
      ))}
    </React.Fragment>
  );
}

type EditableFieldOption = Pick<
  FormField,
  "visible" | "showsInSummary" | "isSearchField" | "required"
>;
function EditableFieldOptions({
  field,
  id,
  onChangeFieldConfiguration,
}: {
  id: string;
  field: FormField;
  onChangeFieldConfiguration: (config: Partial<EditableFieldOption>) => void;
}) {
  return (
    <div>
      <div className="col-span-12 space-y-3">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id={`visible-${id}`}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            defaultChecked={field.visible}
            onChange={(e) =>
              onChangeFieldConfiguration({ visible: e.target.checked })
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
            defaultChecked={field.required}
            onChange={(e) =>
              onChangeFieldConfiguration({ required: e.target.checked })
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
            defaultChecked={field.isSearchField}
            onChange={(e) =>
              onChangeFieldConfiguration({ isSearchField: e.target.checked })
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
            defaultChecked={field.showsInSummary}
            onChange={(e) =>
              onChangeFieldConfiguration({ showsInSummary: e.target.checked })
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
}
