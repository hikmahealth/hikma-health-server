import z from "zod/v3";

export const schemaFilterConditions = z
  .array(
    z.union([
      z.object({
        lhs: z.literal("inputType"),
        op: z.literal("="),
        rhs: z.enum(["free-text", "number", "date", "select"]),
      }),
      z.object({
        lhs: z.enum([
          "fieldId",
          "name", // please note. this is only used to filter the query. might change later
        ]),
        op: z.literal("="),
        rhs: z.string(),
      }),
      z.object({
        lhs: z.literal("value"),
        op: z.enum(["=", ">=", "<=", ">", "<", "<>", "in", "@>"]),
        rhs: z.any(),
      }),
    ]),
  )
  .describe(
    "AND joined expressions that are used in describing the data to filter",
  );

export function convertConditionToWhereClause(
  conditions: z.infer<typeof schemaFilterConditions>,
) {
  let andclauses = [];
  for (let cond of conditions) {
    const { lhs, op, rhs } = cond;

    if (lhs === "value") {
      let _lhs = `k.elem ->> '${lhs}'`;
      switch (op) {
        case "in": {
          if (!Array.isArray(rhs)) {
            throw new Error("since using 'in', expect RHS to be string[] ");
          }

          andclauses.push([`${lhs} = ANY([${rhs.join(",")}])`]);
          break;
        }
        case "@>": {
          if (Array.isArray(rhs) || typeof rhs !== "object") {
            throw new Error(
              "since using 'contains', expect RHS to be Record<string, any>",
            );
          }

          andclauses.push(`(${_lhs})::jsonb @> '[${JSON.stringify(rhs)}]'`);
          break;
        }
        default: {
          if (rhs instanceof Date) {
            let nlhs = `try_cast_to_timestamptz(k.elem ->> 'value')`;
            andclauses.push(
              `${nlhs} ${op} '${rhs.toISOString()}'::timestamptz`,
            );
            break;
            // do as a date does
          } else {
            // convert the value, make it compatible with postgresql
            switch (typeof rhs) {
              case "boolean": {
                let nlhs = `(case
                              when is_valid_json((k.elem ->> 'value'))
                                  then
                                  (case
                                      when jsonb_typeof((k.elem ->> 'value')::jsonb) = 'boolean' then (k.elem ->> 'value')::jsonb::bool
                                      when jsonb_typeof((k.elem ->> 'value')::jsonb) = 'string' then try_cast_to_boolean((k.elem ->> 'value')::jsonb::text)
                                      else false end)
                              else try_cast_to_boolean(k.elem ->> 'value')
                              end
                            )`;

                // 't' and 'f' are values the booleans are converted to in PSQL during casting
                andclauses.push(`${nlhs} ${op} ${rhs}`);
                break;
              }
              case "number":
              case "bigint": {
                let nlhs = `(case
                              when is_valid_json((k.elem ->> 'value'))
                              then
                                (case
                                    when jsonb_typeof((k.elem ->> 'value')::jsonb) = 'string' then try_cast_to_float((k.elem ->> 'value')::jsonb::text)
                                    when jsonb_typeof((k.elem ->> 'value')::jsonb) = 'number' then CAST((k.elem ->> 'value')::jsonb AS FLOAT)
                                    else null
                                    end)
                                else try_cast_to_float(k.elem ->> 'value')
                            end)`;

                andclauses.push(`${nlhs} ${op} ${rhs}`);
                break;
              }
              case "string": {
                andclauses.push(`(${_lhs})::text ${op} '${rhs}'::text`);
                break;
              }

              default: {
                throw new Error("unsupported type ==> " + typeof rhs);
              }
            }
          }
        }
      }
    } else {
      if (op != "=") {
        throw new Error(`only operation allowed for '${lhs} is '='`);
      }

      // sql injection is super possible,
      // should think of sanitizing the text
      andclauses.push(`k.elem ->> '${lhs}' = '${rhs}'`);
    }
  }

  return andclauses;
}
