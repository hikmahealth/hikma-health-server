import { z } from "zod";
import { v1 as uuidv1 } from "uuid";

const baseFieldParts = {
  baseField: z.boolean().optional().default(false),
  id: z.string().optional().default(uuidv1()),
  column: z.string().min(1).max(100),
  label: z.record(z.string().min(1), z.string()),
  required: z.boolean().optional().default(false),
  visible: z.boolean().optional().default(true),
  deleted: z.boolean().optional().default(false),
  showsInSummary: z.boolean().optional().default(false),
  isSearchField: z.boolean().optional().default(false),
  metadata: z.record(z.string(), z.any()).optional().default({}),
};

export type FormBuildFormFieldInit = z.input<typeof schemaFormField>;

export const selectField = z.object({
  ...baseFieldParts,
  fieldType: z.literal("select"),
  options: z.array(z.record(z.string().min(1), z.string())), // language translation object?
});

export const schemaFormField = z.discriminatedUnion("fieldType", [
  selectField,
  z.object({
    ...baseFieldParts,
    fieldType: z.enum(["text", "number"]),
  }),
  z.object({
    ...baseFieldParts,
    fieldType: z.literal("date"),
  }),
]);

export type SelectFormField = z.infer<typeof selectField>;

export type FormFieldInit = z.input<typeof schemaFormField>;
export type FormField = z.infer<typeof schemaFormField>;

export const formBuilderOptionsSchema = z.object({ language: z.string() });
export const formBuildSchema = z.object({
  previewOptions: formBuilderOptionsSchema,
  form: z.object({
    id: z.string(),
    name: z.string(),
    version: z.string(),
    fields: schemaFormField.array(),
    created_at: z
      .date()
      .or(z.string())
      .transform((d) => new Date(d)),
  }),
});

export const formBuildForEditorSchema = z.object({
  previewOptions: formBuilderOptionsSchema,
  form: z.object({
    id: z.string(),
    name: z.string(),
    version: z.string(),
    field_map: z.record(z.string().min(1), schemaFormField),
    field_positions: z.string().array(),
    created_at: z
      .date()
      .or(z.string())
      .transform((d) => new Date(d)),
  }),
});

export type FormBuilderOptionsInit = z.input<typeof formBuilderOptionsSchema>;

export type FormBuildStateInit = z.input<typeof formBuildSchema>;
export type FormBuildOutputForm = z.output<typeof formBuildSchema>["form"];

export type FormBuildState = z.output<typeof formBuildForEditorSchema>;
