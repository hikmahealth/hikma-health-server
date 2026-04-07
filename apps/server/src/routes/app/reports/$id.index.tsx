import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { ReportGrid } from "@/components/reports/report-grid";
import {
  fetchAllComponentData,
  type ComponentData,
} from "@/lib/ai-service/reports-editor";
import Report from "@/models/report";
import { superAdminMiddleware } from "@/middleware/auth";
import { isUserSuperAdmin } from "@/lib/auth/request";
import { NewReportComponentDialog } from "@/components/reports/new-report-component-dialog";
import type { report as ReportType } from "@/lib/ai-service/report.gen";

const getReport = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .middleware([superAdminMiddleware])
  .handler(async ({ data }) => {
    return await Report.API.getById(data.id);
  });

export const Route = createFileRoute("/app/reports/$id/")({
  component: RouteComponent,
  loader: async ({ params }) => {
    const report = await getReport({ data: { id: params.id } });
    if (!report) {
      return { report: null, data: [] as ComponentData[] };
    }
    const { startAt, endAt } = Report.resolveTimeRange(report.timeRange);
    const isSuperAdmin = await isUserSuperAdmin();
    const data = await fetchAllComponentData({
      data: {
        components: report.components,
        startAt,
        endAt,
      },
    });
    return { report, data, isSuperAdmin };
  },
});

function RouteComponent() {
  const { id } = Route.useParams();
  const {
    report: loaderReport,
    data: loaderData,
    isSuperAdmin,
  } = Route.useLoaderData();
  const [report, setReport] = useState<ReportType | null>(loaderReport);
  const [data, setData] = useState<ComponentData[]>(loaderData);

  if (!report) {
    return (
      <div className="p-6">
        <p className="text-sm text-zinc-500">Report not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="">
        <div>
          <h1 className="text-xl font-semibold">{report.name}</h1>

          <p className="text-sm text-zinc-800 mt-1">{report.description}</p>
        </div>
        <div className="flex gap-2 items-center mt-2">
          <Link to="/app/reports/$id/edit" params={{ id }}>
            <Button variant="outline">Edit</Button>
          </Link>
          {/*<NewReportComponentDialog
            reportId={report.id}
            existingComponents={report.components}
            gridColumns={report.layout.columns}
            onAdd={(component) => {
              setReport((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  components: [...prev.components, component],
                };
              });
              setData((prev) => [
                ...prev,
                { componentId: component.id, rows: [], error: null },
              ]);
            }}
          />*/}
        </div>
      </div>

      <ReportGrid
        report={report}
        data={data}
        isSuperAdmin={isSuperAdmin}
        isEditable={false}
        onDeleteComponent={(componentId) => {
          setReport((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              components: prev.components.filter((c) => c.id !== componentId),
            };
          });
          setData((prev) => prev.filter((d) => d.componentId !== componentId));
        }}
      />
    </div>
  );
}
