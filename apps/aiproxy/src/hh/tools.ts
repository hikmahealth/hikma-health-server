import type { ToolUnion } from "@google/genai";
import type { FunctionDeclaration } from "@google/genai";
import type { CallableTool } from "@google/genai";
import type { Tool } from "@google/genai";
import type { ToolListUnion } from "@google/genai";
import { PostgresDialect } from "kysely";
import { Kysely } from "kysely";
import { Pool } from "pg";
import { zodToJsonSchema } from "zod-to-json-schema";
import z from "zod/v3";
import type { DB } from "../../../../database/types/pg/hh.js";
import { getDatabaseConfig } from "../db-config.js";
import { sql } from "kysely";
import {
  convertConditionToWhereClause,
  schemaFilterConditions,
} from "./util.js";

const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      ...getDatabaseConfig(),
    }),
  }),
});

function makeTool<
  ZInputShape extends z.ZodRawShape | undefined,
  ZOutputShape extends z.ZodRawShape | undefined,
>(
  schema: {
    input?: ZInputShape;
    output?: ZOutputShape;
    description?: string;
  },
  action: ({
    input,
  }: {
    input: ZInputShape extends z.ZodRawShape
      ? z.output<z.ZodObject<ZInputShape>>
      : undefined;
  }) => Promise<
    | void
    | (ZOutputShape extends z.ZodRawShape
        ? z.input<z.ZodObject<ZOutputShape>>
        : undefined)
  >,
) {
  return {
    description: schema.description,
    input: schema.input,
    output: schema.output,
    action: action,
  };
}

export const abcTools = {
  // query_patient_counts: makeTool(
  //   {
  //     input: {
  //       age: z.number().optional(),
  //       sex: z.enum(["male", "female"]).array().optional(),
  //     },
  //     output: {
  //       size: z.number().describe("number of patients that match the filter"),
  //     },
  //   },
  //   async function ({ input }) {
  //     let query = db
  //       .selectFrom("patients")
  //       .select(db.fn.count("id").as("count"));

  //     z.object;

  //     if (input?.age) {
  //       // Calculate birth year from age
  //       const currentYear = new Date().getFullYear();
  //       const birthYear = currentYear - input.age;
  //       query = query.where(
  //         //@ts-ignore
  //         db.fn("extract", ["year", "date_of_birth"]),
  //         "=",
  //         birthYear,
  //       );
  //     }

  //     if (input?.sex && input.sex.length > 0) {
  //       query = query.where("sex", "in", input.sex);
  //     }

  //     const result = await query.executeTakeFirst();
  //     return { size: Number(result?.count || 0) };
  //   },
  // ),
  query_forms: makeTool(
    {
      input: {
        fromDate: z
          .string()
          .or(z.date())
          .transform((d) => new Date(d))
          .describe(
            "represent the start date, used in filtering the records. date is inclusive and uses RFC3339",
          )
          .optional(),
        toDate: z
          .string()
          .or(z.date())
          .transform((d) => new Date(d))
          .describe(
            "represent the end date, used in filtering the records. date is inclusive and uses RFC3339",
          )
          .optional(),
      },
      output: {
        records: z
          .object({
            key: z.string().describe("unique key that can be used to retie"),
            name: z.string().describe("get the name of the form"),
            description: z
              .string()
              .optional()
              .describe("description of the form"),
          })
          .array(),
      },
    },
    async function ({ input }) {
      let query = db
        .selectFrom("event_forms")
        .select(["id", "name", "description"]);

      if (input.fromDate) {
        query = query.where("event_forms.created_at", ">=", input.fromDate);
      }

      if (input.toDate) {
        query = query.where("event_forms.created_at", "<=", input.toDate);
      }

      const forms = await query.execute();
      return {
        records: forms.map((form) => ({
          key: form.id,
          name: form.name ?? "",
          description: form.description || undefined,
        })),
      };
    },
  ),
  query_fields_from_form: makeTool(
    {
      input: {
        fromDate: z
          .string()
          .or(z.date())
          .transform((d) => new Date(d))
          .describe(
            "represent the start date, used in filtering the records. date is inclusive and uses RFC3339",
          )
          .optional(),
        toDate: z
          .string()
          .or(z.date())
          .transform((d) => new Date(d))
          .describe(
            "represent the end date, used in filtering the records. date is inclusive and uses RFC3339",
          )
          .optional(),
        eventType: z.string().array().optional(),
        formKey: z
          .string()
          .array()
          .optional()
          .describe("form key to select the form needed"),
        name: z.string().array().optional(),
      },
      output: {
        size: z.number().describe("number of patients that match the filter"),
        fields: z.array(
          z.object({
            formKey: z.string(),
            fieldId: z.string(),
            name: z.string(),
            inputType: z.string(),
          }),
        ),
      },
    },
    // @ts-ignore
    async function ({ input }) {
      // const form = await db
      //   .selectFrom("event_forms")
      //   .select(["form_fields"])
      //   .where("id", "=", input.formKey)
      //   .executeTakeFirst();

      // if (!form || !form.form_fields) {
      //   return { size: 0, fields: [] };
      // }
      let subwhereclause = ["is_deleted = false"];
      if (input.formKey && input.formKey.length > 0) {
        if (input.formKey.length == 1) {
          subwhereclause.push(`ef.id = '${input.formKey[0]}'::uuid`);
        } else {
          subwhereclause.push(
            `ef.id = ANY(ARRAY[${input.formKey.map((d) => `'${d}'::uuid`).join(", ")}])`,
          );
        }
      }

      if (input.eventType && input.eventType.length > 0) {
        if (input.eventType.length == 1) {
          subwhereclause.push(
            `LOWER(ef.event_type) = '${input.eventType[0].toLowerCase()}'::text`,
          );
        } else {
          subwhereclause.push(
            `LOWER(ef.event_type) = ANY(ARRAY[${input.eventType.map((d) => `'${d.toLowerCase()}'::text`).join(", ")}])`,
          );
        }
      }

      if (input.name) {
        subwhereclause.push(
          `LOWER(ef.name) = ANY([${input.name.map((s) => `'${s.trim().toLowerCase()}'`)}])`,
        );
      }

      if (input.fromDate) {
        subwhereclause.push(
          `DATE(ef.created_at) >= DATE('${input.fromDate.toISOString()}'::timestamptz)`,
        );
      }

      if (input.toDate) {
        subwhereclause.push(
          `DATE(ef.created_at) <= DATE('${input.toDate.toISOString()}'::timestamptz)`,
        );
      }

      let qbc = `
        SELECT
          k.id as "formKey",
          k.elem ->> 'id' as "fieldId",
          k.elem ->> 'name' as "name",
          k.elem ->> 'inputType' as "inputType"
        FROM (
          SELECT jsonb_array_elements(form_fields) as elem, id FROM event_forms ef
          WHERE ${subwhereclause.join(" AND ")}
        ) as k
      `;

      console.error(sql.raw(qbc).compile(db).sql);

      const o = await sql.raw(qbc).execute(db);

      return {
        size: o.rows.length, // might want to have separate "COUNT" query
        fields: o.rows,
      };
    },
  ),
  count_expression_from_form: makeTool(
    {
      description:
        "Returns a count of the entries that match the `where` object from the form field with key `formKey`",
      input: {
        formKey: z.string().array().optional(),
        fromDate: z
          .string()
          .or(z.date())
          .transform((d) => new Date(d))
          .describe(
            "represent the start date, used in filtering the records. date is inclusive and uses RFC3339",
          )
          .optional(),
        toDate: z
          .string()
          .or(z.date())
          .transform((d) => new Date(d))
          .describe(
            "represent the end date, used in filtering the records. date is inclusive and uses RFC3339",
          )
          .optional(),
        eventType: z.string().array().optional(),
        conditions: schemaFilterConditions,
      },
    },
    /**
     * NOTE:
     * A user makes the following prompt:
     *
     * I would like to generate a report from the data filled in the nutrition form,
     * showing how many people children have eaten in the last 4 days.
     *
     * Roughly the things the agent is expected to do:
     * 1. get the id of the form that talks about nutrition
     * 2. once getting the id, getting information of the available fields
     *  such as, the nutrition for has the following fields
     *    -> [
     *        {name:"do you eat food", type: "select", text: "Do you eat food?", options: ['yes', 'no']},
     *        {id:"abcd1234", type: "date", text: "when was the last time you ate?", inputType: DATESTRING }
     *      ]
     * 3. after the knowing the schema of the field available for in the nutrition form,
     * request for the count based data
     *  -> give me the list of patients where "do you each food" is no
     *  Becomes: //>
     *    {
     *      formKey: <nutrition-form-key>,
     *      conditions: {and: [
     *        ["name", "=", "do you eat food?"],
     *        ["value", "in", ["no", "maybe"]], // for radio types
     *        ["value", "contains", { dose: "100" }] // for select types
     *      ]}
     *    }
     *
     * 4. The result of the query is the count for the patients whose events information
     *  are within the filtered conditions
     */
    async function ({ input }) {
      // craft the `where clause of the events fields`
      const andclauses = convertConditionToWhereClause(input.conditions);

      let subwhereclause = [];
      if (input.formKey && input.formKey.length > 0) {
        if (input.formKey.length == 1) {
          subwhereclause.push(`e.form_id = '${input.formKey[0]}'::uuid`);
        } else {
          subwhereclause.push(
            `e.form_id = ANY(ARRAY[${input.formKey.map((d) => `'${d}'::uuid`).join(", ")}])`,
          );
        }
      }

      if (input.eventType && input.eventType.length > 0) {
        if (input.eventType.length == 1) {
          subwhereclause.push(
            `LOWER(e.event_type) = '${input.eventType[0].toLowerCase()}'::text`,
          );
        } else {
          subwhereclause.push(
            `LOWER(e.event_type) = ANY(ARRAY[${input.eventType.map((d) => `'${d.toLowerCase()}'::text`).join(", ")}])`,
          );
        }
      }

      if (input.fromDate) {
        subwhereclause.push(
          `DATE(e.created_at) >= DATE('${input.fromDate.toISOString()}'::timestamptz)`,
        );
      }

      if (input.toDate) {
        subwhereclause.push(
          `DATE(e.created_at) <= DATE('${input.toDate.toISOString()}'::timestamptz)`,
        );
      }

      // selected events
      let filterevents = `
          SELECT
            count(distinct k.id) as count
          FROM (
            SELECT
                jsonb_array_elements(form_data) as elem,
                form_id,
                id,
                patient_id
            FROM events e ${subwhereclause.length > 0 ? ` WHERE ${subwhereclause.join(" AND ")}` : ""}
          ) as k`;

      if (andclauses.length > 0) {
        filterevents += " WHERE " + andclauses.join(" AND ");
      }

      // peeking the SQL query that's about to run
      console.error(sql.raw(filterevents).compile(db).sql);

      // 🚩 sql injections waiting to happen
      let query = sql.raw(filterevents).execute(db);

      const result = (await query).rows[0];
      // const result = await query.executeTakeFirst();
      // @ts-ignore
      return { count: Number(result?.count || 0) };
    },
  ),
  group_count_expression_from_form: makeTool(
    {
      input: {
        formKey: z.string().array().optional(),
        fromDate: z
          .string()
          .or(z.date())
          .transform((d) => new Date(d))
          .optional(),
        toDate: z
          .string()
          .or(z.date())
          .transform((d) => new Date(d))
          .optional(),
        eventType: z.string().array().optional(),
        groups: z
          .object({
            name: z
              .string()
              .describe(
                "this is the key that's returned with the corresponding count value in the resulting record. preferably format is in snake_case",
              ),
            filter: schemaFilterConditions.min(1),
          })
          .array(),
        conditions: schemaFilterConditions.optional(),
      },
      output: {
        groups: z.record(
          z.string(),
          z.string().or(z.number()).transform(Number),
        ),
      },
    },
    async function ({ input }) {
      const andclauses = [];
      if (input.conditions) {
        // filter the list by conditions
        andclauses.push(...convertConditionToWhereClause(input.conditions));
      }

      const groupselects = ["k.id"];
      // add the group selects
      for (let g of input.groups) {
        const gandclause = convertConditionToWhereClause(g.filter);
        groupselects.push(
          `(count (distinct k.id) filter (where ${gandclause.join(" and ")})) as "${g.name}"`,
        );
      }

      let subwhereclause = [];
      if (input.formKey && input.formKey.length > 0) {
        if (input.formKey.length == 1) {
          subwhereclause.push(`e.form_id = '${input.formKey[0]}'::uuid`);
        } else {
          subwhereclause.push(
            `e.form_id = ANY(ARRAY[${input.formKey.map((d) => `'${d}'::uuid`).join(", ")}])`,
          );
        }
      }

      if (input.eventType && input.eventType.length > 0) {
        if (input.eventType.length == 1) {
          subwhereclause.push(
            `LOWER(e.event_type) = '${input.eventType[0].toLowerCase()}'::text`,
          );
        } else {
          subwhereclause.push(
            `LOWER(e.event_type) = ANY(ARRAY[${input.eventType.map((d) => `'${d.toLowerCase()}`).join(", ")}])`,
          );
        }
      }

      if (input.fromDate) {
        subwhereclause.push(
          `DATE(e.created_at) >= DATE('${input.fromDate.toISOString()}'::timestamptz)`,
        );
      }

      if (input.toDate) {
        subwhereclause.push(
          `DATE(e.created_at) <= DATE('${input.toDate.toISOString()}'::timestamptz)`,
        );
      }

      let actualq = `
        SELECT
          ${groupselects.join(", ")}
        FROM
          (
            SELECT
              jsonb_array_elements(form_data) as elem,
              form_id,
              id,
              patient_id
          FROM events e ${subwhereclause.length > 0 ? ` WHERE (${subwhereclause.join(" AND ")})` : ""}
        ) as k group by k.id`;

      if (andclauses.length > 0) {
        actualq += " WHERE " + andclauses.join(" AND ");
      }

      // // this sums the number of patients in the group
      actualq = `
        SELECT
          ${input.groups.map((d) => `SUM(k."${d.name}") as "${d.name}"`).join(", ")}
        FROM
          (${actualq.trim()}) as k
        LEFT JOIN events evt on k.id = evt.id
      `;

      console.error(sql.raw(actualq).compile(db).sql);

      // 🚩 sql injections waiting to happen
      let query = sql.raw(actualq).execute(db);
      // return (await query).rows[0];
      return {
        groups:
          ((await query).rows[0] as Record<string, string | number>) ?? {},
      };
    },
  ),
};

import * as fs from "fs";
import path from "path";

const tools: FunctionDeclaration[] = Object.entries(abcTools).map(
  ([id, o]: [string, any]) => {
    const v: FunctionDeclaration = {
      name: id as string,
      description: o.description,
    };

    if (o.input) {
      const inputSchema = zodToJsonSchema(z.object(o.input), {
        $refStrategy: "none",
        target: "openApi3",
        allowedAdditionalProperties: undefined,
        rejectedAdditionalProperties: undefined,
      });

      const p = path.join(
        import.meta.dirname,
        `../../resources/tool.${id}.input.schema.json`,
      );
      fs.writeFile(p, JSON.stringify(inputSchema, null, 2), (err) => {
        if (err) console.error(err);
      });

      // @ts-ignore
      v["parametersJsonSchema"] = inputSchema;
    }

    if (o.output) {
      const outputSchema = zodToJsonSchema(z.object(o.output), {
        $refStrategy: "none",
        target: "openApi3",
        allowedAdditionalProperties: undefined,
        rejectedAdditionalProperties: undefined,
      });

      const p = path.join(
        import.meta.dirname,
        `../../resources/tool.${id}.output.schema.json`,
      );
      fs.writeFile(p, JSON.stringify(outputSchema, null, 2), (err) => {
        if (err) console.error(err);
      });

      // @ts-ignore
      v["responseJsonSchema"] = outputSchema;
    }

    return v;
  },
);

export function getTool<T extends string>(
  name: T,
): null | Values<typeof abcTools> {
  //@ts-ignore
  const fn = abcTools[name];
  if (!fn) {
    return null;
  }

  return fn;
}

export type ToolName = (typeof tools)[number]["name"];
export default tools;

type Values<T> = T extends Record<string, infer V> ? V : never;
