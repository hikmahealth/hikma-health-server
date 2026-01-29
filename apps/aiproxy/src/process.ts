import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMCPServer } from "./mcp.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import reportTemplate from "./hh/report-template.js";
import z from "zod/v3";
const server = createMCPServer();
async function main() {
  // save the report template schema

  const reportTemplateSchema = zodToJsonSchema(z.object(reportTemplate));
  const reportFilePath = path.join(
    import.meta.dirname,
    "../resources/report-template.schema.json",
  );

  await fs.writeFile(
    reportFilePath,
    JSON.stringify(reportTemplateSchema, null, 2),
  );
  server.registerResource(
    "report-template",
    reportFilePath,
    {
      mimeType: "application/json",
      title: "Report template",
      description:
        "Schema that defines the structure of how the report should be created.",
    },
    async () => {
      const content = await fs.readFile(reportFilePath, "utf-8");
      return {
        contents: [
          {
            uri: reportFilePath,
            text: content,
            mimeType: "application/json",
          },
        ],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  transport.onerror = (err) => {
    console.error("TRANSPORT ERROR::", err);
  };

  console.error("HikmaHealth MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

process.on("exit", function () {
  server.close();
});
