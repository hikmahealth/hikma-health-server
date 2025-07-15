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
} & (MultiSelectProps | SingleSelectProps);

export function PatientSearchSelect({
  onChange,
  isMulti,
  label,
  description,
  withAsterisk,
  clearable,
  value,
}: Props) {
  const loadOptions = async (
    inputValue: string,
    callback: (options: { value: string; label: string }[]) => void
  ) => {
    callback(
      (
        await searchPatients({
          data: { searchQuery: inputValue, limit: 10 },
        })
      )?.patients.map((patient) => ({
        value: patient.id,
        label: `${patient.given_name} ${patient.surname}`,
        patient,
      })) || []
    );
  };

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
        defaultValue={value}
        loadOptions={loadOptions}
        onChange={(data) => {
          if (isMulti && Array.isArray(data)) {
            return onChange(data?.map((d) => d.patient) as Patient.EncodedT[]);
          }
          return onChange(data?.patient as Patient.EncodedT | null);
        }}
        isMulti={isMulti}
        label={label}
        description={description}
        // formatOptionLabel={(option) => option.label}
      />
    </>
  );
}
