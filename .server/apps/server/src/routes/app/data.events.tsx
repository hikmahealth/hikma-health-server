import { createFileRoute } from "@tanstack/react-router";
import { getEventForms } from "@/lib/server-functions/event-forms";
import { SelectInput } from "@/components/select-input";
import { Fragment, useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import Event from "@/models/event";
import { getEventsByFormId } from "@/lib/server-functions/events";
import { Option } from "effect";
import EventForm from "@/models/event-form";
import { format } from "date-fns";
import { createServerFn } from "@tanstack/react-start";
import User from "@/models/user";
import { getCurrentUser } from "@/lib/server-functions/auth";

// Function endpoint to get all the event data for exports (no pagination)
// const getEventDataForExport = createServerFn({ method: "GET" }).handler(
//   async ({ data }: { data: { eventFormId: string } }) => {
//     const currentUser = await getCurrentUser();
//     if (!currentUser || currentUser.role !== User.ROLES.SUPER_ADMIN) {
//       throw new Error("Unauthorized");
//     }

//     const eventForms = await EventForm.API.getById(data.eventFormId);
//     const exportEvents = await Event.API.getAllForExport(
//       data.eventFormId,
//       true,
//     );

//     return {
//       eventForms,
//       exportEvents,
//     };
//   },
// );

export const Route = createFileRoute("/app/data/events")({
  component: RouteComponent,
  loader: async () => {
    return {
      forms: await getEventForms({ data: { includeDeleted: true } }),
    };
  },
});

function RouteComponent() {
  const { forms } = Route.useLoaderData();

  const [eventsList, setEventsList] = useState<Event.EncodedT[]>([]);
  const [paginationResults, setPaginationResults] = useState<{
    pagination: {
      total: number;
      offset: number;
      limit: number;
      hasMore: boolean;
    };
  }>({
    pagination: {
      total: 0,
      offset: 0,
      limit: 0,
      hasMore: false,
    },
  });

  const [selectedForm, setSelectedForm] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const pageSize = Option.getOrElse(
    Option.fromNullable(paginationResults.pagination.limit),
    () => 10,
  );

  const totalItems = Option.getOrElse(
    Option.fromNullable(paginationResults.pagination.total),
    () => 0,
  );

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Function to handle search with pagination
  const fetchEvents = (page = 1) => {
    setLoading(true);
    const offset = (page - 1) * pageSize;

    getEventsByFormId({
      data: {
        form_id: selectedForm!,
        offset,
        limit: pageSize,
      },
    })
      .then((res) => {
        console.warn({ res });
        setEventsList(res.events);
        setPaginationResults(res);
        setCurrentPage(page);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Handle page change in a pure function way
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      fetchEvents(page);
    }
  };

  useEffect(() => {
    fetchEvents();

    // getEventDataForExport({ data: { form_id: selectedForm } })
    //   .then((res) => {
    //     console.log({ res });
    //   })
    //   .catch((error) => {
    //     console.error(error);
    //   });
  }, [selectedForm]);

  // Generate page numbers to display using functional approach
  const getPageNumbers = () => {
    // Always include first and last page
    const firstPage = 1;
    const lastPage = totalPages;

    // Include pages around current page
    const nearbyPages = Array.from(
      { length: 3 },
      (_, i) => Math.max(2, currentPage - 1) + i,
    ).filter((page) => page > firstPage && page < lastPage);

    // Combine and sort pages
    return Array.from(new Set([firstPage, ...nearbyPages, lastPage])).sort(
      (a, b) => a - b,
    );
  };

  const pageNumbers = getPageNumbers();

  // console.log({ eventsList, paginationResults, forms, selectedForm });

  // Table column names are present in the event form
  const tableColumns =
    forms.find((form) => form.id === selectedForm)?.form_fields || [];

  // console.log({ tableColumns });

  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Events Explorer</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <SelectInput
            label="Select an event form"
            className="w-full"
            defaultValue={selectedForm}
            onChange={(value) => setSelectedForm(value)}
            labelClassName="text-[14px] font-semibold nth-2:mt-8"
            data={[
              {
                label: "Active Forms",
                options: forms
                  .filter((form) => !form.is_deleted)
                  .map((form) => ({
                    label: form.name,
                    value: form.id,
                  })),
              },
              {
                label: "Deleted Forms",
                options: forms
                  .filter((form) => form.is_deleted)
                  .map((form) => ({
                    label: form.name,
                    value: form.id,
                  })),
              },
            ]}
          />
        </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableCaption>Event Forms</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                {tableColumns?.map((column) => (
                  <TableHead key={column.id}>{column.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventsList.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    {format(event.created_at, "yyyy-MM-dd HH:mm:ss")}
                  </TableCell>
                  {tableColumns?.map((column) => {
                    const field = event.form_data.find(
                      (c) => c.fieldId === column.id,
                    );
                    console.log({
                      field,
                      column,
                      event_form_data: event.form_data,
                    });
                    if (column.fieldType === "diagnosis") {
                      return (
                        <TableCell key={column.id}>
                          <RenderDiagnosisField field={field as any} />
                        </TableCell>
                      );
                    }
                    if (column.fieldType === "medicine") {
                      return (
                        <TableCell key={column.id}>
                          <RenderMedicineField field={field as any} />
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={column.id}>{field?.value}</TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="py-8">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => handlePageChange(currentPage - 1)}
                className={
                  currentPage <= 1
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>

            {pageNumbers.map((pageNumber, index) => {
              // Add ellipsis if there's a gap between page numbers
              const shouldShowEllipsis =
                index > 0 && pageNumber > pageNumbers[index - 1] + 1;

              return (
                <Fragment key={`page-${pageNumber}`}>
                  {shouldShowEllipsis && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  <PaginationItem>
                    <PaginationLink
                      onClick={() => handlePageChange(pageNumber)}
                      isActive={pageNumber === currentPage}
                      className="cursor-pointer"
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                </Fragment>
              );
            })}

            <PaginationItem>
              <PaginationNext
                onClick={() => handlePageChange(currentPage + 1)}
                className={
                  currentPage >= totalPages
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}

// TODO: improve the types of form_data to be specific to diagnosis
function RenderDiagnosisField({
  field,
}: {
  field?: { value: Array<{ code: string; desc: string }> };
}) {
  console.log(field?.value?.map((diagnosis) => diagnosis?.desc).join(", "));
  console.log(field?.value);
  return (
    <div>
      {field?.value
        ?.map((diagnosis) => `(${diagnosis?.code}) ${diagnosis?.desc}`)
        ?.join(", ")}
    </div>
  );
}

// TODO: improve the types of form_data to be specific to diagnosis
function RenderMedicineField({
  field,
}: {
  field?: {
    value: Array<{
      dose: number;
      doseUnits: string;
      duration: number;
      durationUnits: string;
      form: string;
      frequency: string;
      intervals: string;
      name: string;
      route: string;
    }>;
  };
}) {
  console.log(field?.value?.map((medicine) => medicine?.name)?.join(", "));
  console.log(field?.value);
  return (
    <div>
      {field?.value?.map((medicine) => (
        <>
          <div className="medicine-entry">
            <p className="medicine-name">
              {medicine?.name} ({medicine?.dose} {medicine?.doseUnits})
            </p>
            <p className="medicine-details">
              {medicine?.form} - {medicine?.route}
            </p>
            <p className="medicine-schedule">Frequency {medicine?.frequency}</p>
          </div>
        </>
      ))}
    </div>
  );
}
