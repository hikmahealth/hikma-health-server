import { DiagnosisSelect } from "@/components/form-builder/DiagnosisPicker";
import { MedicineInput } from "@/components/form-builder/MedicineInput";
import { Select } from "@/components/ui/select";
import { DatePickerInput } from "@/components/date-picker-input";
import { Input } from "@/components/ui/input";
import { deduplicateOptions } from "@/lib/utils";
import {
  Calendar,
  ListTodo,
  Pill,
  FileText,
  NotebookPen,
  Hash,
  TextCursor,
  Stethoscope,
} from "lucide-react";
import { OptionsInput } from "./components/input";
import {
  type TextField,
  createDateField,
  createDiagnosisField,
  createMedicineField,
  createOptionsField,
  createTextField,
  fieldFile,
} from "./fields";
import { createComponent } from "./utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const FreeTextInput = function ({ field }: { field: TextField }) {
  const inputProps = {
    // @ts-expect-error
    placeholder: field?.placeholder,
    label: field.name,
    description: field.description,
    required: field.required,
    // value: field.value,
  };

  switch (field.inputType) {
    case "textarea":
      return <Textarea rows={4} {...inputProps} />;
    case "number": {
      // @ts-expect-error
      const units = field?.units ?? [];
      const hasUnits = units && units.length > 0;
      const dedupUnits = deduplicateOptions(units);
      return (
        <div className={`flex flex-row ${hasUnits ? "space-x-4" : ""}`}>
          <div className="flex-1">
            {" "}
            <Input type="number" {...inputProps} />
            {hasUnits && (
              <>
                <Label htmlFor="units">Units</Label>
                <Select name="units" options={dedupUnits} {...inputProps} />
              </>
            )}
          </div>
        </div>
      );
    }
    case "text":
    default:
      return <Input {...inputProps} />;
  }
};

// List of components a user can use to build
// forms
const ComponentRegistry = [
  createComponent(createTextField(), {
    label: "Text",
    icon: <TextCursor />,
    render: FreeTextInput,
  }),
  createComponent(createTextField({ inputType: "textarea" }), {
    label: "Text Long",
    icon: <NotebookPen />,
    render: FreeTextInput,
  }),
  createComponent(createTextField({ name: "Number", inputType: "number" }), {
    label: "Number",
    icon: <Hash />,
    render: FreeTextInput,
  }),
  createComponent(createDateField(), {
    label: "Date",
    icon: <Calendar />,
    render: function ({ field }) {
      return (
        <DatePickerInput
          // valueFormat="YYYY MMM DD"
          // description={field.description}
          label={field.name}
          // required={field.required}
          placeholder="Pick date"
          // mx="auto"
        />
      );
    },
  }),
  // @ts-expect-error
  createComponent(createOptionsField({ inputType: "radio" }), {
    label: "Options",
    icon: <ListTodo />,
    render: OptionsInput,
  }),

  // @ts-expect-error
  createComponent(createOptionsField({ inputType: "select", multi: true }), {
    label: "Select / Dropdown",
    icon: <ListTodo />,
    render: OptionsInput,
  }),
  // @ts-expect-erro
  createComponent(createMedicineField(), {
    label: "Medicine",
    icon: <Pill />,
    render: MedicineInput,
  }),
  // @ts-expect-error
  createComponent(createDiagnosisField(), {
    label: "Diagnosis",
    icon: <Stethoscope />,
    render: DiagnosisSelect,
  }),
  createComponent(fieldFile(), {
    label: "File",
    icon: <FileText />,
    render: function ({ field }) {
      return (
        <div className="grid w-full items-center gap-3">
          <Label htmlFor={field.name}>{field.name}</Label>
          <Input
            id={field.name}
            type="file"
            accept={
              field.allowedMimeTypes
                ? field.allowedMimeTypes.join(",")
                : undefined
            }
            multiple={field.multiple}
            required={field.required}
            aria-description={field.description}
          />
          {field.description && (
            <p className="text-sm text-muted-foreground">{field.description}</p>
          )}
        </div>
      );
    },
  }),
];

export default ComponentRegistry;
