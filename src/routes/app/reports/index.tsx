import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Report from "@/models/report";
import ServerVariable from "@/models/server_variable";
import { superAdminMiddleware } from "@/middleware/auth";
import { truncate } from "es-toolkit/compat";
import { AlertTriangleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const getAllReports = createServerFn({ method: "GET" })
  .middleware([superAdminMiddleware])
  .handler(async () => {
    return await Report.API.getAll();
  });

const checkAiConfig = createServerFn({ method: "GET" })
  .middleware([superAdminMiddleware])
  .handler(async () => {
    const [url, proxyKey] = await Promise.all([
      ServerVariable.getAsString(ServerVariable.Keys.AI_DATA_ANALYSIS_URL),
      ServerVariable.getAsString(ServerVariable.Keys.AI_PROXY_SERVICE_API_KEY),
    ]);
    return {
      hasUrl: !!url,
      hasProxyKey: !!proxyKey,
    };
  });

export const Route = createFileRoute("/app/reports/")({
  component: RouteComponent,
  loader: async () => {
    const [reports, aiConfig] = await Promise.all([
      getAllReports(),
      checkAiConfig(),
    ]);
    return { reports, aiConfig };
  },
});

function RouteComponent() {
  const { reports, aiConfig } = Route.useLoaderData();
  const navigate = useNavigate();
  const aiConfigured = aiConfig.hasUrl && aiConfig.hasProxyKey;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Reports</h1>
        <Link to="/app/reports/$id/edit" params={{ id: "new" }}>
          <Button disabled={!aiConfigured}>Create Report</Button>
        </Link>
      </div>

      <Alert className=" border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
        <AlertTriangleIcon />
        <AlertTitle>🧪 Reports feature is under development.</AlertTitle>
        <AlertDescription>
          The reports feature is new and under active development. Please report
          any issues you experience and expect changes in the coming weeks.
        </AlertDescription>
      </Alert>

      {!aiConfigured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1">
          <p className="font-medium">AI service not configured</p>
          <p>
            To generate reports with AI, set the{" "}
            {!aiConfig.hasUrl && "AI service URL"}
            {!aiConfig.hasUrl && !aiConfig.hasProxyKey && " and "}
            {!aiConfig.hasProxyKey && "AI proxy service API key"} in the{" "}
            <Link
              to="/app/settings/configurations"
              className="underline font-medium"
            >
              configurations page
            </Link>
            .
          </p>
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">🚩 Verify AI-generated reports</p>
        <p>
          AI-generated reports may contain inaccuracies. Always review the
          underlying data and queries before making decisions based on these
          results.
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600">
          <p>No reports yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table className="overflow-scroll">
            <TableHeader>
              <TableRow>
                <TableHead className="px-6">Name</TableHead>
                <TableHead className="px-6">Description</TableHead>
                <TableHead className="px-6">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow
                  key={report.id}
                  className="hover:bg-gray-100 cursor-pointer"
                  onClick={() =>
                    navigate({
                      to: "/app/reports/$id",
                      params: { id: report.id },
                    })
                  }
                >
                  <TableCell className="px-6">{report.name}</TableCell>
                  <TableCell className="px-6 text-zinc-500 whitespace-pre">
                    {truncate(report.description || "—", { length: 256 })}
                  </TableCell>
                  <TableCell className="px-6 text-zinc-500">
                    {new Date(report.updated_at)?.toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
