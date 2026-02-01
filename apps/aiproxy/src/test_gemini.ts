// testing with GEMINI

import { zodToJsonSchema } from "zod-to-json-schema";
import reportTemplate from "./hh/report-template.js";
import { GoogleGenAI } from "@google/genai";
import z from "zod/v3";
import tools, { getTool } from "./hh/tools.js";
import { FunctionCallingConfigMode } from "@google/genai";
import type { ContentListUnion } from "@google/genai";

import * as fs from "fs/promises";
import path from "path";

const ai = new GoogleGenAI({});

let prompt = `
I would like a report generated for me containing data collected from medical forms.
I would like a report shouwing the number of patients that are diabetic.
Show how the different sexes compare using a bar chart. I would also like a report of how many people between age 14-25 smoke`;

prompt = prompt.replaceAll(/(\s+|\n)/g, " ");

const responseSchema = zodToJsonSchema(z.object(reportTemplate), {
  target: "openApi3",
  $refStrategy: "none",
  allowedAdditionalProperties: undefined,
  rejectedAdditionalProperties: undefined,
});

// When making the dialog, the model should pick from the different functions available and
// construct the request payload needed to render the chart
async function main() {
  // save to file
  const reportFilePath = path.join(
    import.meta.dirname,
    "../resources/report-template.schema.json",
  );

  await fs.writeFile(reportFilePath, JSON.stringify(responseSchema, null, 2));
  console.log("Saved Response JSON Schema to", reportFilePath);

  const contents: ContentListUnion = [
    {
      role: "user",
      // initial contents that's the users prompt
      parts: [{ text: prompt }],
    },
  ];

  // run loop
  while (true) {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents, // NOTE: might want to use this to include meta information like: Make sure the date string are RFC3339 formats only
      config: {
        temperature: 0,
        tools: [
          {
            functionDeclarations: tools,
          },
        ],
        // toolConfig: {
        //   functionCallingConfig: { mode: FunctionCallingConfigMode.ANY },
        // },
        responseMimeType: "application/json",
        responseJsonSchema: responseSchema,
      },
    });

    console.log("Got ", response.text);
    console.log("Peek candidates", response.candidates);

    if (response.functionCalls && response.functionCalls.length > 0) {
      for (let fn of response.functionCalls) {
        if (!fn.name) {
          // missing name reference
          continue;
        }

        const tool = getTool(fn.name);
        if (!tool) {
          console.warn(`There's no tool named '${fn.name}'`);
          continue;
        }

        console.log("Using tool: ", fn.name, fn.args);

        let input = {};
        if (tool.input) {
          input = z.object(tool.input).parse(fn.args);
        }

        //@ts-ignore
        const result = await tool.action({ input });

        // feed the responses back to the model
        contents.push({
          role: "mode",
          parts: [{ functionCall: fn }],
        });
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: fn.name,
                response: {
                  result,
                },
              },
            },
          ],
        });
      }
    } else {
      console.log("there's nothing more to ask. task is complete");
      break;
    }

    // if there any
  }
}

main().catch((err) => {
  console.error("Failed to execute", err);
});
