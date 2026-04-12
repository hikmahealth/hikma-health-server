import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import Patient from "@/models/patient";
import * as React from "react";
import {
  LucideBox,
  LucideCalculator,
  LucideCalendar,
  LucideCalendarPlus,
  LucideChevronDown,
  LucideDownload,
  LucideFilter,
  LucideTrash,
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
  softDeletePatientsByIds,
} from "@/lib/server-functions/patients";
import { getAllClinics } from "@/lib/server-functions/clinics";
import { Result } from "@/lib/result";
import type Clinic from "@/models/clinic";
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

import type ExcelJS from "exceljs";
import Event from "@/models/event";
import EventForm from "@/models/event-form";
import { format } from "date-fns";
import User from "@/models/user";
import { toast } from "sonner";
import PatientProblem from "@/models/patient-problem";
import PatientVital from "@/models/patient-vital";
import { safeJSONParse } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useMap } from "usehooks-ts";
import If from "@/components/if";
import { DatePickerInput } from "@/components/date-picker-input";
import Select from "react-select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { forEach } from "ramda";
import { useEffect } from "react";
import { useImmerReducer } from "use-immer";
import { Logger } from "@hh/js-utils";

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
    const eventForms = await EventForm.API.getAll({ includeDeleted: true });
    const exportEvents = await Event.API.getAllForExport();
    const vitals = await PatientVital.API.getAll();
    const problems = await PatientProblem.getAll();
    return { patients, exportEvents, eventForms, vitals, problems };
  },
);

// Function to get all patients matching search filters for export (no pagination)
// Returns the same shape as getAllPatientsForExport, but scoped to matching patients
const getFilteredPatientsForExport = createServerFn({ method: "GET" })
  .inputValidator(
    (data: {
      searchQuery: string;
      registrationDateStart?: string;
      registrationDateEnd?: string;
      visitsDateStart?: string;
      visitsDateEnd?: string;
      clinicIds?: string[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== User.ROLES.SUPER_ADMIN) {
      throw new Error("Unauthorized");
    }
    const { patients } = await Patient.API.search({
      searchQuery: data.searchQuery,
      includeCount: false,
      registrationDateStart: data.registrationDateStart,
      registrationDateEnd: data.registrationDateEnd,
      visitsDateStart: data.visitsDateStart,
      visitsDateEnd: data.visitsDateEnd,
      clinicIds: data.clinicIds,
    });
    const patientIds = new Set(patients.map((p) => p.id));

    const eventForms = await EventForm.API.getAll({ includeDeleted: true });
    const allEvents = await Event.API.getAllForExport();
    const allVitals = await PatientVital.API.getAll();
    const allProblems = await PatientProblem.getAll();

    return {
      patients,
      exportEvents: allEvents.filter((e) => patientIds.has(e.patient_id)),
      eventForms,
      vitals: allVitals.filter((v) => patientIds.has(v.patient_id)),
      problems: allProblems.filter((p) => patientIds.has(p.patient_id)),
    };
  });

export const Route = createFileRoute("/app/patients/")({
  component: RouteComponent,
  loader: async () => {
    const { patients, pagination, error } = await getAllPatients();
    const clinicsResult = await getAllClinics();
    const clinics = Result.isOk(clinicsResult) ? clinicsResult.data : [];

    return {
      currentUser: await getCurrentUser(),
      patients: patients,
      pagination,
      clinics,
      patientRegistrationForm: await getPatientRegistrationForm(),
    };
  },
});

type SearchState = {
  searchQuery: string;
  clinicIds: string[];
  registrationDate: [Date | null, Date | null]; // Start date, End date
  visitsInDateRange: [Date | null, Date | null];
};

const initialSearchState: SearchState = {
  searchQuery: "",
  clinicIds: [],
  registrationDate: [null, null],
  visitsInDateRange: [null, null],
};

type SearchAction =
  | { type: "update-search-query"; payload: string }
  | { type: "update-clinic-ids"; payload: string[] }
  | { type: "update-registration-date-start"; payload: Date | null }
  | { type: "update-registration-date-end"; payload: Date | null }
  | { type: "update-visits-date-start"; payload: Date | null }
  | { type: "update-visits-date-end"; payload: Date | null }
  | { type: "reset" };

function searchReducer(draft: SearchState, action: SearchAction) {
  switch (action.type) {
    case "update-search-query":
      draft.searchQuery = action.payload;
      break;
    case "update-clinic-ids":
      draft.clinicIds = action.payload;
      break;
    case "update-registration-date-start":
      draft.registrationDate[0] = action.payload;
      break;
    case "update-registration-date-end":
      draft.registrationDate[1] = action.payload;
      break;
    case "update-visits-date-start":
      draft.visitsInDateRange[0] = action.payload;
      break;
    case "update-visits-date-end":
      draft.visitsInDateRange[1] = action.payload;
      break;
    case "reset":
      return initialSearchState;
  }
}

function RouteComponent() {
  const {
    currentUser,
    patients,
    pagination,
    patientRegistrationForm,
    clinics,
  } = Route.useLoaderData();

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
  const route = useRouter();
  const [currentPage, setCurrentPage] = React.useState(1);
  const [searchState, dispatchSearchAction] = useImmerReducer(
    searchReducer,
    initialSearchState,
  );
  const [loading, setLoading] = React.useState(false);

  const [selectedPatients, actions] = useMap<string, string>(); // [patientId, patientName]

  // Sync local state when loader data changes (e.g. after invalidation)
  useEffect(() => {
    setPatientsList(patients);
    setPaginationResults({ pagination });
  }, [patients, pagination]);

  // on mount page, invalidate the data
  useEffect(() => {
    route.invalidate({ sync: true });
  }, []);

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

  const hasActiveFilters =
    searchState.searchQuery.trim() !== "" ||
    searchState.clinicIds.length > 0 ||
    searchState.registrationDate[0] !== null ||
    searchState.registrationDate[1] !== null ||
    searchState.visitsInDateRange[0] !== null ||
    searchState.visitsInDateRange[1] !== null;

  // Function to handle search with pagination
  const handleSearch = (page = 1) => {
    setLoading(true);
    const offset = (page - 1) * pageSize;

    searchPatients({
      data: {
        searchQuery: searchState.searchQuery,
        offset,
        limit: pageSize,
        registrationDateStart:
          searchState.registrationDate[0]?.toISOString() ?? undefined,
        registrationDateEnd:
          searchState.registrationDate[1]?.toISOString() ?? undefined,
        visitsDateStart:
          searchState.visitsInDateRange[0]?.toISOString() ?? undefined,
        visitsDateEnd:
          searchState.visitsInDateRange[1]?.toISOString() ?? undefined,
        clinicIds:
          searchState.clinicIds.length > 0 ? searchState.clinicIds : undefined,
      },
    })
      .then((res) => {
        if (res.patients) {
          setPatientsList(res.patients);
          setPaginationResults(res);
          setCurrentPage(page);
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

  const handleToggleSelectedPatients = (
    patientId: string,
    patientName: string,
  ) => {
    const exists = selectedPatients.has(patientId);
    if (exists) {
      actions.remove(patientId);
    } else {
      actions.set(patientId, patientName);
    }
  };

  const handleResetPatientSelection = () => {
    actions.reset();
  };

  const handleDeleteSelectedPatients = async () => {
    const confirmPrompt = `Delete ${selectedPatients.size} patients`;
    if (
      prompt(`Type the phrase "${confirmPrompt}" to confirm`, "") ===
      confirmPrompt
    ) {
      const selectedPatientIds = Array.from(selectedPatients.keys());
      const { error, success } = await softDeletePatientsByIds({
        data: { ids: selectedPatientIds },
      });
      if (success) {
        setPatientsList(
          patientsList.filter(
            (patient) => !selectedPatientIds.includes(patient.id),
          ),
        );
        toast.success(
          `Successfully deleted ${selectedPatientIds.length} patient(s)`,
        );
      }
      if (error) {
        Logger.error(`Error deleting patients ${selectedPatientIds}: ${error}`);
        toast.error(`Error deleting patient(s)`);
      }
      actions.reset();
    } else {
      toast.info("Invalid confirmation phrase. Not deleting patients");
    }
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

  const addProblemsWorksheet = (
    workbook: ExcelJS.Workbook,
    problems: PatientProblem.EncodedWithPatientName[],
  ): ExcelJS.Worksheet => {
    const worksheet = workbook.addWorksheet("Patient Problems");
    const headerRow = [
      "ID",
      "Patient ID",
      "Given Name",
      "Surname",
      "Visit ID",
      "Code System",
      "Code",
      "Label",
      "Clinical Status",
      "Verification Status",
      "Severity Score",
      "Onset Date",
      "End Date",
      "Recorded By User ID",
      "Created At",
      "Updated At",
    ];
    worksheet.addRow(headerRow);
    worksheet.getRow(1).font = { bold: true };

    const rows: unknown[][] = [];
    problems.forEach((p) => {
      rows.push([
        p.id,
        p.patient_id,
        p.given_name ?? "",
        p.surname ?? "",
        p.visit_id,
        p.problem_code_system,
        p.problem_code,
        p.problem_label,
        p.clinical_status,
        p.verification_status,
        p.severity_score,
        p.onset_date,
        p.end_date,
        p.recorded_by_user_id,
        p.created_at,
        p.updated_at,
      ]);
    });

    worksheet.addRows(rows);
    return worksheet;
  };

  // Shared helpers for building export workbooks
  const addPatientsWorksheet = (
    worksheet: ExcelJS.Worksheet,
    exportPatients: (typeof Patient.PatientWithAttributesSchema.Encoded)[],
  ) => {
    const headerRow = ["ID", ...headers];
    worksheet.addRow(headerRow);
    worksheet.getRow(1).font = { bold: true };
    exportPatients.forEach((patient) => {
      const rowData = [patient.id];
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
  };

  const addEventFormsWorksheets = (
    workbook: ExcelJS.Workbook,
    eventForms: EventForm.EncodedT[],
    exportEvents: (Event.EncodedT & { patient?: Partial<Patient.EncodedT> })[],
  ) => {
    eventForms.forEach((eventForm) => {
      const isDeletedPrefix = eventForm.is_deleted ? "DEL - " : "";
      const worksheetIdSuffix = `${eventForm.id.substring(0, 6)}`;
      const worksheetName = `${isDeletedPrefix}${truncate(eventForm.name, {
        length: 18,
        omission: "..",
      })}(#${worksheetIdSuffix})`.replace(/[*?:\\/\[\]]/g, "-");

      const worksheet = workbook.addWorksheet(worksheetName);
      const extraColumns = {
        patient_id: "Patient ID",
        patient_name: "Patient Name",
        patient_sex: "Patient Sex",
        patient_phone_number: "Patient Phone",
        patient_citizenship: "Patient Citizenship",
        patient_date_of_birth: "Patient Date of Birth",
        visit_id: "Visit ID",
        created_at: "Created At",
      };
      const eventFormFields = safeJSONParse(
        eventForm.form_fields,
        [],
      ) as typeof eventForm.form_fields;
      const headerRow = [
        "ID",
        ...eventFormFields?.map((f) => f.name),
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
          rowData.push(
            `${event?.patient?.given_name || ""} ${event?.patient?.surname || ""}`.trim(),
          );
          rowData.push(event?.patient?.sex || "");
          rowData.push(event?.patient?.phone || "");
          rowData.push(event?.patient?.citizenship || "");
          rowData.push(String(event?.patient?.date_of_birth || ""));
          rowData.push(event.visit_id || "");
          rowData.push(format(event.created_at, "yyyy-MM-dd HH:mm:ss"));
          worksheet.addRow(rowData);
        });
    });
  };

  const autoSizeColumns = (worksheet: ExcelJS.Worksheet) => {
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
  };

  const downloadWorkbook = async (
    workbook: ExcelJS.Workbook,
    fileName: string,
  ) => {
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
  };

  const buildExportWorkbook = async (exportData: {
    patients: (typeof Patient.PatientWithAttributesSchema.Encoded)[];
    exportEvents: (Event.EncodedT & { patient?: Partial<Patient.EncodedT> })[];
    eventForms: EventForm.EncodedT[];
    vitals: PatientVital.EncodedT[];
    problems: PatientProblem.EncodedWithPatientName[];
  }) => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = currentUser?.name ?? "";
    workbook.lastModifiedBy = currentUser?.name ?? "";
    workbook.created = new Date();
    workbook.modified = new Date();

    const patientsSheet = workbook.addWorksheet("Patients List");
    addPatientsWorksheet(patientsSheet, exportData.patients);
    autoSizeColumns(patientsSheet);

    addProblemsWorksheet(workbook, exportData.problems);
    addVitalsWorksheet(workbook, exportData.vitals);
    addEventFormsWorksheets(
      workbook,
      exportData.eventForms,
      exportData.exportEvents,
    );

    return workbook;
  };

  const handleExport = async () => {
    try {
      toast("Export started. Please be patient as this could take some time.", {
        dismissible: true,
        duration: 2000,
      });
      const exportData = await getAllPatientsForExport({});
      const workbook = await buildExportWorkbook(exportData as any);
      const fileName = `patients_export_${new Date().toISOString().split("T")[0]}.xlsx`;
      await downloadWorkbook(workbook, fileName);
    } catch (error: any) {
      Logger.error({ msg: "Error exporting patients:", error });
      toast.error("Failed to export patients", error.message);
    }
  };

  const handleFilteredExport = async () => {
    try {
      toast("Export started. Please be patient as this could take some time.", {
        dismissible: true,
        duration: 2000,
      });
      const exportData = await getFilteredPatientsForExport({
        data: {
          searchQuery: searchState.searchQuery,
          registrationDateStart:
            searchState.registrationDate[0]?.toISOString() ?? undefined,
          registrationDateEnd:
            searchState.registrationDate[1]?.toISOString() ?? undefined,
          visitsDateStart:
            searchState.visitsInDateRange[0]?.toISOString() ?? undefined,
          visitsDateEnd:
            searchState.visitsInDateRange[1]?.toISOString() ?? undefined,
          clinicIds:
            searchState.clinicIds.length > 0
              ? searchState.clinicIds
              : undefined,
        },
      });
      const workbook = await buildExportWorkbook(exportData as any);
      const fileName = `patients_filtered_export_${new Date().toISOString().split("T")[0]}.xlsx`;
      await downloadWorkbook(workbook, fileName);
    } catch (error: any) {
      Logger.error({ msg: "Error exporting filtered patients:", error });
      toast.error("Failed to export filtered patients");
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
      <div className="w-full flex flex-col gap-3 py-4 max-w-2xl">
        <Input
          className="pl-4 pr-4 max-w-2xl"
          placeholder="Search patients..."
          label="Search Patients"
          type="search"
          value={searchState.searchQuery}
          onChange={(e) =>
            dispatchSearchAction({
              type: "update-search-query",
              payload: e.target.value,
            })
          }
        />

        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 px-0 text-muted-foreground hover:text-foreground"
            >
              <LucideChevronDown className="h-4 w-4 transition-transform [[data-state=open]_&]:rotate-180" />
              Advanced filters
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-3 pt-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Primary Clinic</label>
              <Select
                isMulti
                placeholder="All clinics"
                options={clinics.map((c) => ({
                  value: c.id,
                  label: c.name ?? c.id,
                }))}
                value={searchState.clinicIds.map((id) => {
                  const clinic = clinics.find((c) => c.id === id);
                  return { value: id, label: clinic?.name ?? id };
                })}
                onChange={(selected) =>
                  dispatchSearchAction({
                    type: "update-clinic-ids",
                    payload: selected.map((s) => s.value),
                  })
                }
                classNamePrefix="react-select"
                className="max-w-md"
              />
            </div>

            <fieldset className="flex items-end gap-2">
              <legend className="text-sm font-medium mb-1">
                Patient was registered within this Date Range
              </legend>
              <DatePickerInput
                placeholder="From"
                value={searchState.registrationDate[0] ?? undefined}
                onChange={(date) =>
                  dispatchSearchAction({
                    type: "update-registration-date-start",
                    payload: date ?? null,
                  })
                }
                className="w-36"
              />
              <span className="pb-2 text-sm text-muted-foreground">
                &ndash;
              </span>
              <DatePickerInput
                placeholder="To"
                value={searchState.registrationDate[1] ?? undefined}
                onChange={(date) =>
                  dispatchSearchAction({
                    type: "update-registration-date-end",
                    payload: date ?? null,
                  })
                }
                className="w-36"
              />
            </fieldset>

            <fieldset className="flex items-end gap-2">
              <legend className="text-sm font-medium mb-1">
                Patient had a visit within this Date Range
              </legend>
              <DatePickerInput
                placeholder="From"
                value={searchState.visitsInDateRange[0] ?? undefined}
                onChange={(date) =>
                  dispatchSearchAction({
                    type: "update-visits-date-start",
                    payload: date ?? null,
                  })
                }
                className="w-36"
              />
              <span className="pb-2 text-sm text-muted-foreground">
                &ndash;
              </span>
              <DatePickerInput
                placeholder="To"
                value={searchState.visitsInDateRange[1] ?? undefined}
                onChange={(date) =>
                  dispatchSearchAction({
                    type: "update-visits-date-end",
                    payload: date ?? null,
                  })
                }
                className="w-36"
              />
            </fieldset>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => {
              dispatchSearchAction({ type: "reset" });
              handleSearch(1);
            }}
            className="text-muted-foreground"
          >
            Clear filters
          </Button>

          <Button
            type="submit"
            onClick={() => handleSearch(1)}
            disabled={loading}
          >
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>
      </div>

      <div className="pt-4 flex gap-3">
        <Button type="button" variant="outline" onClick={handleExport}>
          <LucideDownload className="mr-2 h-4 w-4" />
          Export All Patient Data
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleFilteredExport}
          disabled={!hasActiveFilters || patientsList.length === 0}
        >
          <LucideFilter className="mr-2 h-4 w-4" />
          Export Filtered Patients ({totalItems})
        </Button>
      </div>

      <If show={selectedPatients.size > 0}>
        <div className="mt-8 font-semibold">
          {selectedPatients.size} Patients Selected
        </div>
        <div className="space-x-4">
          <Button
            size={"default"}
            onClick={handleResetPatientSelection}
            variant="outline"
            className=""
          >
            <LucideBox className="mr-2 h-4 w-4" />
            Unselect all patients
          </Button>
          <Button
            size={"default"}
            variant="outline"
            onClick={handleDeleteSelectedPatients}
            className="text-red-800"
          >
            <LucideTrash className="mr-2 h-4 w-4 text-red-500" />
            Delete Selected Patients
          </Button>
        </div>
      </If>

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
              {headers?.map((header) => (
                <TableHead className="px-6" key={header}>
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {patientsList.length === 0 &&
              searchState.searchQuery.trim().length > 0 &&
              !loading && (
                <TableRow>
                  <TableCell
                    colSpan={headers.length + 2}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No results found matching your search
                  </TableCell>
                </TableRow>
              )}
            {patientsList?.map((patient) => (
              <TableRow
                className="hover:bg-gray-100 cursor-pointer"
                onClick={() => openPatientChart(patient.id)}
                key={patient.id}
              >
                <TableCell
                  className="px-6 space-x-4"
                  onClick={(evt) => {
                    // Prevent propagation of click event to parent elements
                    // evt.preventDefault();
                    evt.stopPropagation();
                  }}
                  key={"actions"}
                >
                  <Checkbox
                    checked={selectedPatients.has(patient.id)}
                    onCheckedChange={() => {
                      handleToggleSelectedPatients(
                        patient.id,
                        patient.given_name,
                      );
                    }}
                  />
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

            {pageNumbers?.map((pageNumber, index) => {
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
