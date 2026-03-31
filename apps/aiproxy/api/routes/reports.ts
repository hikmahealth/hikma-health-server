import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  ai_report_response_schema,
  prompt_refine_response_schema,
  component_fix_response_schema,
  report_component_schema,
  type manager_report_request,
  type component_request,
} from "../../src/types.js";
import {
  build_system_prompt,
  build_refine_system_prompt,
  build_user_message,
  build_component_user_message,
  build_fix_component_message,
} from "../../src/prompts.js";
import { compile_prql } from "../../src/compiler.js";
import { resolve_ai_api_key, type client } from "../../src/clients.js";
import { swap_uuids } from "../../src/uuid_swap.js";

type app_env = { Variables: { client: client } };

const AI_MODEL = process.env.AI_MODEL ?? "claude-opus-4-6";
const RETRY_LIMIT = 3;

function log_usage(
  route: string,
  usage: { input_tokens: number; output_tokens: number },
) {
  console.log(
    `[${route}] tokens — input: ${usage.input_tokens}, output: ${usage.output_tokens}`,
  );
}

type compiled_component = {
  title: string;
  description: string;
  prql_source: string;
  display: any;
  position: any;
  compiled_sql: string | null;
  compile_error: string | null;
};

/** Retry a single failed component up to RETRY_LIMIT times by asking the LLM to fix its PRQL. */
async function retry_failed_component(
  client: Anthropic,
  system_prompt: string,
  user_message: string,
  component: compiled_component,
  restore: (text: string) => string,
): Promise<compiled_component> {
  let current = component;

  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt++) {
    if (!current.compile_error) return current;

    const fix_message = build_fix_component_message(
      user_message,
      current.title,
      current.prql_source,
      current.compile_error,
      attempt,
    );

    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 2048,
      system: system_prompt,
      messages: [{ role: "user", content: fix_message }],
      output_config: {
        format: zodOutputFormat(component_fix_response_schema),
      },
    });
    log_usage(`retry/${current.title}/attempt-${attempt}`, message.usage);

    const text_block = message.content.find((b) => b.type === "text");
    if (!text_block || text_block.type !== "text") continue;

    const parsed = component_fix_response_schema.safeParse(
      JSON.parse(text_block.text),
    );
    if (!parsed.success) continue;

    const restored_prql = restore(parsed.data.prql_source);
    const result = compile_prql(restored_prql);
    if (result.ok) {
      return {
        ...current,
        prql_source: restored_prql,
        compiled_sql: result.sql,
        compile_error: null,
      };
    }

    // Update for next attempt with the new PRQL and its error
    current = {
      ...current,
      prql_source: restored_prql,
      compile_error: result.error,
    };
  }

  return current;
}

const reports = new Hono<app_env>();

/**
 * Takes a draft report prompt and returns 3 refined suggestions in user-friendly domain language.
 *
 * @example
 * // Request
 * POST /reports/prompt-refine
 * { "user_prompt": "show me patient stats", "db_schema": [...], "patient_registration_form": [...], "event_forms": [...] }
 *
 * // Response
 * { "status": "ok", "suggestions": [
 *   { "refined_prompt": "Show monthly patient registration counts...", "reasoning": "Adds time granularity..." },
 *   ...
 * ]}
 */
reports.post("/prompt-refine", async (c) => {
  const body = await c.req.json<manager_report_request>();
  const {
    patient_registration_form,
    event_forms,
    db_schema,
    user_prompt,
    ai_api_key,
  } = body;

  const key_result = resolve_ai_api_key(c.get("client"), ai_api_key);
  if (!key_result.ok) {
    return c.json({ error: key_result.error }, 401);
  }

  if (!patient_registration_form || !event_forms || !db_schema) {
    return c.json(
      {
        error:
          "Missing required fields: patient_registration_form, event_forms, db_schema",
      },
      400,
    );
  }

  if (!user_prompt) {
    return c.json({ error: "Missing required field: user_prompt" }, 400);
  }

  const client = new Anthropic({
    apiKey: key_result.key,
    timeout: 45 * 1_000, // refinement is lighter than report generation
  });

  const raw_system = build_refine_system_prompt(
    db_schema,
    patient_registration_form,
    event_forms,
  );
  // Swap UUIDs across both prompts together so the same real UUID maps to the same fake
  const { scrubbed: scrubbed_combined } = swap_uuids(
    JSON.stringify([raw_system, user_prompt]),
  );
  const [scrubbed_system, scrubbed_user] = JSON.parse(scrubbed_combined) as [
    string,
    string,
  ];

  const message = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 2048,
    system: scrubbed_system,
    messages: [{ role: "user", content: scrubbed_user }],
    output_config: {
      format: zodOutputFormat(prompt_refine_response_schema),
    },
  });
  log_usage("prompt-refine", message.usage);

  const text_block = message.content.find((b) => b.type === "text");
  if (!text_block || text_block.type !== "text") {
    return c.json({ error: "No text response from AI" }, 502);
  }

  const parsed = prompt_refine_response_schema.safeParse(
    JSON.parse(text_block.text),
  );
  if (!parsed.success) {
    return c.json(
      { error: "AI response failed schema validation", details: parsed.error },
      502,
    );
  }

  return c.json({ status: "ok", suggestions: parsed.data.suggestions });
});

/** Create a new component from scratch, or edit an existing one.
 *  If `component` is provided in the body, the LLM modifies it; otherwise it creates fresh. */
reports.post("/update-component", async (c) => {
  const body = await c.req.json<component_request>();
  const {
    patient_registration_form,
    event_forms,
    db_schema,
    user_prompt,
    ai_api_key,
  } = body;

  const key_result = resolve_ai_api_key(c.get("client"), ai_api_key);
  if (!key_result.ok) {
    return c.json({ error: key_result.error }, 401);
  }

  if (!patient_registration_form || !event_forms || !db_schema) {
    return c.json(
      {
        error:
          "Missing required fields: patient_registration_form, event_forms, db_schema",
      },
      400,
    );
  }

  if (!user_prompt) {
    return c.json({ error: "Missing required field: user_prompt" }, 400);
  }

  const client = new Anthropic({
    apiKey: key_result.key,
    timeout: 60 * 1_000,
  });

  const raw_system = build_system_prompt(
    db_schema,
    patient_registration_form,
    event_forms,
  );
  const raw_user = build_component_user_message(body);
  const { scrubbed: scrubbed_combined, restore } = swap_uuids(
    JSON.stringify([raw_system, raw_user]),
  );
  const [system_prompt, user_msg] = JSON.parse(scrubbed_combined) as [
    string,
    string,
  ];

  const message = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 4096,
    system: system_prompt,
    messages: [{ role: "user", content: user_msg }],
    output_config: {
      format: zodOutputFormat(report_component_schema),
    },
  });
  log_usage("update-component", message.usage);

  const text_block = message.content.find((b) => b.type === "text");
  if (!text_block || text_block.type !== "text") {
    return c.json({ error: "No text response from AI" }, 502);
  }

  const parsed = report_component_schema.safeParse(JSON.parse(text_block.text));
  if (!parsed.success) {
    return c.json(
      { error: "AI response failed schema validation", details: parsed.error },
      502,
    );
  }

  const restored_prql = restore(parsed.data.prql_source);
  const result = compile_prql(restored_prql);

  let compiled: compiled_component = result.ok
    ? {
        ...parsed.data,
        prql_source: restored_prql,
        compiled_sql: result.sql,
        compile_error: null,
      }
    : {
        ...parsed.data,
        prql_source: restored_prql,
        compiled_sql: null,
        compile_error: result.error,
      };

  if (compiled.compile_error) {
    compiled = await retry_failed_component(
      client,
      system_prompt,
      user_msg,
      compiled,
      restore,
    );
  }

  if (compiled.compile_error) {
    console.error("PRQL compilation failure after retries:", {
      title: compiled.title,
      error: compiled.compile_error,
    });
  }

  return c.json({ status: "ok", component: compiled });
});

reports.post("/manage", async (c) => {
  const body = await c.req.json<manager_report_request>();
  const {
    patient_registration_form,
    event_forms,
    db_schema,
    report,
    user_prompt,
    ai_api_key,
  } = body;

  const key_result = resolve_ai_api_key(c.get("client"), ai_api_key);
  if (!key_result.ok) {
    return c.json({ error: key_result.error }, 401);
  }

  if (!patient_registration_form || !event_forms || !db_schema) {
    return c.json(
      {
        error:
          "Missing required fields: patient_registration_form, event_forms, db_schema",
      },
      400,
    );
  }

  if (!Array.isArray(event_forms)) {
    return c.json({ error: "event_forms must be an array" }, 400);
  }

  if (!Array.isArray(db_schema)) {
    return c.json({ error: "db_schema must be an array" }, 400);
  }

  const client = new Anthropic({
    apiKey: key_result.key,
    timeout: 60 * 1_000, // 60 seconds timeout (default is 10 minutes)
  });

  const raw_system = build_system_prompt(
    db_schema,
    patient_registration_form,
    event_forms,
  );
  const raw_user = build_user_message(body);
  const { scrubbed: scrubbed_combined, restore } = swap_uuids(
    JSON.stringify([raw_system, raw_user]),
  );
  const [system_prompt, user_msg] = JSON.parse(scrubbed_combined) as [
    string,
    string,
  ];
  console.log("=== SYSTEM PROMPT ===\n" + system_prompt);
  console.log("=== USER MSG ===\n" + user_msg);

  const message = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 4096,
    system: system_prompt,
    messages: [{ role: "user", content: user_msg }],
    output_config: {
      format: zodOutputFormat(ai_report_response_schema),
    },
  });
  log_usage("manage", message.usage);

  const text_block = message.content.find((b) => b.type === "text");
  if (!text_block || text_block.type !== "text") {
    return c.json({ error: "No text response from AI" }, 502);
  }

  const parsed = ai_report_response_schema.safeParse(
    JSON.parse(text_block.text),
  );
  if (!parsed.success) {
    return c.json(
      { error: "AI response failed schema validation", details: parsed.error },
      502,
    );
  }

  // Restore real UUIDs in PRQL before compilation so the SQL references real IDs
  const compiled: compiled_component[] = parsed.data.components.map((comp) => {
    const restored_prql = restore(comp.prql_source);
    const result = compile_prql(restored_prql);
    if (!result.ok) {
      return {
        ...comp,
        prql_source: restored_prql,
        compiled_sql: null,
        compile_error: result.error,
      };
    }
    return {
      ...comp,
      prql_source: restored_prql,
      compiled_sql: result.sql,
      compile_error: null,
    };
  });

  // Retry failed components in parallel
  const results = await Promise.all(
    compiled.map((comp) => {
      if (!comp.compile_error) return comp;
      return retry_failed_component(
        client,
        system_prompt,
        user_msg,
        comp,
        restore,
      );
    }),
  );

  const still_failed = results.filter((c) => c.compile_error);
  if (still_failed.length > 0) {
    console.error(
      "PRQL compilation failures after retries:",
      still_failed.map((f) => ({ title: f.title, error: f.compile_error })),
    );
  }

  return c.json({ status: "ok", components: results });
});

export default reports;
