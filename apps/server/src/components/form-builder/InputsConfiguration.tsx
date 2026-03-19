import CreatableSelect from "react-select/creatable";
import { Button } from "@/components/ui/button";
import { useSelector } from "@xstate/store/react";
import eventFormStore from "@/stores/event-form-builder";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LucideGripHorizontal, LucideTrash } from "lucide-react";
import { fieldOptionsUnion, listToFieldOptions } from "@/lib/utils";
import upperFirst from "lodash/upperFirst";
import uniq from "lodash/uniq";
import If from "@/components/if";
import EventForm from "@/models/event-form";
import { Textarea } from "../ui/textarea";
import { SelectInput } from "@/components/select-input";
import { FieldTranslationPanel } from "@/components/form-builder/FieldTranslationPanel";

let YesNoOptions: { value: string; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const measurementOptions: EventForm.MeasurementUnit[] = uniq([
  "cm",
  "m",
  "kg",
  "lb",
  "in",
  "ft",
  "mmHg",
  "cmH2O",
  "mmH2O",
  "°C",
  "°F",
  "BPM",
  "P",
  "mmol/L",
  "mg/dL",
  "%",
  "units",
]);

type InputConfigProps = {
  fields: EventForm.FieldData[];
  onFieldChange: (fieldId: string, key: string, value: any) => void;
  onFieldOptionChange: (
    fieldId: string,
    options: EventForm.FieldOption[],
  ) => void;
  onFieldUnitChange: (
    fieldId: string,
    units: EventForm.DoseUnit[] | false,
  ) => void;
  onRemoveField: (fieldId: string) => void;
  translations?: EventForm.FieldTranslation[];
  primaryLanguage?: string;
  onTranslationChange?: (
    fieldId: string,
    lang: string,
    key: "name" | "description",
    value: string,
  ) => void;
  onOptionTranslationChange?: (
    fieldId: string,
    optionId: string,
    lang: string,
    value: string,
  ) => void;
};

export function InputsConfiguration({
  fields,
  onFieldChange,
  onFieldOptionChange,
  onFieldUnitChange,
  onRemoveField,
  translations = [],
  primaryLanguage = "en",
  onTranslationChange,
  onOptionTranslationChange,
}: InputConfigProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: any) {
    const { active, over } = event;

    if (active.id !== over.id) {
      eventFormStore.send({
        type: "reorder-two-fields",
        payload: { fieldIds: [active.id, over.id] },
      });
    }
  }

  const allFieldNames = fields.map((field) => field.name.trim().toLowerCase());

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-10">
        <SortableContext items={fields} strategy={verticalListSortingStrategy}>
          {fields.map((field) => {
            const fieldNameExists =
              field.name.trim().length > 0 &&
              allFieldNames.filter(
                (allField) => allField === field.name.trim().toLowerCase(),
              ).length > 1;

            const nameErrorMessage = (() => {
              if (fieldNameExists) {
                return "Field name already exists. Names must be unique.";
              } else if (
                EventForm.RESERVED_FIELD_NAMES.includes(
                  field.name.trim().toLowerCase(),
                )
              ) {
                return `${field.name} is reserved.`;
              }
              return null;
            })();
            // Separator: minimal config - just a label and remove button
            if (field.fieldType === "separator") {
              return (
                <SortableItem id={field.id} key={field.id}>
                  <div className="space-y-2 bg-muted/50 p-4 rounded-lg border">
                    <h3 className="text-lg font-bold">Separator Line</h3>
                    <div className="pt-2">
                      <Button
                        onClick={() => onRemoveField(field.id)}
                        variant="outline"
                        color="red"
                        type="button"
                      >
                        <LucideTrash size="1rem" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </SortableItem>
              );
            }

            // Text Display Block: content + size, no name/description/required
            if (field.fieldType === "text") {
              return (
                <SortableItem id={field.id} key={field.id}>
                  <div className="space-y-4 bg-muted/50 p-4 rounded-lg border">
                    <div className="w-full space-y-2">
                      <h3 className="text-lg font-bold">Text Block</h3>
                      <Textarea
                        rows={3}
                        value={field.content ?? ""}
                        onChange={(e) =>
                          onFieldChange(
                            field.id,
                            "content",
                            e.currentTarget.value,
                          )
                        }
                        label="Text Content"
                        placeholder="Enter the text to display"
                      />
                      <SelectInput
                        label="Text Size"
                        value={field.size ?? "md"}
                        onChange={(value) =>
                          value && onFieldChange(field.id, "size", value)
                        }
                        data={[
                          { value: "xxl", label: "XXL" },
                          { value: "xl", label: "XL" },
                          { value: "lg", label: "Large" },
                          { value: "md", label: "Medium" },
                          { value: "sm", label: "Small" },
                        ]}
                      />
                      {onTranslationChange && onOptionTranslationChange && (
                        <FieldTranslationPanel
                          field={field}
                          primaryLanguage={primaryLanguage}
                          translation={EventForm.getFieldTranslation(
                            translations,
                            field.id,
                          )}
                          onTranslationChange={onTranslationChange}
                          onOptionTranslationChange={onOptionTranslationChange}
                        />
                      )}
                      <div className="pt-4">
                        <Button
                          onClick={() => onRemoveField(field.id)}
                          variant="outline"
                          color="red"
                          type="button"
                        >
                          <LucideTrash size="1rem" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                </SortableItem>
              );
            }

            return (
              <SortableItem id={field.id} key={field.id}>
                <div className="space-y-4 bg-muted/50 p-4 rounded-lg border">
                  <div className="w-full space-y-2">
                    <h3 className="text-lg font-bold">
                      {upperFirst(field?.fieldType ?? field.inputType)} Input
                    </h3>
                    <Input
                      label={"Name"}
                      value={field.name}
                      onChange={(e) =>
                        onFieldChange(field.id, "name", e.currentTarget.value)
                      }
                      error={nameErrorMessage}
                    />
                    <Input
                      label="Description (Optional)"
                      value={field.description}
                      onChange={(e) =>
                        onFieldChange(
                          field.id,
                          "description",
                          e.currentTarget.value,
                        )
                      }
                    />
                    <p className="text-muted-foreground text-sm">
                      Type: {field.inputType}
                    </p>

                    {/* IF the field type is medicine, then show the textarea for medication options the doctor can choose from. This is optional. */}
                    <If show={field.fieldType === "medicine"}>
                      <Textarea
                        rows={4}
                        value={field.options?.join("; ") || " "}
                        onChange={(e) =>
                          onFieldOptionChange(
                            field.id,
                            e.currentTarget.value
                              .replaceAll("  ", " ")
                              .split(";"),
                            // Filtering is ideal to remove empty strings but prevents entry of semi colon. Have to do trims and filters in the submission
                            // .map((opt) => opt.trim()),
                            // .filter((option) => option.trim() !== ""),
                          )
                        }
                        label="Medication options, separated by semicolon (;)"
                        placeholder="Enter the options - Leave empty if not applicable"
                      />
                    </If>

                    {/* IF the field type is a select, dropdown, checkbox, or radio, then show the options input */}
                    <If
                      show={
                        ["select", "dropdown", "checkbox", "radio"].includes(
                          field.inputType,
                        ) && field.fieldType !== "diagnosis"
                      }
                    >
                      <div className="py-4">
                        <p className="text-sm">Add Options</p>
                        <CreatableSelect
                          value={field.options}
                          isMulti
                          isSearchable
                          onChange={(newValue, _) =>
                            onFieldOptionChange(field.id, newValue)
                          }
                          name="colors"
                          options={fieldOptionsUnion(
                            YesNoOptions,
                            field.options || [],
                          )}
                        />
                      </div>
                    </If>

                    {field.inputType === "number" && (
                      <Checkbox
                        onClick={(e) =>
                          onFieldUnitChange(
                            field.id,
                            e.currentTarget.value === "on"
                              ? listToFieldOptions(measurementOptions)
                              : false,
                          )
                        }
                        value={
                          field.units && field.units.length > 0 ? "on" : "off"
                        }
                        label="Has Units"
                      />
                    )}

                    {field.inputType === "select" && (
                      <Checkbox
                        onClick={(e) =>
                          onFieldChange(
                            field.id,
                            "multi",
                            e.currentTarget.value === "on" ? false : true,
                          )
                        }
                        value={field.multi ? "on" : "off"}
                        checked={field.multi}
                        label="Supports multiple options"
                      />
                    )}

                    <Checkbox
                      onCheckedChange={(checked) =>
                        onFieldChange(field.id, "required", checked)
                      }
                      checked={field.required}
                      label="Required Field"
                    />

                    {onTranslationChange && onOptionTranslationChange && (
                      <FieldTranslationPanel
                        field={field}
                        primaryLanguage={primaryLanguage}
                        translation={EventForm.getFieldTranslation(
                          translations,
                          field.id,
                        )}
                        onTranslationChange={onTranslationChange}
                        onOptionTranslationChange={onOptionTranslationChange}
                      />
                    )}

                    <div className="pt-4">
                      <Button
                        onClick={() => onRemoveField(field.id)}
                        variant="outline"
                        color="red"
                        type="button"
                      >
                        <LucideTrash size="1rem" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </SortableItem>
            );
          })}
        </SortableContext>
      </div>
    </DndContext>
  );
}

function SortableItem(props: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        {...listeners}
        className="flex items-center content-center justify-center cursor-move -mb-2"
      >
        <LucideGripHorizontal
          className="text-muted-foreground self-center"
          color="var(--foreground)"
          size="1rem"
        />
      </div>
      {props.children}
    </div>
  );
}
