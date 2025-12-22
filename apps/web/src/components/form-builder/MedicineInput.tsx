import { Input } from "@hh/ui/components/input";
import eq from "lodash/eq";
import upperFirst from "lodash/upperFirst";
import React from "react";
import { SelectInput } from "../select-input";
import EventForm from "@/models/event-form";

const concentationUnitOptions: EventForm.DoseUnit[] = [
  "mg",
  "g",
  "mcg",
  "mL",
  "L",
  "units",
];
const durationUnitOptions: EventForm.DurationUnit[] = [
  "days",
  "weeks",
  "months",
  "years",
];

const routeOptions: EventForm.MedicineRoute[] = [
  "oral",
  "sublingual",
  "rectal",
  "topical",
  "inhalation",
  "intravenous",
  "intramuscular",
  "intradermal",
  "subcutaneous",
  "nasal",
  "ophthalmic",
  "otic",
  "vaginal",
  "transdermal",
  "other",
];

const formOptions: EventForm.MedicineForm[] = [
  "tablet",
  "syrup",
  "ampule",
  "suppository",
  "cream",
  "drops",
  "bottle",
  "spray",
  "gel",
  "lotion",
  "inhaler",
  "capsule",
  "injection",
  "patch",
  "other",
];

type MedicineInputProps = {
  description: string;
  name: string;
};

export const MedicineInput = React.memo(
  ({ description, name }: MedicineInputProps) => {
    return (
      <div className="w-full">
        <h4 className="text-lg font-bold">{name || "Medicine"}</h4>
        <h6 className={`text-sm text-gray-500`}>
          {description || "Enter the medicine details"}
        </h6>
        <div className="space-y-1 w-full">
          <div className={`grid grid-cols-2 space-between space-x-4 w-full`}>
            <Input className={`flex`} label="Medicine Name" />
            <SelectInput
              data={EventForm.medicineForms.map((opt) => ({
                label: upperFirst(opt),
                value: opt,
              }))}
              label="Medicine Form"
              className="w-full"
            />
          </div>

          <div className={`grid grid-cols-2 space-between space-x-4 w-full`}>
            <Input type="number" className={`flex-1`} label="Concentration" />
            <SelectInput
              className={`w-full`}
              data={EventForm.doseUnits.map((opt) => ({
                label: opt,
                value: opt,
              }))}
              label="Unit"
            />
          </div>

          <div className={`grid grid-cols-2 space-between space-x-4 w-full`}>
            <Input
              className={`w-full`}
              label="Frequency & Duration"
              placeholder="1 x 3 x 4 days"
            />
            <SelectInput
              className={`w-full`}
              data={EventForm.medicineRoutes.map((opt) => ({
                label: upperFirst(opt),
                value: opt,
              }))}
              label="Route"
            />
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => eq(prevProps.name, nextProps.name),
);
