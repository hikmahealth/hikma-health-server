import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const createMCPServer = () => {
  const server = new McpServer({
    name: "hhllm",
    description: "Simple service to get useful hospital analytics data",
    version: process.env.npm_package_version ?? "0.0.0",
  });

  // register the tools
  server.registerTool(
    "get_visits_count",
    {
      description: "Get the number of successful visits in the hospital",
      inputSchema: {
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      },
    },
    async function (c) {
      const output = { size: Math.round(Math.random() * 3000 + 1000) };

      console.error(output);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output),
          },
        ],
        output,
      };
    },
  );

  // register the tools
  server.registerTool(
    "get_patients_count",
    {
      description: "Get the patient count within the hospital",
      inputSchema: {
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      },
      // outputSchema: {
      //   size: z
      //     .number()
      //     .describe("Total number of patient the function returns"),
      // },
    },
    async function (c) {
      const output = { size: Math.ceil(Math.random() * 100 + 10) };
      console.error(output);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output),
          },
        ],
        output,
      };
    },
  );

  return server;
};
