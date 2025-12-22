"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import ReactSelect from "react-select";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@hh/ui/components/form";
import { Input } from "@hh/ui/components/input";
import { Button } from "@hh/ui/components/button";
import { Textarea } from "@hh/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hh/ui/components/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@hh/ui/components/card";
import { Separator } from "@hh/ui/components/separator";
import { Badge } from "@hh/ui/components/badge";
import { Collapsible, CollapsibleContent } from "@hh/ui/components/collapsible";
import { PatientSearchSelect } from "@/components/patient-search-select";
import type Prescription from "@/models/prescription";
import type Patient from "@/models/patient";
import DrugCatalogue from "@/models/drug-catalogue";
import { useClinicInventory } from "@/hooks/useClinicInventory";
import type User from "@/models/user";

// Define the prescription item schema based on the migration
const prescriptionItemSchema = z.object({
  id: z.string().optional(),
  prescription_id: z.string().optional(),
  patient_id: z.string().optional(),
  drug_id: z.string().min(1, "Please select a medication"),
  clinic_id: z.string().optional(),
  dosage_instructions: z.string().min(1, "Dosage instructions are required"),
  quantity_prescribed: z.number().min(1, "Quantity must be at least 1"),
  quantity_dispensed: z.number().default(0),
  refills_authorized: z.number().min(0).default(0),
  refills_used: z.number().default(0),
  item_status: z
    .enum(["active", "completed", "cancelled", "partially_dispensed"])
    .default("active"),
  notes: z.string().optional(),
});

// Define the form schema
const prescriptionFormSchema = z.object({
  patient_id: z.string().min(1, "Patient is required"),
  provider_id: z.string().min(1, "Provider is required"),
  filled_by: z.string().optional().nullable(),
  pickup_clinic_id: z.string().min(1, "Pickup clinic is required"),
  visit_id: z.string().optional().nullable(),
  priority: z.enum(["high", "low", "normal", "emergency"]),
  expiration_date: z.string().optional().nullable(),
  prescribed_at: z.string().optional(),
  filled_at: z.string().optional().nullable(),
  status: z.enum([
    "pending",
    "prepared",
    "picked-up",
    "not-picked-up",
    "partially-picked-up",
    "cancelled",
    "other",
  ]),
  notes: z.string(),
});

export type PrescriptionFormValues = z.infer<typeof prescriptionFormSchema>;
export type PrescriptionItemValues = z.infer<typeof prescriptionItemSchema>;

type MedicationOption = {
  value: string;
  label: string;
  drug: {
    generic_name: string | null;
    brand_name: string | null;
    form: string | null;
    route: string | null;
    dosage_quantity: number | null;
    dosage_units: string | null;
    batch_number: string | null;
    quantity: number | null;
  };
};

export interface PrescriptionFormProps {
  prescription?: Partial<Prescription.EncodedT>;
  medications: DrugCatalogue.ApiDrug[];
  isEditMode?: boolean;
  patient?: Patient.EncodedT;
  patientName?: string;
  providerName?: string;
  providers: User.EncodedT[];
  clinics?: Array<{ id: string; name: string }>;
  onSubmit: (
    prescription: PrescriptionFormValues,
    items: PrescriptionItemValues[],
  ) => void | Promise<void>;
  onPickupClinicChange?: (clinicId: string) => void | Promise<void>;
}

/**
 * PrescriptionForm Component
 *
 * A comprehensive form component for creating and editing medical prescriptions.
 * This component manages the state of both the prescription metadata and individual
 * medication items within the prescription.
 *
 * @component
 *
 * @description
 * The form provides the following functionality:
 * - Create new prescriptions or edit existing ones
 * - Add multiple medications with detailed dosage instructions
 * - Manage prescription priority and status
 * - Set pickup clinic location with dynamic medication availability
 * - Track individual medication items with quantity, refills, and notes
 * - Read-only patient information in edit mode
 *
 * The form uses react-hook-form for form management and zod for validation.
 * Each medication item can be expanded to show detailed configuration options.
 *
 * @param {PrescriptionFormProps} props - The component props
 * @param {Partial<Prescription.EncodedT>} [props.prescription] - Existing prescription data for editing
 * @param {boolean} [props.isEditMode=false] - Whether the form is in edit mode (makes patient info read-only)
 * @param {Patient.EncodedT} [props.patient] - Patient object for pre-selecting patient in the search field
 * @param {string} [props.patientName] - Display name of the patient (used in edit mode)
 * @param {string} [props.providerName] - Display name of the provider (used in edit mode)
 * @param {Array<{id: string, name: string}>} [props.clinics] - Available clinic locations for prescription pickup
 * @param {Function} props.onSubmit - Callback when form is submitted with prescription and items data
 * @param {Function} [props.onPickupClinicChange] - Callback when pickup clinic changes (triggers medication list update)
 * ```
 */
export function PrescriptionForm({
  prescription,
  isEditMode = false,
  patient,
  patientName,
  providerName,
  providers = [],
  clinics = [],
  onSubmit,
  onPickupClinicChange,
}: PrescriptionFormProps) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>(
    {},
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    items: inventoryItems,
    loading,
    setClinicId: setInventoryClinicId,
    setSearchQuery: setInventorySearchQuery,
    refetch: refetchInventory,
  } = useClinicInventory();

  const medications = [];

  // Initialize form with prescription data
  const form = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionFormSchema),
    defaultValues: {
      patient_id: prescription?.patient_id || "",
      provider_id: prescription?.provider_id || "",
      filled_by: prescription?.filled_by || null,
      pickup_clinic_id: prescription?.pickup_clinic_id || "",
      visit_id: prescription?.visit_id || null,
      priority: (prescription?.priority as any) || "normal",
      expiration_date: prescription?.expiration_date
        ? new Date(prescription.expiration_date).toISOString().split("T")[0]
        : null,
      prescribed_at: prescription?.prescribed_at
        ? new Date(prescription.prescribed_at).toISOString()
        : new Date().toISOString(),
      filled_at: prescription?.filled_at
        ? new Date(prescription.filled_at).toISOString()
        : null,
      status: (prescription?.status as any) || "pending",
      notes: prescription?.notes || "",
    },
  });

  // Initialize prescription items state
  const [prescriptionItems, setPrescriptionItems] = useState<
    PrescriptionItemValues[]
  >(() => {
    if (prescription?.items && Array.isArray(prescription.items)) {
      return prescription.items as PrescriptionItemValues[];
    }
    return [];
  });

  // Watch for pickup clinic changes
  const pickupClinicId = form.watch("pickup_clinic_id");

  useEffect(() => {
    if (pickupClinicId && onPickupClinicChange) {
      onPickupClinicChange(pickupClinicId);

      // on change of the pick up clinic, update the clinic inventory items
      setInventoryClinicId(pickupClinicId);
    }

    if (!pickupClinicId) {
      setInventoryClinicId("");
    }
  }, [pickupClinicId, onPickupClinicChange]);

  // Add a new medication item
  const addMedicationItem = () => {
    setPrescriptionItems([
      ...prescriptionItems,
      {
        drug_id: "",
        dosage_instructions: "",
        quantity_prescribed: 1,
        quantity_dispensed: 0,
        refills_authorized: 0,
        refills_used: 0,
        item_status: "active",
        notes: "",
      },
    ]);
  };

  // Remove a medication item
  const removeMedicationItem = (index: number) => {
    setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index));
  };

  // Update a medication item
  const updateMedicationItem = (
    index: number,
    field: keyof PrescriptionItemValues,
    value: any,
  ) => {
    const updatedItems = [...prescriptionItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };
    setPrescriptionItems(updatedItems);
  };

  // Toggle item expansion
  const toggleItemExpansion = (index: number) => {
    setExpandedItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Get medication details by ID
  const getMedicationDetails = (drugId: string) => {
    const result = inventoryItems.find((med) => med.drug_id === drugId);

    return result;
  };

  // Form submission handler
  const handleSubmit = async (data: PrescriptionFormValues) => {
    // Validate prescription items
    const hasErrors = prescriptionItems.some((item) => {
      return (
        !item.drug_id ||
        !item.dosage_instructions ||
        item.quantity_prescribed < 1
      );
    });

    if (hasErrors) {
      // You might want to show a toast or alert here
      console.error("Please fill in all required fields for medications");
      return;
    }

    if (prescriptionItems.length === 0) {
      console.error("Please add at least one medication");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(data, prescriptionItems);
    } finally {
      setIsSubmitting(false);
    }
  };

  console.log({ inventoryItems });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Patient and Provider Information */}
        <Card>
          <CardHeader>
            <CardTitle>Patient & Provider Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Patient Selection - Read-only in edit mode */}
              <div className="space-y-2">
                {isEditMode ? (
                  <FormItem>
                    <FormLabel>Patient</FormLabel>
                    <div className="flex items-center h-10 px-3 border rounded-md bg-muted">
                      <span>
                        {patientName ||
                          (patient &&
                            `${patient.given_name} ${patient.surname}`) ||
                          form.getValues("patient_id")}
                      </span>
                    </div>
                  </FormItem>
                ) : (
                  <PatientSearchSelect
                    label="Patient"
                    withAsterisk
                    isMulti={false}
                    value={form.watch("patient_id")}
                    defaultValue={prescription?.patient_id}
                    defaultPatients={patient ? [patient] : []}
                    onChange={(selectedPatient) => {
                      if (selectedPatient) {
                        form.setValue("patient_id", selectedPatient.id);
                      }
                    }}
                  />
                )}
              </div>

              {/* Provider ID - Read-only in edit mode */}
              {/*<FormField
                control={form.control}
                name="provider_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    <FormControl>
                      {isEditMode ? (
                        <div className="flex items-center h-10 px-3 border rounded-md bg-muted">
                          <span>{providerName || field.value}</span>
                        </div>
                      ) : (
                        <Input {...field} placeholder="Provider ID" />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />*/}

              <FormField
                control={form.control}
                name="provider_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    <ReactSelect
                      options={providers.map((provider) => ({
                        label: provider.name,
                        value: provider.id,
                      }))}
                      defaultValue={
                        providers.find(
                          (provider) => provider.id === field.value,
                        ) || ""
                      }
                      onChange={({ value }) => field.onChange(value)}
                      placeholder="Select provider"
                      className="w-full"
                    />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pickup Clinic */}
              <FormField
                control={form.control}
                name="pickup_clinic_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pickup Clinic</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select pickup clinic" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clinics.map((clinic) => (
                          <SelectItem key={clinic.id} value={clinic.id}>
                            {clinic.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Priority */}
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="prepared">Prepared</SelectItem>
                        <SelectItem value="picked-up">Picked Up</SelectItem>
                        <SelectItem value="not-picked-up">
                          Not Picked Up
                        </SelectItem>
                        <SelectItem value="partially-picked-up">
                          Partially Picked Up
                        </SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Expiration Date */}
              <FormField
                control={form.control}
                name="expiration_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiration Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormDescription>
                      Optional: When this prescription expires
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Prescription Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prescription Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter any additional notes for this prescription"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Medications Section */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Medications</CardTitle>
              <Button
                type="button"
                onClick={addMedicationItem}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Medication
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {prescriptionItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No medications added yet. Click "Add Medication" to start.
              </div>
            ) : (
              prescriptionItems.map((item, index) => {
                console.log("(item.drug_id)", item.drug_id);
                const medicationDetails = getMedicationDetails(item.drug_id);
                const isExpanded = expandedItems[index] || false;

                return (
                  <Card key={index} className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary">#{index + 1}</Badge>
                            {item.item_status && (
                              <Badge
                                variant={
                                  item.item_status === "active"
                                    ? "default"
                                    : item.item_status === "cancelled"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {item.item_status}
                              </Badge>
                            )}
                          </div>

                          {/* Medication Selection */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              Medication <span className="text-red-500">*</span>
                            </label>
                            <ReactSelect<(typeof inventoryItems)[0]>
                              // TODO: for updating things
                              // value={
                              //   item.drug_id
                              //     ? inventoryItems.find(
                              //         (opt) => opt.value === item.drug_id,
                              //       )
                              //     : null
                              // }
                              onChange={(selected) => {
                                updateMedicationItem(
                                  index,
                                  "drug_id",
                                  selected?.drug_id || "",
                                );
                              }}
                              // options={inventoryItems.map((option) => ({
                              //   value: option.drug_id,
                              //   label: `${option.brand_name} (${option.generic_name}) - ${option.form} - ${option.dosage_quantity}${option.dosage_units}`,
                              // }))}
                              options={inventoryItems}
                              placeholder="Search and select medication..."
                              isClearable
                              getOptionValue={(option) => option.drug_id}
                              isSearchable
                              onInputChange={(value) =>
                                setInventorySearchQuery(value)
                              }
                              formatOptionLabel={(option) => (
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {option.brand_name} ({option.generic_name})
                                  </span>
                                  {option.brand_name && (
                                    <span className="text-sm text-muted-foreground">
                                      {parseFloat(option.dosage_quantity || 0)}{" "}
                                      {option.dosage_units} • {option.form} •{" "}
                                      {option.route} • {option.quantity}{" "}
                                      remaining
                                    </span>
                                  )}
                                </div>
                              )}
                              classNames={{
                                control: () => "min-h-[40px] border-input",
                                menu: () =>
                                  "bg-popover border border-input shadow-md",
                                option: () =>
                                  "hover:bg-accent hover:text-accent-foreground cursor-pointer p-2",
                                placeholder: () => "text-muted-foreground",
                                input: () => "text-foreground",
                                singleValue: () => "text-foreground",
                              }}
                            />
                          </div>

                          {/* Display medication details if selected */}
                          {medicationDetails && (
                            <div className="mt-3 p-3 bg-muted rounded-md space-y-1">
                              <div className="text-sm">
                                <span className="font-medium">
                                  Generic Name:
                                </span>{" "}
                                {medicationDetails.generic_name}
                              </div>
                              {medicationDetails.brand_name && (
                                <div className="text-sm">
                                  <span className="font-medium">
                                    Brand Name:
                                  </span>{" "}
                                  {medicationDetails.brand_name}
                                </div>
                              )}
                              <div className="text-sm">
                                <span className="font-medium">Form:</span>{" "}
                                {medicationDetails.form || "N/A"}
                              </div>
                              <div className="text-sm">
                                <span className="font-medium">Route:</span>{" "}
                                {medicationDetails.route || "N/A"}
                              </div>
                              {medicationDetails.dosage_quantity && (
                                <div className="text-sm">
                                  <span className="font-medium">Dosage:</span>{" "}
                                  {parseFloat(
                                    medicationDetails.dosage_quantity,
                                  )}{" "}
                                  {medicationDetails.dosage_units}
                                </div>
                              )}
                              <div className="text-sm">
                                <span className="font-medium">
                                  Quantity Remaining:
                                </span>{" "}
                                {parseFloat(
                                  String(medicationDetails.quantity),
                                ) || 0}{" "}
                                units
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleItemExpansion(index)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMedicationItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <Collapsible open={isExpanded}>
                      <CollapsibleContent>
                        <CardContent className="pt-0 space-y-4">
                          <Separator />

                          {/* Dosage Instructions */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              Dosage Instructions{" "}
                              <span className="text-red-500">*</span>
                            </label>
                            <Textarea
                              placeholder="e.g., Take 2 tablets by mouth twice daily after meals"
                              value={item.dosage_instructions}
                              onChange={(e) =>
                                updateMedicationItem(
                                  index,
                                  "dosage_instructions",
                                  e.target.value,
                                )
                              }
                              rows={2}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Quantity Prescribed */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium">
                                Quantity <span className="text-red-500">*</span>
                              </label>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity_prescribed}
                                onChange={(e) =>
                                  updateMedicationItem(
                                    index,
                                    "quantity_prescribed",
                                    parseInt(e.target.value) || 1,
                                  )
                                }
                              />
                            </div>

                            {/* Refills Authorized */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium">
                                Refills Authorized
                              </label>
                              <Input
                                type="number"
                                min="0"
                                value={item.refills_authorized}
                                onChange={(e) =>
                                  updateMedicationItem(
                                    index,
                                    "refills_authorized",
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>

                            {/* Item Status */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium">
                                Status
                              </label>
                              <Select
                                value={item.item_status}
                                onValueChange={(value: string) =>
                                  updateMedicationItem(
                                    index,
                                    "item_status",
                                    value,
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="completed">
                                    Completed
                                  </SelectItem>
                                  <SelectItem value="cancelled">
                                    Cancelled
                                  </SelectItem>
                                  <SelectItem value="partially_dispensed">
                                    Partially Dispensed
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Item Notes */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              Item Notes
                            </label>
                            <Textarea
                              placeholder="Special instructions or notes for this medication"
                              value={item.notes || ""}
                              onChange={(e) =>
                                updateMedicationItem(
                                  index,
                                  "notes",
                                  e.target.value,
                                )
                              }
                              rows={2}
                            />
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Saving..."
              : isEditMode
                ? "Update Prescription"
                : "Create Prescription"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
