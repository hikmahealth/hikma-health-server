// testing with OpenAI

import { zodToJsonSchema } from "zod-to-json-schema";
import reportTemplate from "./hh/report-template.js";
import OpenAI from "openai";
import z from "zod/v3";
import tools, { abcTools, getTool } from "./hh/tools.js";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

import * as fs from "fs/promises";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let prompt = `
I would like a report generated for me containing data collected from medical forms.
I would like a report shouwing the number of patients that are diabetic.
Show how the different sexes compare using a bar chart. I would also like a report of how many people between age 14-25 smoke`;

prompt = prompt.replaceAll(/(\s+|\n)/g, " ");

const responseSchema = zodToJsonSchema(z.object(reportTemplate), {
  target: "openApi3",
  $refStrategy: "none",
});

// Convert tools to OpenAI format
const openaiTools = Object.entries(abcTools).map(
  ([name, tool]) =>
    ({
      type: "function",
      function: {
        name: name,
        description: tool.description,
        parameters: tool.input
          ? zodToJsonSchema(z.object(tool.input), {
              target: "openApi3",
              $refStrategy: "none",
            })
          : { type: "object", properties: {} },
      },
    }) as ChatCompletionTool,
);

// When making the dialog, the model should pick from the different functions available and
// construct the request payload needed to render the chart
async function main() {
  // save to file
  const reportFilePath = path.join(
    import.meta.dirname,
    "../resources/report-template.schema.json",
  );

  const projects_skill = await fs.readFile(
    path.join(import.meta.dirname, "../resources/project-skill.md"),
    { encoding: "utf-8" },
  );

  await fs.writeFile(reportFilePath, JSON.stringify(responseSchema, null, 2));
  console.log("Saved Response JSON Schema to", reportFilePath);

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "developer",
      content: projects_skill,
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  // run loop
  while (true) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0,
      tools: openaiTools,
      parallel_tool_calls: false,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "report_response",
          schema: responseSchema,
          strict: true,
        },
      },
    });

    const message = response.choices[0].message;
    console.log("Got response:", message.content);
    console.log("Tool calls:", message.tool_calls);

    // Add assistant's message to the conversation
    messages.push(message);

    if (message.tool_calls && message.tool_calls.length > 0) {
      for (let tc of message.tool_calls) {
        if (tc.type !== "function") {
          console.warn("For some reason,", tc.id, "isn't a function");
          continue;
        }
        const functionArgs = JSON.parse(tc.function.arguments);

        const tool = getTool(tc.function.name);
        if (!tool) {
          console.warn(`There's no tool named '${tc.function.name}'`);
          // Add error response
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({
              error: `Tool '${tc.function.name}' not found`,
            }),
          });
          continue;
        }

        console.log("Using tool:", tc.function.name, functionArgs);

        let input = {};
        if (tool.input) {
          input = z.object(tool.input).parse(functionArgs);
        }

        //@ts-ignore
        const result = await tool.action({ input });

        // Add tool response to the conversation
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ result }),
        });
      }
    } else {
      console.log("there's nothing more to ask. task is complete");
      break;
    }
  }
}

main().catch((err) => {
  console.error("Failed to execute", err);
});
