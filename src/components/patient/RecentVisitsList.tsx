import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { format } from "date-fns";
import type { VisitWithEvents } from "@/lib/server-functions/visits";
import type Event from "@/models/event";
import type { Pagination } from "@/lib/server-functions/builders";
import { PaginationControls } from "./PaginationControls";

type Props = {
  visits: VisitWithEvents[];
  pagination: Pagination;
  onPageChange: (offset: number) => void;
  loading?: boolean;
};

/** Format a visit's check-in date for display. Returns "—" for null/missing/invalid. */
export const formatVisitDate = (
  date: Date | string | null | undefined,
): string => {
  if (!date) return "—";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—";
    return format(d, "MMM dd, yyyy HH:mm");
  } catch {
    return "—";
  }
};

/** Summarise an event for display: prefer event_type, fall back to form_id prefix. */
export const eventSummary = (event: Event.EncodedT): string =>
  event.event_type?.trim() ||
  (event.form_id ? `Form ${event.form_id.slice(0, 8)}` : "Event");

/** Single event row inside a visit. */
export function EventRow({ event }: { event: Event.EncodedT }) {
  return (
    <div
      className="flex items-start justify-between py-2 text-sm"
      data-testid="event-row"
    >
      <div className="space-y-0.5">
        <p className="font-medium">{eventSummary(event)}</p>
        <p className="text-xs text-muted-foreground">
          {formatVisitDate(event.created_at)}
        </p>
      </div>
      {/*{event.form_data.length > 0 && (
        <Badge variant="outline" className="text-xs">
          {event.form_data.length}{" "}
          {event.form_data.length === 1 ? "entry" : "entries"}
        </Badge>
      )}*/}
    </div>
  );
}

/** Single visit row — collapsible to reveal events. */
export function VisitRow({ visit }: { visit: VisitWithEvents }) {
  const hasEvents = visit.events.length > 0;

  const header = (
    <div className="flex justify-between items-start w-full">
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {formatVisitDate(visit.check_in_timestamp ?? visit.created_at)}
        </p>
        <div className="flex gap-2 text-sm text-muted-foreground">
          {visit.provider_name?.trim() && (
            <span>Provider: {visit.provider_name.trim()}</span>
          )}
          <span className="font-mono text-xs">{visit.id.slice(0, 8)}</span>
        </div>
      </div>
      {hasEvents && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>
            {visit.events.length}{" "}
            {visit.events.length === 1 ? "event" : "events"}
          </span>
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
        </div>
      )}
    </div>
  );

  if (!hasEvents) {
    return <div className="border rounded-lg p-4">{header}</div>;
  }

  return (
    <Collapsible className="group border rounded-lg">
      <CollapsibleTrigger className="flex w-full p-4 text-left cursor-pointer">
        {header}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t px-4 pb-3 divide-y">
          {visit.events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function RecentVisitsList({
  visits,
  pagination,
  onPageChange,
  loading,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Visits</CardTitle>
        <CardDescription>Patient's visit history</CardDescription>
      </CardHeader>
      <CardContent>
        {visits.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No recent visits recorded
          </div>
        ) : (
          <div className="space-y-3">
            {visits.map((visit) => (
              <VisitRow key={visit.id} visit={visit} />
            ))}
            {/*{pagination.total > 0 && (*/}
            <PaginationControls
              pagination={pagination}
              onPageChange={onPageChange}
              loading={loading}
            />
            {/*)}*/}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
