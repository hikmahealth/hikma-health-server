import { GoogleGenAI, Models } from "@google/genai";
import { serve } from "@hono/node-server";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import z from "zod/v3";
import { zodToJsonSchema } from "zod-to-json-schema";
import tools, { getTool } from "./hh/tools.js";
import { FunctionCallingConfigMode } from "@google/genai";

const app = new Hono();
const ai = new GoogleGenAI({});

app.get("/health", (c) => c.json({ status: "ok" }));

// expected shape Array<[x, y]>
const schemaLineChart = z
  .array(
    z
      .number()
      .array()
      .min(2)
      .max(2)
      .describe(
        "A tuple of numbers, containing [x, y] values to plot the chart",
      ),
  )
  .describe("Array of tuples of numbers to plot the graph");

const moreargs = {
  responseMimeType: "application/json",
  responseJsonSchema: zodToJsonSchema(
    z.object({
      report: z.discriminatedUnion("type", [
        z.object({
          type: z.literal("text"),
          value: z
            .string()
            .describe(
              "Contains the contents for when only text should be rendered",
            ),
        }),
        z.object({
          type: z.enum(["line", "bar"]),
          value: schemaLineChart,
        }),
        z.object({
          type: z.literal("pie"),
          value: z
            .number()
            .array()
            .describe("array of numbers to plot the pie chart"),
        }),
      ]),
    }),
  ),
};

app.post(
  "/query",
  zValidator(
    "form",
    z.object({
      query: z.string(),
    }),
  ),
  async function (c) {
    const input = c.req.valid("form");
    const prompt = input.query;

    // making the first API request and telling the model what we have
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt, // NOTE: might want to use this to include meta information like: Make sure the date string are RFC3339 formats only
      config: {
        tools: [
          {
            functionDeclarations: tools,
          },
        ],
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.ANY },
        },
      },
    });

    // to contain the results of the function calls here
    let fnsResults = await Promise.all(
      (response.functionCalls ?? []).map(async (f) => {
        console.log(`Tool Call:`, f.name, " Args: ", f.args);
        if (!f.name) {
          return null;
        }

        const tool = getTool(f.name);
        if (!tool) {
          return null;
        }

        if (!tool.action) {
          return null;
        }

        const output = await tool.action({ input: f.args });
        return JSON.stringify({
          name: f.name,
          response: { result: output },
        });
      }),
    );

    fnsResults = fnsResults.filter((d) => d !== null);
    // console.log(fnsResults, response.candidates[0].content);

    const response2 = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        //@ts-ignore
        { role: "user", parts: [{ text: prompt }] },
        //@ts-ignore
        response.candidates?.[0].content,
        {
          //@ts-ignore
          role: "user",
          parts: fnsResults.map((fr) => ({
            functionResponse: JSON.parse(fr as string),
          })),
        }, // results from previous step
      ], // NOTE: might want to use this to include meta information like: Make sure the date string are RFC3339 formats only
      config: {
        temperature: 0,
        ...moreargs,
      },
    });

    //@ts-ignore
    console.log(response2.candidates[0]);
    console.log(response2.data);

    return c.json({ ok: true });
  },
);

const port = process.env.SERVER_PORT
  ? parseInt(process.env.SERVER_PORT, 10)
  : 3000;

serve(
  {
    fetch: app.fetch,
    port: port,
  },
  async (info) => {
    // When build MCPs, use console.error instead of console.log
    // Should change to an appropriate logger for this
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
