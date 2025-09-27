import { createFileRoute, Link } from "@tanstack/react-router";
import Patient from "@/models/patient";
import * as React from "react";
import {
  LucideCalculator,
  LucideCalendar,
  LucideCalendarPlus,
  LucideDownload,
} from "lucide-react";
import { Option } from "effect";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { getPatientRegistrationForm } from "@/lib/server-functions/patient-registration-forms";
import {
  getAllPatients,
  searchPatients,
} from "@/lib/server-functions/patients";
import PatientRegistrationForm from "@/models/patient-registration-form";
import { createServerFn } from "@tanstack/react-start";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { truncate } from "es-toolkit/compat";
import { getCurrentUser } from "@/lib/server-functions/auth";

import ExcelJS from "exceljs";
import Event from "@/models/event";
import EventForm from "@/models/event-form";
import { format } from "date-fns";
import User from "@/models/user";
import { toast } from "sonner";
import PatientVital from "@/models/patient-vital";

// Function to get all patients for export (no pagination)
const getAllPatientsForExport = createServerFn({ method: "GET" }).handler(
  async () => {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== User.ROLES.SUPER_ADMIN) {
      throw new Error("Unauthorized");
    }
    // Use getAllWithAttributes with no limit to get all patients
    const { patients } = await Patient.API.getAllWithAttributes({
      includeCount: false,
    });
    const eventForms = await EventForm.API.getAll();
    const exportEvents = await Event.API.getAllForExport();
    const vitals = await PatientVital.API.getAll();
    return { patients, exportEvents, eventForms, vitals };
  },
);

export const Route = createFileRoute("/app/patients/")({
  component: RouteComponent,
  loader: async () => {
    const { patients, pagination, error } = await getAllPatients();

    return {
      currentUser: await getCurrentUser(),
      patients: patients,
      pagination,
      patientRegistrationForm: await getPatientRegistrationForm(),
    };
  },
});

function RouteComponent() {
  const { currentUser, patients, pagination, patientRegistrationForm } =
    Route.useLoaderData();

  const [patientsList, setPatientsList] =
    React.useState<(typeof Patient.PatientWithAttributesSchema.Encoded)[]>(
      patients,
    );
  const [paginationResults, setPaginationResults] = React.useState<{
    pagination: {
      offset: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  }>({
    pagination,
  });
  const navigate = Route.useNavigate();
  const [currentPage, setCurrentPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const fields = patientRegistrationForm?.fields.filter((f) => !f.deleted);
  const headers = fields?.map((f) => f.label.en) || [];

  // Calculate pagination values using functional approach
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
  const handleSearch = (page = 1) => {
    setLoading(true);
    const offset = (page - 1) * pageSize;

    searchPatients({
      data: {
        searchQuery,
        offset,
        limit: pageSize,
      },
    })
      .then((res) => {
        if (res.patients) {
          setPatientsList(res.patients);
          setPaginationResults(res);
          setCurrentPage(page);
          // scroll to the top
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Handle page change in a pure function way
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      handleSearch(page);
    }
  };

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

  const addVitalsWorksheet = (
    workbook: ExcelJS.Workbook,
    vitals: PatientVital.EncodedT[],
  ): ExcelJS.Worksheet => {
    const vitalsWorksheet = workbook.addWorksheet("Vitals");
    const columns = {
      id: "ID",
      patient_id: "Patient ID",
      visit_id: "Visit ID",
      timestamp: "Timestamp",
      systolic_bp: "Systolic BP",
      diastolic_bp: "Diastolic BP",
      bp_position: "BP Position",
      height_cm: "Height (cm)",
      weight_kg: "Weight (kg)",
      bmi: "BMI",
      waist_circumference_cm: "Waist Circumference (cm)",
      heart_rate: "Heart Rate",
      pulse_rate: "Pulse Rate",
      oxygen_saturation: "Oxygen Saturation",
      respiratory_rate: "Respiratory Rate",
      temperature_c: "Temperature (°C)",
      pain_level: "Pain Level",
      recorded_by_user_id: "Recorded By User ID",
      created_at: "Created At",
      updated_at: "Updated At",
    };
    const vitalsHeaderRow = Object.values(columns);
    vitalsWorksheet.addRow(vitalsHeaderRow);
    vitalsWorksheet.getRow(1).font = { bold: true };

    const vitalRowData = new Array(vitals.length);

    vitals.forEach((vital) => {
      vitalRowData.push([
        vital.id,
        vital.patient_id,
        vital.visit_id,
        vital.timestamp,
        vital.systolic_bp,
        vital.diastolic_bp,
        vital.bp_position,
        vital.height_cm,
        vital.weight_kg,
        vital.bmi,
        vital.waist_circumference_cm,
        vital.heart_rate,
        vital.pulse_rate,
        vital.oxygen_saturation,
        vital.respiratory_rate,
        vital.temperature_celsius,
        vital.pain_level,
        vital.recorded_by_user_id,
        vital.created_at,
        vital.updated_at,
      ]);
    });

    vitalsWorksheet.addRows(vitalRowData);

    return vitalsWorksheet;
  };

  const handleExport = async () => {
    try {
      // Create a new workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Patients List");

      // Set workbook properties
      workbook.creator = currentUser?.name ?? "";
      workbook.lastModifiedBy = currentUser?.name ?? "";
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.lastPrinted = new Date();

      // Get all patients for export (not paginated)
      const {
        vitals: patientVitals,
        patients: allPatients,
        exportEvents,
        eventForms,
      } = await getAllPatientsForExport({});

      // add Vitals
      addVitalsWorksheet(workbook, patientVitals);

      // for each event form type, add a new worksheet
      eventForms.forEach((eventForm) => {
        const worksheet = workbook.addWorksheet(eventForm.name);
        const extraColumns = {
          patient_id: "Patient ID",
          // patient_name: "Patient Name",
          visit_id: "Visit ID",
          created_at: "Created At",
          // provider_id: "Provider ID",
        };
        const eventFormFields = eventForm.form_fields;
        const headerRow = [
          "ID",
          ...eventFormFields.map((f) => f.name),
          ...Object.values(extraColumns),
        ];
        worksheet.addRow(headerRow);
        worksheet.getRow(1).font = { bold: true };

        exportEvents
          .filter((ev) => ev.form_id === eventForm.id)
          .forEach((event) => {
            const rowData = [event.id];
            eventFormFields?.forEach((field) => {
              const fieldData = event.form_data.find(
                (f) => f.fieldId === field.id,
              );
              rowData.push(JSON.stringify(fieldData?.value));
            });

            rowData.push(event.patient_id);
            rowData.push(event.visit_id || "");
            rowData.push(format(event.created_at, "yyyy-MM-dd HH:mm:ss"));
            // rowData.push(event.provider_id || "");
            worksheet.addRow(rowData);
          });
      });

      const headerRow = ["ID", ...headers];
      worksheet.addRow(headerRow);
      worksheet.getRow(1).font = { bold: true };
      allPatients.forEach((patient) => {
        const rowData = [patient.id];

        // Add data for each field in the registration form
        fields?.forEach((field) => {
          if (field.baseField) {
            rowData.push(
              String(
                PatientRegistrationForm.renderFieldValue(
                  field,
                  patient[field.column as keyof typeof patient],
                ),
              ),
            );
          } else {
            rowData.push(
              String(
                PatientRegistrationForm.renderFieldValue(
                  field,
                  patient.additional_attributes[field.id],
                ),
              ),
            );
          }
        });

        worksheet.addRow(rowData);
      });

      // Auto-size columns for better readability
      worksheet.columns?.forEach((column) => {
        let maxLength = 0;
        column?.eachCell?.({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      });

      // Generate a filename with current date - so that next download doesn't override previous
      const fileName = `patients_export_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      // Write to file and trigger download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      console.error("Error exporting patients:", error, error.message);
      toast.error("Failed to export patients", error.message);
    }
  };

  const openPatientChart = (patientId: string) => {
    navigate({ to: `/app/patients/${patientId}` });
  };

  const handleCreateAppointment = (
    event: React.MouseEvent<HTMLButtonElement>,
    patientId: string,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    navigate({ to: `/app/appointments/edit?patientId=${patientId}` });
  };

  const pageNumbers = getPageNumbers();

  if (!patientRegistrationForm) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold text-gray-800">
            No Registration Form Available
          </h2>
          <p className="text-gray-600">
            Please create a patient registration form first.
          </p>
          <Link to="/app/patients/customize-registration-form" className="mt-4">
            <Button className="primary">Create Registration Form</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="w-full flex items-center max-w-2xl gap-4 py-4">
        <Input
          className="pl-4 pr-4 md:w-lg"
          placeholder="Search patients..."
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Button
          className=""
          type="submit"
          onClick={() => handleSearch(1)}
          disabled={loading}
        >
          {loading ? "Searching..." : "Search"}
        </Button>
      </div>

      <div>
        <Button type="button" onClick={handleExport}>
          <LucideDownload className="mr-2 h-4 w-4" />
          Export All Patient Data
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden  mt-8">
        <Table className="overflow-scroll">
          <TableHeader>
            <TableRow>
              <TableHead className="px-6" key={"actions"}>
                Actions
              </TableHead>
              <TableHead className="px-6" key={"id"}>
                ID
              </TableHead>
              {headers.map((header) => (
                <TableHead className="px-6" key={header}>
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {patientsList.map((patient) => (
              <TableRow
                className="hover:bg-gray-100 cursor-pointer"
                onClick={() => openPatientChart(patient.id)}
                key={patient.id}
              >
                <TableCell className="px-6" key={"actions"}>
                  <Button
                    onClick={(evt) => handleCreateAppointment(evt, patient.id)}
                    variant="outline"
                  >
                    <LucideCalendarPlus />
                  </Button>
                </TableCell>
                <TableCell className="px-6" key={"id"}>
                  {truncate(patient.id, { length: 12, omission: "…" })}
                </TableCell>
                {fields?.map((field) =>
                  field.baseField ? (
                    <TableCell className="px-6" key={field.id}>
                      {PatientRegistrationForm.renderFieldValue(
                        field,
                        patient[field.column as keyof typeof patient],
                      )}
                    </TableCell>
                  ) : (
                    <TableCell className="px-6" key={field.id}>
                      {PatientRegistrationForm.renderFieldValue(
                        field,
                        patient.additional_attributes[field.id],
                      )}
                    </TableCell>
                  ),
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
                <React.Fragment key={`page-${pageNumber}`}>
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
                </React.Fragment>
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
