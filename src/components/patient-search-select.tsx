import * as React from "react";
import { searchPatients } from "@/lib/server-functions/patients";
import AsyncSelect from "react-select/async";
import type Patient from "@/models/patient";
import { Label } from "@radix-ui/react-label";

type MultiSelectProps = {
  isMulti: true;
  value: Patient.EncodedT["id"][];
  onChange: (value: Patient.EncodedT[]) => void;
};

type SingleSelectProps = {
  isMulti?: false;
  value: Patient.EncodedT["id"] | null;
  onChange: (value: Patient.EncodedT | null) => void;
};

type Props = {
  label: string;
  description?: string;
  withAsterisk?: boolean;
  clearable?: boolean;
  value?: Patient.EncodedT["id"] | null;
  defaultValue?: Patient.EncodedT["id"] | Patient.EncodedT["id"][] | null;
  defaultPatients?: Patient.EncodedT[];
} & (MultiSelectProps | SingleSelectProps);

export function PatientSearchSelect({
  onChange,
  isMulti,
  label,
  description,
  withAsterisk,
  clearable,
  value,
  defaultValue,
  defaultPatients,
}: Props) {
  const formatPatientOption = (patient: Patient.EncodedT) => ({
    value: patient.id,
    label: `${patient.given_name} ${patient.surname}`,
    patient,
  });

  const loadOptions = async (
    inputValue: string,
    callback: (options: { value: string; label: string }[]) => void,
  ) => {
    callback(
      (
        await searchPatients({
          data: { searchQuery: inputValue, limit: 10 },
        })
      )?.patients.map((patient) => formatPatientOption(patient)) || [],
    );
  };

  // console.log(defaultPatients, defaultValue);

  return (
    <>
      <Label>
        {label}
        {withAsterisk && <span className="text-destructive">*</span>}
      </Label>
      {description && (
        <p
          id={`${label}-description`}
          className="text-sm text-muted-foreground"
        >
          {description}
        </p>
      )}

      <AsyncSelect
        cacheOptions
        clearable={clearable}
        isClearable={clearable}
        placeholder="Search for a patient"
        defaultValue={
          (defaultPatients || []).length > 0 &&
          (isMulti
            ? []
            : {
                value: defaultValue,
                label: defaultPatients
                  .filter((patient) => patient.id === defaultValue)
                  .map((patient) => formatPatientOption(patient))[0].label,
              })
        }
        loadOptions={loadOptions}
        onChange={(data) => {
          if (isMulti && Array.isArray(data)) {
            return onChange(data?.map((d) => d.patient) as Patient.EncodedT[]);
          }
          return onChange(data?.patient as Patient.EncodedT | null);
        }}
        isMulti={isMulti}
        label={label}
        defaultOptions={
          defaultPatients?.map((patient) => formatPatientOption(patient)) || []
        }
        description={description}
        // formatOptionLabel={(option) => option.label}
      />
    </>
  );
}
