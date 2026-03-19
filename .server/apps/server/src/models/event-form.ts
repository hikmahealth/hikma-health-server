import { Data, Either, Match, Schema } from "effect";
import type {
  ColumnType,
  Generated,
  Selectable,
  Insertable,
  Updateable,
  JSONColumnType,
} from "kysely";
import { sql } from "kysely";
import { createServerOnlyFn } from "@tanstack/react-start";
import { safeJSONParse } from "@/lib/utils";
import db from "@/db";
import { v1 as uuidV1 } from "uuid";
import Language from "@/models/language";
import { nanoid } from "nanoid";

namespace EventForm {
  // export type T = {
  //   id: string;
  //   name: Option.Option<string>;
  //   description: Option.Option<string>;
  //   language: string;
  //   is_editable: boolean;
  //   is_snapshot_form: boolean;
  //   form_fields: any[];
  //   metadata: Record<string, any>;
  //   is_deleted: boolean;
  //   created_at: Date;
  //   updated_at: Date;
  //   last_modified: Date;
  //   server_created_at: Date;
  //   deleted_at: Option.Option<Date>;
  // };

  export namespace Table {
    export const name = "event_forms";
    export const mobileName = "event_forms";
    export const columns = {
      id: "id",
      name: "name",
      description: "description",
      language: "language",
      is_editable: "is_editable",
      is_snapshot_form: "is_snapshot_form",
      form_fields: "form_fields",
      metadata: "metadata",
      clinic_ids: "clinic_ids",
      translations: "translations",
      is_deleted: "is_deleted",
      created_at: "created_at",
      updated_at: "updated_at",
      last_modified: "last_modified",
      server_created_at: "server_created_at",
      deleted_at: "deleted_at",
    };

    export interface T {
      id: string;
      name: string | null;
      description: string | null;
      language: Generated<string>;
      is_editable: Generated<boolean>;
      is_snapshot_form: Generated<boolean>;
      form_fields: JSONColumnType<any[]>;
      metadata: JSONColumnType<Record<string, any>>;
      clinic_ids: JSONColumnType<string[]>;
      translations: Generated<JSONColumnType<FieldTranslation[]>>;
      is_deleted: Generated<boolean>;
      created_at: Generated<ColumnType<Date, string | undefined, never>>;
      updated_at: Generated<
        ColumnType<Date, string | undefined, string | undefined>
      >;
      last_modified: Generated<ColumnType<Date, string | undefined, never>>;
      server_created_at: Generated<ColumnType<Date, string | undefined, never>>;
      deleted_at: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
    }

    export type EventForms = Selectable<T>;
    export type NewEventForms = Insertable<T>;
    export type EventFormsUpdate = Updateable<T>;
  }

  export const RESERVED_FIELD_NAMES = ["diagnosis", "medicine"];

  // ==============

  // INPUT TYPES FOR CUSTOM FORMS & WORKFLOWS
  export type InputType =
    | "text"
    | "textarea"
    | "number"
    | "email"
    | "password"
    | "date"
    | "time"
    | "datetime"
    | "checkbox"
    | "radio"
    | "select"
    | "file"
    | "image"
    | "url"
    | "tel"
    | "color"
    | "range"
    | "hidden"
    | "submit"
    | "reset"
    | "button"
    | "search"
    | "month"
    | "week"
    | "datetime-local"
    | "custom";

  export type FieldType =
    | "binary"
    | "medicine"
    | "diagnosis"
    | "dosage"
    | "free-text"
    | "input-group"
    | "file"
    | "options"
    | "date"
    | "text"
    | "separator"
    | "custom";

  export const textDisplaySizes = ["xxl", "xl", "lg", "md", "sm"] as const;
  export type TextDisplaySize = (typeof textDisplaySizes)[number];

  export interface HHFieldBase {
    id: string;
    name: string;
    description: string;
    required: boolean;
  }

  export const durationUnits = [
    "hours",
    "days",
    "weeks",
    "months",
    "years",
  ] as const;
  export type DurationUnit = (typeof durationUnits)[number];

  export const measurementUnits = [
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
  ] as const;
  export type MeasurementUnit = (typeof measurementUnits)[number];

  export const doseUnits = ["mg", "g", "mcg", "mL", "L", "units"] as const;
  export type DoseUnit = (typeof doseUnits)[number];

  export const medicineRoutes = [
    "oral",
    "sublingual",
    "rectal",
    "topical",
    "inhalation",
    "intravenous",
    "intramuscular",
    "intradermal",
    "subcutaneous",
    "nasal",
    "ophthalmic",
    "otic",
    "vaginal",
    "transdermal",
    "other",
  ] as const;
  export type MedicineRoute = (typeof medicineRoutes)[number];

  export const medicineForms = [
    "tablet",
    "syrup",
    "ampule",
    "suppository",
    "cream",
    "drops",
    "bottle",
    "spray",
    "gel",
    "lotion",
    "inhaler",
    "capsule",
    "injection",
    "patch",
    "other",
  ] as const;
  export type MedicineForm = (typeof medicineForms)[number];

  export type FieldOption = {
    id?: string;
    label: string;
    value: string;
  };

  // ============== TRANSLATIONS ==============

  /** Sentinel field IDs for form-level translations */
  export const FORM_NAME_FIELD_ID = "__form_name__";
  export const FORM_DESCRIPTION_FIELD_ID = "__form_description__";

  export type FieldTranslation = {
    fieldId: string;
    name: Language.TranslationObject;
    description: Language.TranslationObject;
    options: Record<string, Language.TranslationObject>;
    createdAt: string;
    updatedAt: string;
  };

  /** Get the translation ID for an option, falling back to value for old data without IDs */
  export function getOptionId(option: FieldOption): string {
    return option.id ?? option.value;
  }

  /** Add nanoid IDs to any options that are missing them. Idempotent. */
  export function ensureOptionIds(fields: any[]): any[] {
    return fields.map((field) => {
      if (!field.options || !Array.isArray(field.options)) return field;
      const options = field.options.map((opt: any) => {
        if (typeof opt === "string") return opt;
        return opt.id ? opt : { ...opt, id: nanoid() };
      });
      return { ...field, options };
    });
  }

  /** Find the translation entry for a given fieldId */
  export function getFieldTranslation(
    translations: FieldTranslation[],
    fieldId: string,
  ): FieldTranslation | undefined {
    return translations.find((t) => t.fieldId === fieldId);
  }

  /** Upsert a translation value for a field's name or description */
  export function upsertFieldTranslation(
    translations: FieldTranslation[],
    fieldId: string,
    lang: string,
    key: "name" | "description",
    value: string,
  ): FieldTranslation[] {
    const now = new Date().toISOString();
    const existing = translations.find((t) => t.fieldId === fieldId);
    if (existing) {
      return translations.map((t) =>
        t.fieldId === fieldId
          ? { ...t, [key]: { ...t[key], [lang]: value }, updatedAt: now }
          : t,
      );
    }
    const entry: FieldTranslation = {
      fieldId,
      name: {} as Language.TranslationObject,
      description: {} as Language.TranslationObject,
      options: {},
      createdAt: now,
      updatedAt: now,
    };
    entry[key] = { [lang]: value } as Language.TranslationObject;
    return [...translations, entry];
  }

  /** Upsert a translation value for a specific option within a field */
  export function upsertOptionTranslation(
    translations: FieldTranslation[],
    fieldId: string,
    optionId: string,
    lang: string,
    value: string,
  ): FieldTranslation[] {
    const now = new Date().toISOString();
    const existing = translations.find((t) => t.fieldId === fieldId);
    if (existing) {
      return translations.map((t) => {
        if (t.fieldId !== fieldId) return t;
        const optTranslation =
          t.options[optionId] ?? ({} as Language.TranslationObject);
        return {
          ...t,
          options: {
            ...t.options,
            [optionId]: { ...optTranslation, [lang]: value },
          },
          updatedAt: now,
        };
      });
    }
    const entry: FieldTranslation = {
      fieldId,
      name: {} as Language.TranslationObject,
      description: {} as Language.TranslationObject,
      options: { [optionId]: { [lang]: value } as Language.TranslationObject },
      createdAt: now,
      updatedAt: now,
    };
    return [...translations, entry];
  }

  /** Remove translation entries for a given fieldId */
  export function removeFieldTranslation(
    translations: FieldTranslation[],
    fieldId: string,
  ): FieldTranslation[] {
    return translations.filter((t) => t.fieldId !== fieldId);
  }

  export type BinaryField = HHFieldBase & {
    fieldType: "binary";
    inputType: "checkbox" | "radio" | "select";
    options: FieldOption[];
  };

  export type OptionsField = HHFieldBase &
    (
      | {
          fieldType: "options";
          inputType: "radio";
          multi: false;
          options: FieldOption[];
        }
      | {
          fieldType: "options";
          inputType: "checkbox" | "select";
          multi: boolean;
          options: FieldOption[];
        }
    );

  export type DiagnosisField = HHFieldBase & {
    fieldType: "diagnosis";
    inputType: "select";
    options: FieldOption[];
  };

  export type TextField = HHFieldBase &
    (
      | {
          fieldType: "free-text";
          inputType: "text" | "number" | "email" | "password" | "tel";
          length: "short";
          units?: DoseUnit[] | DurationUnit[];
        }
      | {
          fieldType: "free-text";
          inputType: "textarea";
          length: "long";
          units?: DoseUnit[] | DurationUnit[];
        }
    );

  export type MedicineFieldOptions = string[] | FieldOption[];

  export type MedicineField = HHFieldBase & {
    fieldType: "medicine";
    inputType: "input-group";
    options: MedicineFieldOptions;
    fields: {
      name: TextField;
      route: MedicineRoute;
      form: MedicineForm;
      frequency: TextField;
      intervals: TextField;
      dose: TextField;
      doseUnits: DoseUnit;
      duration: TextField;
      durationUnits: DurationUnit;
    };
  };

  type MedicationEntry = {
    name: string;
    route: MedicineRoute;
    form: MedicineForm;
    frequency: number;
    intervals: number;
    dose: number;
    doseUnits: DoseUnit;
    duration: number;
    durationUnits: DurationUnit;
  };

  export type DateField = HHFieldBase & {
    fieldType: "date";
    inputType: "date";
    min?: Date;
    max?: Date;
  };

  export type HHField =
    | BinaryField
    | TextField
    | MedicineField
    | DiagnosisField
    | DateField
    | OptionsField;
  // | FileField;

  export const BaseFieldSchema = Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    description: Schema.String,
    required: Schema.Boolean,
  });

  export class BinaryField2 extends Data.TaggedClass("binary")<
    {
      inputType: "checkbox" | "radio" | "select";
      options: FieldOption[];
    } & HHFieldBase
  > {}

  export class TextField2 extends Data.TaggedClass("free-text")<
    {
      inputType: "text" | "number" | "email" | "password" | "tel";
      length: "short" | "long";
      units: DoseUnit[] | DurationUnit[];
    } & HHFieldBase
  > {}

  export class MedicineField2 extends Data.TaggedClass("medicine")<
    {
      inputType: "input-group";
      options: MedicineFieldOptions;
      fields: {
        name: string;
        route: string[];
        form: string[];
        frequency: string;
        intervals: string;
        dose: string;
        doseUnits: DoseUnit[];
        duration: string;
        durationUnits: DurationUnit[];
      };
    } & HHFieldBase
  > {}

  export class DiagnosisField2 extends Data.TaggedClass("diagnosis")<
    {
      inputType: "select";
      options: FieldOption[];
    } & HHFieldBase
  > {}

  export class DateField2 extends Data.TaggedClass("date")<
    {
      inputType: "date";
    } & HHFieldBase
  > {}

  export class OptionsField2 extends Data.TaggedClass("options")<
    {
      inputType: "radio" | "checkbox" | "select";
      multi: boolean;
      options: FieldOption[];
    } & HHFieldBase
  > {}

  export class FileField2 extends Data.TaggedClass("file")<
    {
      // NOTE: need to keep in mind old usage had a union of "file" | "image"
      // fieldType: "file" | "image";
      inputType: "file";
      allowedMimeTypes:
        | ("image/png" | "image/jpeg" | "application/pdf")[]
        | null;
      multiple: boolean;
      minItems: number;
      maxItems: number;
    } & HHFieldBase
  > {}

  export class TextDisplayField2 extends Data.TaggedClass("text")<
    {
      content: string;
      size: TextDisplaySize;
    } & HHFieldBase
  > {}

  export class SeparatorField2 extends Data.TaggedClass(
    "separator",
  )<HHFieldBase> {}

  export const FieldOptionSchema = Schema.Struct({
    id: Schema.optional(Schema.String),
    label: Schema.String,
    value: Schema.String,
  });

  export const createFieldSchema = <T extends string, A, I, R>(
    tag: T,
    specific: Schema.Schema<A, I, R>,
  ) =>
    Schema.Struct({
      _tag: Schema.Literal(tag),
      fieldType: Schema.Literal(tag),
    }).pipe(Schema.extend(specific), Schema.extend(BaseFieldSchema));

  // Given a fieldType and inputType, return the appropriate _tag field
  export const getFieldTag = (fieldType: Field["fieldType"]): Field["_tag"] => {
    return Match.value(fieldType).pipe(
      Match.when("binary", () => "binary"),
      Match.when("free-text", () => "free-text"),
      Match.when("medicine", () => "medicine"),
      Match.when("diagnosis", () => "diagnosis"),
      Match.when("date", () => "date"),
      Match.when("file", () => "file"),
      Match.when("options", () => "options"),
      Match.when("text", () => "text"),
      Match.when("separator", () => "separator"),
      Match.exhaustive,
    ) as Field["_tag"];
  };

  export const BinaryFieldSchema = createFieldSchema(
    "binary",
    Schema.Struct({
      inputType: Schema.Union(
        Schema.Literal("checkbox"),
        Schema.Literal("radio"),
        Schema.Literal("select"),
      ),
      options: Schema.Array(FieldOptionSchema),
    }),
  );

  export const TextFieldSchema = createFieldSchema(
    "free-text",
    Schema.Struct({
      inputType: Schema.Union(
        Schema.Literal("text"),
        Schema.Literal("number"),
        Schema.Literal("email"),
        Schema.Literal("password"),
        Schema.Literal("tel"),
      ),
      length: Schema.Union(Schema.Literal("short"), Schema.Literal("long")),
      units: Schema.Array(
        Schema.Union(
          Schema.Literal("mg"),
          Schema.Literal("g"),
          Schema.Literal("mcg"),
          Schema.Literal("mL"),
          Schema.Literal("L"),
          Schema.Literal("units"),
        ),
      ),
    }),
  );
  export const MedicineFieldSchema = createFieldSchema(
    "medicine",
    Schema.Struct({
      inputType: Schema.Literal("input-group"),
      options: Schema.Array(FieldOptionSchema),
      fields: Schema.Struct({
        name: Schema.NonEmptyString,
        route: Schema.Array(
          Schema.Union(
            Schema.Literal("oral"),
            Schema.Literal("sublingual"),
            Schema.Literal("rectal"),
            Schema.Literal("topical"),
            Schema.Literal("inhalation"),
            Schema.Literal("intravenous"),
            Schema.Literal("intramuscular"),
            Schema.Literal("intradermal"),
            Schema.Literal("subcutaneous"),
            Schema.Literal("nasal"),
            Schema.Literal("ophthalmic"),
            Schema.Literal("otic"),
            Schema.Literal("vaginal"),
            Schema.Literal("transdermal"),
            Schema.Literal("other"),
          ),
        ),
        form: Schema.Array(
          Schema.Union(
            Schema.Literal("tablet"),
            Schema.Literal("syrup"),
            Schema.Literal("ampule"),
            Schema.Literal("suppository"),
            Schema.Literal("cream"),
            Schema.Literal("drops"),
            Schema.Literal("bottle"),
            Schema.Literal("spray"),
            Schema.Literal("gel"),
            Schema.Literal("lotion"),
            Schema.Literal("inhaler"),
            Schema.Literal("capsule"),
            Schema.Literal("injection"),
            Schema.Literal("patch"),
            Schema.Literal("other"),
          ),
        ),
        frequency: Schema.String,
        intervals: Schema.String,
        dose: Schema.String,
        doseUnits: Schema.Array(
          Schema.Union(
            Schema.Literal("mg"),
            Schema.Literal("g"),
            Schema.Literal("mcg"),
            Schema.Literal("mL"),
            Schema.Literal("L"),
            Schema.Literal("units"),
          ),
        ),
        duration: Schema.String,
        durationUnits: Schema.Array(
          Schema.Union(
            Schema.Literal("hours"),
            Schema.Literal("days"),
            Schema.Literal("weeks"),
            Schema.Literal("months"),
            Schema.Literal("years"),
          ),
        ),
      }),
    }),
  );
  export const DiagnosisFieldSchema = createFieldSchema(
    "diagnosis",
    Schema.Struct({
      inputType: Schema.Literal("select"),
      options: Schema.Array(FieldOptionSchema),
    }),
  );
  export const DateFieldSchema = createFieldSchema(
    "date",
    Schema.Struct({
      inputType: Schema.Literal("date"),
    }),
  );
  export const OptionsFieldSchema = createFieldSchema(
    "options",
    Schema.Struct({
      inputType: Schema.Union(
        Schema.Literal("dropdown"),
        Schema.Literal("radio"),
        Schema.Literal("select"),
      ),
      options: Schema.Array(FieldOptionSchema),
      multi: Schema.Boolean,
    }),
  );
  export const FileFieldSchema = createFieldSchema(
    "file",
    Schema.Struct({
      inputType: Schema.Literal("file"),
      allowedMimeTypes: Schema.NullOr(
        Schema.Array(
          Schema.Union(
            Schema.Literal("image/png"),
            Schema.Literal("image/jpeg"),
            Schema.Literal("application/pdf"),
          ),
        ),
      ),
      multiple: Schema.Boolean,
      minItems: Schema.Number,
      maxItems: Schema.Number,
    }),
  );

  export const TextDisplayFieldSchema = createFieldSchema(
    "text",
    Schema.Struct({
      content: Schema.String,
      size: Schema.Union(
        Schema.Literal("xxl"),
        Schema.Literal("xl"),
        Schema.Literal("lg"),
        Schema.Literal("md"),
        Schema.Literal("sm"),
      ),
    }),
  );

  export const SeparatorFieldSchema = createFieldSchema(
    "separator",
    Schema.Struct({}),
  );

  export const FieldSchema = Schema.Union(
    BinaryFieldSchema,
    TextFieldSchema,
    MedicineFieldSchema,
    DiagnosisFieldSchema,
    DateFieldSchema,
    OptionsFieldSchema,
    FileFieldSchema,
    TextDisplayFieldSchema,
    SeparatorFieldSchema,
  );

  export type Field = Schema.Schema.Type<typeof FieldSchema>;

  export type FieldData =
    | BinaryField2
    | TextField2
    | MedicineField2
    | DiagnosisField2
    | DateField2
    | OptionsField2
    | FileField2
    | TextDisplayField2
    | SeparatorField2;

  export function toSchema(field: FieldData): Either.Either<Field, Error> {
    return Schema.encodeUnknownEither(FieldSchema)({
      ...field,
      // Have to re-add the fieldType property that was removed by the tagged class
      fieldType: field._tag,
    });
  }

  // Flow: Parse with schemas → work with TaggedClass instances → serialize back with schemas.

  const EventFormSchema = Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    description: Schema.String,
    language: Schema.String,
    is_editable: Schema.Boolean,
    is_snapshot_form: Schema.Boolean,
    form_fields: Schema.Array(FieldSchema),
    metadata: Schema.Record({ key: Schema.String, value: Schema.Any }),
    clinic_ids: Schema.Array(Schema.String),
    translations: Schema.Array(Schema.Any),
    is_deleted: Schema.Boolean,
    created_at: Schema.DateFromSelf,
    updated_at: Schema.DateFromSelf,
    last_modified: Schema.DateFromSelf,
    server_created_at: Schema.DateFromSelf,
    deleted_at: Schema.OptionFromNullOr(Schema.DateFromSelf),
  });
  export type T = typeof EventFormSchema.Type;
  export type EncodedT = typeof EventFormSchema.Encoded;

  export type HHFieldWithPosition = HHField & { position: number };

  export namespace Fields {
    /**
     * Type guard for HHFieldWithPosition | HHField to check if the field has units
     * @param field
     * @returns
     */
    export function hasUnits(
      field: HHFieldWithPosition | HHField,
    ): field is HHFieldWithPosition {
      return "units" in field;
    }

    /**
     * Get the units for a field
     * @param field
     * @returns
     */
    export function getUnits(
      field: HHFieldWithPosition | HHField,
    ): (DoseUnit | DurationUnit)[] {
      return hasUnits(field) ? Array.from(new Set(field?.units || [])) : [];
    }
  }

  // Two letter iso639-2 language code
  // as seen here: https://www.loc.gov/standards/iso639-2/php/code_list.php
  export type Language =
    | "en"
    | "es"
    | "fr"
    | "de"
    | "it"
    | "pt"
    | "ru"
    | "zh"
    | "ja"
    | "ar"
    | "hi"
    | "bn"
    | "pa"
    | "jv"
    | "ko"
    | "vi"
    | "ta"
    | "ur"
    | "fa"
    | "tr"
    | "pl"
    | "uk"
    | "ro"
    | "nl"
    | "hu"
    | "el"
    | "cs"
    | "sv"
    | "ca"
    | "fi"
    | "he"
    | "no"
    | "id"
    | "ms"
    | "da"
    | "sk"
    | "lt"
    | "hr"
    | "sr"
    | "sl"
    | "et"
    | "lv"
    | "th"
    | "az"
    | "hy"
    | "ka"
    | "eu"
    | "gl"
    | "be"
    | "mk"
    | "bs"
    | "is"
    | "sq"
    | "kk"
    | "ky"
    | "tg"
    | "uz"
    | "tk"
    | "mn"
    | "ja"
    | "ko"
    | "zh"
    | "vi"
    | "th"
    | "lo"
    | "km"
    | "my"
    | "km"
    | "my"
    | "ne"
    | "si"
    | "am"
    | "ti"
    | "so"
    | "sw"
    | "rw"
    | "ny"
    | "mg"
    | "eo"
    | "cy"
    | "gd"
    | "ga"
    | "gd"
    | "ga"
    | "af"
    | "zu"
    | "xh"
    | "st"
    | "tn"
    | "ts"
    | "ss"
    | "ve"
    | "nr"
    | "wo"
    | "fy";

  export type LanguageOption = {
    label: string;
    value: Language;
  };

  // export type HHForm = {
  //   id: string;
  //   name: string;
  //   description: string;
  //   language: Language;
  //   is_editable: boolean;
  //   is_snapshot_form: boolean;
  //   fields: HHField[];
  //   form_fields: HHField[];
  //   createdAt: Date;
  //   updatedAt: Date;
  // };

  export namespace API {
    /**
     * Get a list of all the event forms
     */
    export const getAll = createServerOnlyFn(
      async (options?: { includeDeleted?: boolean }): Promise<EncodedT[]> => {
        const includeDeleted = options?.includeDeleted ?? false;

        let query = db
          .selectFrom(EventForm.Table.name)
          .orderBy("name", "asc")
          .selectAll();

        if (!includeDeleted) {
          query = query.where("is_deleted", "=", false);
        }

        const result = await query.execute();

        return result;
      },
    );

    /**
     * Get a form by an id
     * @param id - The id of the form
     */
    export const getById = createServerOnlyFn(async (id: string): Promise<EncodedT> => {
      const result = await db
        .selectFrom(EventForm.Table.name)
        .where("id", "=", id)
        .where("is_deleted", "=", false)
        .selectAll()
        .executeTakeFirst();
      return result;
    });

    /**
     * Insert a new event form
     * @param form - The form to insert
     * @returns The inserted form
     */
    export const insert = createServerOnlyFn(
      async (form: EventForm.EncodedT): Promise<EventForm.T> => {
        const result = await db
          .insertInto(EventForm.Table.name)
          .values({
            id: uuidV1(),
            name: form.name,
            description: form.description,
            language: form.language,
            is_editable: form.is_editable,
            is_snapshot_form: form.is_snapshot_form,
            form_fields: sql`${JSON.stringify(safeJSONParse(form.form_fields, []))}::jsonb`,
            metadata: sql`${JSON.stringify(safeJSONParse(form.metadata, {}))}::jsonb`,
            clinic_ids: sql`${JSON.stringify(form.clinic_ids ?? [])}::jsonb`,
            translations: sql`${JSON.stringify(form.translations ?? [])}::jsonb`,
            is_deleted: form.is_deleted,
            created_at: sql`now()`,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
            server_created_at: sql`now()`,
            deleted_at: null,
          })
          .returningAll()
          .executeTakeFirst();
        return result;
      },
    );

    /**
     * Update an event form
     * @param id - The id of the form to update
     * @param form - The form to update
     * @returns The updated form
     */
    export const update = createServerOnlyFn(
      async ({
        id,
        form,
      }: {
        id: string;
        form: EventForm.EncodedT;
      }): Promise<EventForm.T> => {
        const result = await db
          .updateTable(EventForm.Table.name)
          .set({
            name: form.name,
            description: form.description,
            language: form.language,
            is_editable: form.is_editable,
            is_snapshot_form: form.is_snapshot_form,
            form_fields: sql`${JSON.stringify(safeJSONParse(form.form_fields, []))}::jsonb`,
            metadata: sql`${JSON.stringify(safeJSONParse(form.metadata, {}))}::jsonb`,
            clinic_ids: sql`${JSON.stringify(form.clinic_ids ?? [])}::jsonb`,
            translations: sql`${JSON.stringify(form.translations ?? [])}::jsonb`,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
          })
          .where("id", "=", id)
          .returningAll()
          .executeTakeFirst();
        return result;
      },
    );

    /**
     * Delete an event form - ALL DELETES ARE JUST SOFT DELETES
     * @param id - The id of the form to delete
     * @returns The deleted form
     */
    export const softDelete = createServerOnlyFn(
      async (id: string): Promise<EventForm.T> => {
        const result = await db
          .updateTable(EventForm.Table.name)
          .set({
            is_deleted: true,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
            deleted_at: sql`now()`,
          })
          .where("id", "=", id)
          .returningAll()
          .executeTakeFirst();
        return result;
      },
    );

    /**
     * Toggle form snapshot mode
     * @param id - The id of the form to toggle
     * @param isSnapshot - Whether the form should be in snapshot mode
     * @returns The updated form
     */
    export const toggleSnapshot = createServerOnlyFn(
      async ({
        id,
        isSnapshot,
      }: {
        id: string;
        isSnapshot: boolean;
      }): Promise<EventForm.T> => {
        const result = await db
          .updateTable(EventForm.Table.name)
          .set({
            is_snapshot_form: isSnapshot,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
          })
          .where("id", "=", id)
          .returningAll()
          .executeTakeFirst();
        return result;
      },
    );

    /**
     * Toggle form editable mode
     * @param id - The id of the form to toggle
     * @param isEditable - Whether the form should be editable
     * @returns The updated form
     */
    export const toggleEditable = createServerOnlyFn(
      async ({
        id,
        isEditable,
      }: {
        id: string;
        isEditable: boolean;
      }): Promise<EventForm.T> => {
        const result = await db
          .updateTable(EventForm.Table.name)
          .set({
            is_editable: isEditable,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
          })
          .where("id", "=", id)
          .returningAll()
          .executeTakeFirst();
        return result;
      },
    );
  }
}

export default EventForm;
