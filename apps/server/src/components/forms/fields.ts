import { nanoid } from "nanoid";
import type { InputType } from "./domain";

const MIME_IMAGE_TYPES = ["image/png", "image/jpeg"] as const;
const MIME_DOCUMENT_TYPES = ["application/pdf"] as const;

const ALL_MIME_TYPES = [...MIME_IMAGE_TYPES, ...MIME_DOCUMENT_TYPES];
type SupportedMIMEType = (typeof ALL_MIME_TYPES)[number];

type FieldOption = {
  label: string;
  value: string;
  options?: FieldOption[];
};

/**
 * Description of a field that accepts a file as input
 * @param opts
 * @returns
 */
export const fieldFile = function (
  opts: Partial<
    {
      name: string;
      description: string;
      fileType: "image" | "documents" | "all";
    } & (
      | {
          allowMultiple: false;
        }
      | { allowMultiple: true; max: number; min: number }
    )
  > = {}
) {
  let [minItems, maxItems] = [1, 1];

  if (opts.allowMultiple) {
    [minItems, maxItems] = [opts.min ?? 1, opts.max ?? 1];
    if (!(minItems <= maxItems)) {
      throw new Error(
        "invalid component types. `min` can not be greater than `max`."
      );
    }
  }

  let allowedMimeTypes: SupportedMIMEType[] | null = null;
  if (opts.fileType) {
    if (opts.fileType === "image") {
      // @ts-ignore readonly array
      allowedMimeTypes = MIME_IMAGE_TYPES;
    }

    if (opts.fileType === "documents") {
      // @ts-ignore readonly array
      allowedMimeTypes = MIME_DOCUMENT_TYPES;
    }

    if (opts.fileType === "all") {
      allowedMimeTypes = ALL_MIME_TYPES;
    }
  }

  // NOTE: depending on how this goes, we might as well just have `zod`.
  //  I think it's a good ideal to ensure the types can be validated on a JS level,
  //
  // Optionally, You can use information from `InputType` and `FieldType`
  return {
    id: nanoid(),
    name: opts.name ?? "",
    description: opts.description ?? "",
    required: true,
    fieldType: "file" as "file" | "image",
    inputType: "file" as const,
    allowedMimeTypes: allowedMimeTypes,
    multiple: opts?.allowMultiple ?? true,
    minItems: minItems,
    maxItems: maxItems,
  };
};

export type FileField = ReturnType<typeof fieldFile>;

export function createTextField(
  opts?: Partial<{
    name: string;
    description: string;
    inputType: InputType;
  }>
) {
  const _type = opts?.inputType ?? "text";
  let length: "long" | "short";
  switch (_type) {
    case "textarea": {
      length = "long";
      break;
    }
    default: {
      length = "short";
      break;
    }
  }

  return {
    id: nanoid(),
    fieldType: "free-text" as const,
    inputType: _type,
    name: opts?.name ?? "",
    description: opts?.description ?? "",
    required: false,
    length: length,
  };
}

export type TextField = ReturnType<typeof createTextField>;

export function createMedicineField(opts?: {
  name: string;
  description: string;
  options: string[] | FieldOption[];
}) {
  return {
    id: nanoid(),
    name: opts?.name ?? "Medicine",
    description: opts?.description ?? "",
    inputType: "input-group" as const,
    required: true,
    fieldType: "medicine" as const,
    options: opts?.options ?? [],
    fields: {
      name: createTextField({
        name: "Name",
        description: "Name of the medicine",
      }),
      route: createOptionsField({
        name: "Route",
        description: "Route of the medicine",
        inputType: "dropdown",
        options: [
          "Oral",
          "Intravenous",
          "Intramuscular",
          "Subcutaneous",
          "Topical",
          "Inhalation",
          "Rectal",
          "Ophthalmic",
          "Otic",
          "Nasal",
          "Intranasal",
          "Intradermal",
          "Intraosseous",
          "Intraperitoneal",
          "Intrathecal",
          "Intracardiac",
          "Intracavernous",
          "Intracerebral",
          "Intracere",
        ],
      }),
      form: createOptionsField({
        name: "Form",
        description: "Form of the medication",
        inputType: "dropdown",
        options: [
          "Tablet",
          "Capsule",
          "Liquid",
          "Powder",
          "Suppository",
          "Inhaler",
          "Patch",
          "Cream",
          "Gel",
          "Ointment",
          "Lotion",
          "Drops",
          "Spray",
          "Syrup",
          "Suspension",
          "Injection",
          "Implant",
          "Implantable pump",
          "Implantable reservoir",
          "Implantable infusion system",
          "Implantable drug delivery system",
          "Implantable drug d",
        ],
      }),
      dose: createTextField({
        name: "Dose",
        description: "Dose of the medicine",
      }),
      doseUnits: createOptionsField({
        name: "Dosage Units",
        description: "Units for the dosage",
        inputType: "dropdown",
        options: ["mg", "g", "ml", "l"],
      }),
      frequency: createTextField({
        name: "Frequency",
        description: "Frequency of the medicine",
      }),
      intervals: createTextField({
        name: "Intervals",
        description: "Intervals of the medicine",
      }),
      duration: createTextField({
        name: "Duration",
        description: "Duration of the medicine",
      }),
      durationUnits: createOptionsField({
        name: "Duration Units",
        description: "Units for the duration",
        inputType: "dropdown",
        options: ["hours", "days", "weeks", "months", "years"],
      }),
    },
  };
}

export const createOptionsField = <TOptions extends string | FieldOption>(
  opts?: Partial<
    {
      name: string;
      description: string;
      options: TOptions[];
    } & (
      | {
          inputType: "checkbox" | "select";
          multi: boolean;
        }
      | { inputType: "radio" | "dropdown" }
    )
  >
) => {
  const _type = opts?.inputType ?? "radio";

  return {
    id: nanoid(),
    name: opts?.name ?? "",
    description: opts?.description ?? "",
    inputType: _type,
    required: true,
    fieldType: "options" as const,

    // @ts-expect-error
    multi: _type == "radio" ? false : Boolean(opts?.multi),
    options: opts?.options ?? [],
  };
};

export type OptionField = ReturnType<typeof createOptionsField>;

export const createDiagnosisField = (
  opts?: Partial<{
    name: string;
    description: string;
    options: FieldOption;
  }>
) => {
  return {
    id: nanoid(),
    name: opts?.name ?? "Diagnosis",
    description: opts?.description ?? "",
    inputType: "dropdown" as const,
    required: true,
    fieldType: "diagnosis" as const,
    options: opts?.options ?? [],
  };
};

export type DiagnosisField = ReturnType<typeof createDiagnosisField>;

export const createDateField = (
  opts?: Partial<{ name: string; description: string }>
) => {
  return {
    id: nanoid(),
    name: opts?.name ?? "Date",
    description: opts?.description ?? "",
    inputType: "date" as const,
    required: true,
    fieldType: "date" as const,
  };
};

export type DateField = ReturnType<typeof createDateField>;
