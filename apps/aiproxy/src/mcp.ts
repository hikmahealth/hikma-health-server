import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v3";
import { abcTools } from "./hh/tools.js";
import zodToJsonSchema from "zod-to-json-schema";

export const createMCPServer = () => {
  const server = new McpServer({
    name: "hhllm",
    description: "Simple service to get useful hospital analytics data",
    version: process.env.npm_package_version ?? "0.0.0",
  });

  for (let [name, tool] of Object.entries(abcTools)) {
    //   const obj: Record<string, any> = {
    //     description: tool.description,
    //   };
    // if (tool.input) {
    //   obj.inputSchema = tool.input;
    // }
    // if (tool.output) {
    //   obj.outputSchema = tool.output;
    // }

    server.registerTool(
      name,
      {
        description: tool.description,
        inputSchema: tool.input,
        // outputSchema: tool.output,
      },
      // @ts-ignore
      async function (input) {
        try {
          // let inp = input;
          // if (tool.input) {
          //   const k = z.object(tool.input).safeParse(inp);
          //   if (k.success) {
          //     //@ts-ignore
          //     inp = k.data;
          //   } else {
          //     console.error("ERROR WHILE PARSING INPUT:", k.error.errors);
          //     throw k.error;
          //   }
          // }
          //@ts-ignore
          let output = await tool.action({ input });
          if (tool.output) {
            const k = z.object(tool.output).safeParse(output);
            if (k.success) {
              //@ts-ignore
              output = k.data;
            } else {
              console.error("ERROR WHILE PARSING OUTPUT:", k.error.errors);
              throw k.error;
            }
          }

          console.error(output);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(output),
              },
              output,
            ],
          };
        } catch (err) {
          console.error(`PRE-INP [${name}]: `, input);
          console.error(`FAILED [${name}]: REASON `, err);
          throw err;
        }
      },
    );
  }

  // // register the tools
  // server.registerTool(
  //   "fake_get_visits_count",
  //   {
  //     description: "Get the number of successful visits in the hospital",
  //     inputSchema: {
  //       fromDate: z.string().optional(),
  //       toDate: z.string().optional(),
  //     },
  //   },
  //   async function (c) {
  //     const output = { size: Math.round(Math.random() * 3000 + 1000) };

  //     console.error(output);
  //     return {
  //       content: [
  //         {
  //           type: "text",
  //           text: JSON.stringify(output),
  //         },
  //       ],
  //       output,
  //     };
  //   },
  // );

  // // register the tools
  // server.registerTool(
  //   "fake_get_patients_count",
  //   {
  //     description: "Get the patient count within the hospital",
  //     inputSchema: {
  //       fromDate: z.string().optional(),
  //       toDate: z.string().optional(),
  //     },
  //     // outputSchema: {
  //     //   size: z
  //     //     .number()
  //     //     .describe("Total number of patient the function returns"),
  //     // },
  //   },
  //   async function (c) {
  //     const output = { size: Math.ceil(Math.random() * 100 + 10) };
  //     console.error(output);
  //     return {
  //       content: [
  //         {
  //           type: "text",
  //           text: JSON.stringify(output),
  //         },
  //       ],
  //       output,
  //     };
  //   },
  // );

  return server;
};
