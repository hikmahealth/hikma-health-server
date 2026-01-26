import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMCPServer } from "./mcp.js";

const server = createMCPServer();
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("HikmaHealth MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

process.on("exit", function () {
  server.close();
});
