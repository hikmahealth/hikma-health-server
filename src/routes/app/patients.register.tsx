import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerInput } from "@/components/date-picker-input";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import PatientRegistrationForm from "@/models/patient-registration-form";
import Language from "@/models/language";
import { createServerFn } from "@tanstack/react-start";
import { Label } from "@/components/ui/label";
import Patient from "@/models/patient";
import upperFirst from "lodash/upperFirst";
import { Option } from "effect";
import { v1 as uuidv1 } from "uuid";
import PatientAdditionalAttribute from "@/models/patient-additional-attribute";
import { SelectInput } from "@/components/select-input";
import { getAllClinics } from "@/lib/server-functions/clinics";

export const createPatient = createServerFn({ method: "POST" })
  .validator<{
    baseFields: Patient.T;
    additionalAttributes: PatientAdditionalAttribute.T[];
  }>((data) => data)
  .handler(async ({ data }) => {
    return Patient.register(
      data as unknown as {
        baseFields: Patient.T;
        additionalAttributes: PatientAdditionalAttribute.T[];
      },
    );
  });

export const getAllPatientRegistrationForms = createServerFn({
  method: "GET",
}).handler(async () => {
  return PatientRegistrationForm.getAll();
});

export const Route = createFileRoute("/app/patients/register")({
  component: RouteComponent,
  loader: async () => {
    const patientRegistrationForm = await getAllPatientRegistrationForms();
    const clinicsList = await getAllClinics();
    return { patientRegistrationForm: patientRegistrationForm[0], clinicsList };
  },
});

function RouteComponent() {
  const { patientRegistrationForm, clinicsList } = Route.useLoaderData();

  const { formState, handleSubmit, register, watch, setValue } = useForm({
    mode: "all",
    // initialValues: {},

    // validate: {},
  });

  console.log({ clinicsList });

  const onSubmit = async (data: any) => {
    const patient: Patient.T = {
      id: uuidv1(),
      given_name: Option.fromNullable(data.given_name),
      surname: Option.fromNullable(data.surname),
      date_of_birth: Option.fromNullable(data.date_of_birth),
      citizenship: Option.fromNullable(data.citizenship),
      hometown: Option.fromNullable(data.hometown),
      phone: Option.fromNullable(data.phone),
      sex: Option.fromNullable(data.sex),
      camp: Option.fromNullable(data.camp),
      additional_data: data.additional_data || {},
      image_timestamp: Option.fromNullable(data.image_timestamp),
      is_deleted: false,
      created_at: new Date(),
      updated_at: new Date(),
      last_modified: new Date(),
      server_created_at: new Date(),
      deleted_at: Option.none(),
      metadata: {},
      photo_url: Option.fromNullable(data.photo_url),
      government_id: Option.fromNullable(data.government_id),
      external_patient_id: Option.fromNullable(data.external_patient_id),
    };

    const patientBaseData: Record<string, any> = {};
    const additionalAttributes: PatientAdditionalAttribute.T[] = [];

    patientRegistrationForm?.fields
      .filter((field) => field.deleted !== true && field.visible)
      .forEach((field) => {
        if (field.baseField) {
          // @ts-ignore
          patientBaseData[field.column] = data[field.column];
        } else {
          const row: PatientAdditionalAttribute.T = {
            id: uuidv1(),
            patient_id: "",
            attribute_id: field.id,
            attribute: field.column,
            number_value: Option.fromNullable(
              field.fieldType === "number" ? Number(data[field.column]) : null,
            ),
            string_value: Option.fromNullable(
              ["text", "select"].includes(field.fieldType)
                ? String(data[field.column])
                : null,
            ),
            date_value: Option.fromNullable(
              field.fieldType === "date" ? new Date(data[field.column]) : null,
            ),
            boolean_value: Option.fromNullable(
              field.fieldType === "boolean"
                ? Boolean(data[field.column])
                : null,
            ),
            metadata: {},
            is_deleted: false,
            created_at: new Date(),
            updated_at: new Date(),
            last_modified: new Date(),
            server_created_at: new Date(),
            deleted_at: Option.none(),
          };
          additionalAttributes.push(row);
        }
      });

    try {
      await createPatient({
        data: { baseFields: patient, additionalAttributes },
      });
      alert("Patient registered successfully!");
    } catch (error) {
      console.error("Failed to register patient:", error);
      alert("Failed to register patient. Please try again.");
    }
  };

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
      <form onSubmit={handleSubmit(onSubmit)}>
        <div style={{ maxWidth: 500 }} className="space-y-4">
          {patientRegistrationForm?.fields
            .filter((field) => field.visible && field.deleted !== true)
            .map((field, idx) => {
              if (
                field.fieldType === "text" &&
                field.column !== "primary_clinic_id"
              ) {
                return (
                  <div key={field.id} className="space-y-2">
                    <Label
                      htmlFor={field.column}
                      className="text-muted-foreground"
                    >
                      {Language.getTranslation(field.label, "en")}
                    </Label>
                    <Input
                      data-testid={"register-patient-" + idx}
                      data-inputtype={"text"}
                      data-column={field.column}
                      key={field.id}
                      {...register(field.column)}
                    />
                  </div>
                );
              }
              if (field.column === "primary_clinic_id") {
                return (
                  <div key={field.id} className="space-y-2">
                    <SelectInput
                      className="w-full"
                      data-testid={"register-patient-" + idx}
                      data-inputtype={"select"}
                      label={Language.getTranslation(field.label, "en")}
                      data={clinicsList.map((clinic) => ({
                        label: clinic.name,
                        value: clinic.id,
                      }))}
                      value={watch(field.column)}
                      onChange={(v) => setValue(field.column, v)}
                    />
                  </div>
                );
              }
              if (field.fieldType === "number") {
                return (
                  <div key={field.id} className="space-y-2">
                    <Label
                      htmlFor={field.column}
                      className="text-muted-foreground"
                    >
                      {Language.getTranslation(field.label, "en")}
                    </Label>
                    <Input
                      data-inputtype={"number"}
                      data-testid={"register-patient-" + idx}
                      key={field.id}
                      {...register(field.column)}
                    />
                  </div>
                );
              }
              if (field.fieldType === "select") {
                return (
                  <div key={field.id} className="space-y-2">
                    <Label
                      htmlFor={field.column}
                      className="text-muted-foreground"
                    >
                      {Language.getTranslation(field.label, "en")}
                    </Label>
                    <Select
                      key={field.id}
                      {...register(field.column)}
                      value={watch(field.column)}
                      data-inputtype="select"
                      data-testid={"register-patient-" + idx}
                      onValueChange={(value) => setValue(field.column, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={`Select ${Language.getTranslation(
                            field.label,
                            "en",
                          )}`}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>
                            {Language.getTranslation(field.label, "en")}
                          </SelectLabel>
                          {field.options.map((opt) => (
                            <SelectItem
                              key={Language.getTranslation(opt, "en")}
                              data-testid={Language.getTranslation(opt, "en")}
                              value={Language.getTranslation(opt, "en")}
                            >
                              {upperFirst(Language.getTranslation(opt, "en"))}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                );
              }
              if (field.fieldType === "date") {
                return (
                  <div key={field.id} className="space-y-2">
                    <Label
                      htmlFor={field.column}
                      className="text-muted-foreground"
                    >
                      {Language.getTranslation(field.label, "en")}
                    </Label>
                    <DatePickerInput
                      // valueFormat="YYYY MMM DD"
                      // description={''}
                      //   label={Language.getTranslation(field.label, "en")}
                      required={field.required}
                      placeholder="Pick date"
                      data-testid={"register-patient-" + idx}
                      data-inputtype="date"
                      {...register(field.column)}
                      value={watch(field.column)}
                      onChange={(date) => setValue(field.column, date)}
                    />
                  </div>
                );
              }
              return <div></div>;
            })}

          <Button
            type="submit"
            data-testid={"submit-button"}
            className="primary"
          >
            {formState.isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </form>
    </div>
  );
}
