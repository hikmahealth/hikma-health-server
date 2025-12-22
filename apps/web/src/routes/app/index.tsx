// import { getCookieToken } from '@/lib/auth/request'
import { AppSidebar, navData } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@hh/ui/components/breadcrumb";
import { Separator } from "@hh/ui/components/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@hh/ui/components/sidebar";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import React from "react";
// import { createServerFileRoute } from '@tanstack/react-start/server'
import { getCurrentUser } from "@/lib/server-functions/auth";
import { getAllClinics } from "@/lib/server-functions/clinics";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "kysely";
import { Card, CardContent, CardHeader } from "@hh/ui/components/card";
import { Users, FileText, Activity, ClipboardList } from "lucide-react";
import db from "@/db";

export const Route = createFileRoute("/app/")({
  beforeLoad: async ({ location }) => {
    // let clinic = Clinic.Table.name;
    const isValidToken = await fetch(`/api/auth/is-valid-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await isValidToken.json();
    console.log({ isValidToken, data });
    if (!data.isValid) {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: RouteComponent,
  loader: async () => {
    const [currentUser, clinics, stats] = await Promise.all([
      getCurrentUser(),
      getAllClinics(),
      getSummaryStats(),
    ]);

    return {
      currentUser,
      clinics,
      stats,
    };
  },
});

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

function SummaryComponent() {
  const {
    stats: { clinicUsers, totalPatients, totalVisits, totalForms },
  } = Route.useLoaderData();
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

function RouteComponent() {
  const { currentUser, clinics } = Route.useLoaderData();
  const handleSignOut = () => {
    if (window.confirm("Are you sure you want to sign out?")) {
      fetch(`/api/auth/sign-out`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then(() => {
          // Redirect to login page
          window.location.href = "/";
        })
        .catch((error) => {
          console.error("Error during sign-out:", error);
        });
    }
  };

  const route = useRouter();

  const breadcrumbs = getBreadcrumbs(
    route.latestLocation.pathname,
    navData.navMain,
  );

  return (
    <SidebarProvider>
      {currentUser && (
        <AppSidebar
          currentUser={currentUser}
          clinics={clinics}
          handleSignOut={handleSignOut}
        />
      )}
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.url || crumb.name}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {index === breadcrumbs.length - 1 ? (
                        <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={crumb.url || "#"}>
                          {crumb.name}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="px-8">
          <SummaryComponent />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/**
 * Get friendly named breadcrumbs
 * @param {string} path - current pathname
 * @param {typeof navData.navMain} items - navigation items
 */
function getBreadcrumbs(path: string, items: typeof navData.navMain) {
  // If path is just /app, return Dashboard
  if (path === "/app") {
    return [{ name: "Dashboard", url: "/app" }];
  }

  const breadcrumbs: { name: string; url: string }[] = [];
  const pathParts = path.split("/").filter(Boolean);

  // Skip the "app" part as it's the base
  if (pathParts[0] === "app") {
    pathParts.shift();
  }

  if (pathParts.length === 0) {
    return breadcrumbs;
  }

  // First level - find the main section (e.g., "patients")
  const mainSection = pathParts[0];
  const mainItem = items.find((item) => {
    // Check if this main item has a matching URL
    if (item.url === `/app/${mainSection}`) {
      return true;
    }

    // Check if any of its subitems have a matching URL
    if (
      item.items &&
      item.items.some((subItem) =>
        subItem.url.startsWith(`/app/${mainSection}`),
      )
    ) {
      return true;
    }

    return false;
  });

  if (mainItem) {
    breadcrumbs.push({
      name: mainItem.title,
      url: mainItem.url !== "#" ? mainItem.url : `/app/${mainSection}`,
    });

    // If we have a deeper path, look for matching subitems
    if (pathParts.length > 1 && mainItem.items) {
      const fullSubPath = `/app/${pathParts.join("/")}`;
      const subItem = mainItem.items.find((item) => item.url === fullSubPath);

      if (subItem) {
        breadcrumbs.push({
          name: subItem.title,
          url: subItem.url,
        });
      } else {
        // If no exact match found, just add the subpath as is
        breadcrumbs.push({
          name: pathParts.slice(1).join("/"),
          url: fullSubPath,
        });
      }
    }
  } else {
    // If no match found in main items, just return the path as is
    breadcrumbs.push({
      name: mainSection,
      url: `/app/${mainSection}`,
    });
  }

  return breadcrumbs;
}
