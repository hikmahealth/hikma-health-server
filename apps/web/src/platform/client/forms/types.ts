import { z } from "zod";

const baseFieldParts = {
  baseField: z.boolean().optional().default(false),
  name: z.string().min(1).max(100),
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
]);

export type FormBuild = {
  name: string;
  version: string;
  fields: z.input<typeof schemaFormField>[];
  created_at: Date;
};

export type FormBuildState = { form: FormBuild; language: string };
