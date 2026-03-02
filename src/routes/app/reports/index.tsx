import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/reports/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Reports</h1>
        <Button disabled>Create Report</Button>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 space-y-2">
        <p className="font-medium text-zinc-800">
          This feature is under active development and will be live soon.
        </p>
        <p>
          If you'd like to test it in your clinic, please contact the Hikma
          Health tech team for early access.
        </p>
      </div>
    </div>
  );
}
