// import { getCookieToken } from '@/lib/auth/request'
import { Button } from "@/components/ui/button";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Users, FileText, Activity, ClipboardList } from "lucide-react";
import { createServerFn } from "@tanstack/react-start";
import db from "@/db";
import { sql } from "kysely";

const getSummaryStats = createServerFn({
  method: "GET",
}).handler(async () => {
  const query = sql`
      SELECT
        (SELECT count(*) FROM users WHERE is_deleted = FALSE) as user_count,
        (SELECT count(*) FROM patients WHERE is_deleted = FALSE) as patient_count,
        (SELECT count(*) FROM visits WHERE is_deleted = FALSE) as visit_count,
        (SELECT count(*) FROM event_forms WHERE is_deleted = FALSE) as form_count
    `.compile(db);

  const result = await db.executeQuery<{
    user_count: number;
    patient_count: number;
    visit_count: number;
    form_count: number;
  }>(query);

  const { user_count, patient_count, visit_count, form_count } = result.rows[0];
  return {
    clinicUsers: user_count,
    totalPatients: patient_count,
    totalVisits: visit_count,
    totalForms: form_count,
  };
});

export const Route = createFileRoute("/app/")({
  beforeLoad: async ({ location }) => {},
  component: RouteComponent,
  loader: async () => await getSummaryStats(),
});

interface StatsCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
}

function StatsCard({ title, value, description, icon }: StatsCardProps) {
  return (
    <Card className="">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
          {title}
        </h3>
        <div className="text-zinc-400">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-zinc-400 mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function RouteComponent() {
  const { clinicUsers, totalPatients, totalVisits, totalForms } =
    Route.useLoaderData();
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Clinic Users"
          value={clinicUsers}
          description="Users in your clinic's account"
          icon={<Users size={20} />}
        />
        <StatsCard
          title="Total Patients"
          value={totalPatients}
          description="All patients registered to your clinic"
          icon={<FileText size={20} />}
        />
        <StatsCard
          title="Total Visits"
          value={totalVisits}
          description="Visits across your clinic"
          icon={<Activity size={20} />}
        />
        <StatsCard
          title="Total Forms"
          value={totalForms}
          description="Forms created in your clinic"
          icon={<ClipboardList size={20} />}
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <h3 className="text-lg font-medium">Recent Activity</h3>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-400">Activity chart will go here</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
