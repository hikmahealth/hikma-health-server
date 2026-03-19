import * as React from "react";
import { searchDrugs, getAllDrugs } from "@/lib/server-functions/drugs";
import AsyncSelect from "react-select/async";
import type DrugCatalogue from "@/models/drug-catalogue";
import { Label } from "@radix-ui/react-label";

type MultiSelectProps = {
  isMulti: true;
  value: DrugCatalogue.ApiDrug["id"][];
  onChange: (value: DrugCatalogue.ApiDrug[]) => void;
};

type SingleSelectProps = {
  isMulti?: false;
  value: DrugCatalogue.ApiDrug["id"] | null;
  onChange: (value: DrugCatalogue.ApiDrug | null) => void;
};

type Props = {
  label: string;
  description?: string;
  withAsterisk?: boolean;
  clearable?: boolean;
  value?: DrugCatalogue.ApiDrug["id"] | null;
  defaultValue?: DrugCatalogue.ApiDrug["id"] | DrugCatalogue.ApiDrug["id"][] | null;
  defaultDrugs?: DrugCatalogue.ApiDrug[];
  placeholder?: string;
  disabled?: boolean;
} & (MultiSelectProps | SingleSelectProps);

export function DrugSearchSelect({
  onChange,
  isMulti,
  label,
  description,
  withAsterisk,
  clearable,
  value,
  defaultValue,
  defaultDrugs,
  placeholder = "Search for a drug",
  disabled = false,
}: Props) {
  const formatDrugOption = (drug: DrugCatalogue.ApiDrug) => {
    const displayName = drug.brand_name
      ? `${drug.generic_name} (${drug.brand_name})`
      : drug.generic_name;

    const strength = drug.dosage_quantity && drug.dosage_units
      ? ` - ${drug.dosage_quantity}${drug.dosage_units}`
      : '';

    const form = drug.form ? ` - ${drug.form}` : '';

    return {
      value: drug.id,
      label: `${displayName}${strength}${form}`,
      drug,
    };
  };

  const loadOptions = async (
    inputValue: string,
    callback: (options: { value: string; label: string; drug: DrugCatalogue.ApiDrug }[]) => void,
  ) => {
    if (!inputValue || inputValue.length < 2) {
      // If no search term or too short, load first 20 active drugs
      const drugs = await getAllDrugs({
        data: { limit: 20, isActive: true },
      });
      callback(drugs?.map((drug) => formatDrugOption(drug)) || []);
    } else {
      // Search for drugs
      const drugs = await searchDrugs({
        data: { searchTerm: inputValue, limit: 20 },
      });
      callback(drugs?.map((drug) => formatDrugOption(drug)) || []);
    }
  };

  // Load default options when component mounts
  const loadDefaultOptions = async () => {
    if (defaultDrugs && defaultDrugs.length > 0) {
      return defaultDrugs.map((drug) => formatDrugOption(drug));
    }

    const drugs = await getAllDrugs({
      data: { limit: 20, isActive: true },
    });
    return drugs?.map((drug) => formatDrugOption(drug)) || [];
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
        placeholder={placeholder}
        isDisabled={disabled}
        defaultValue={
          defaultDrugs && defaultDrugs.length > 0 && defaultValue
            ? (isMulti
                ? defaultDrugs
                    .filter((drug) => (defaultValue as string[]).includes(drug.id))
                    .map((drug) => formatDrugOption(drug))
                : formatDrugOption(
                    defaultDrugs.find((drug) => drug.id === defaultValue) as DrugCatalogue.ApiDrug
                  ))
            : undefined
        }
        loadOptions={loadOptions}
        defaultOptions={true}
        onChange={(data) => {
          if (isMulti && Array.isArray(data)) {
            return onChange(data?.map((d) => d.drug) as DrugCatalogue.ApiDrug[]);
          }
          return onChange(data?.drug as DrugCatalogue.ApiDrug | null);
        }}
        isMulti={isMulti}
        styles={{
          control: (base) => ({
            ...base,
            minHeight: '36px',
          }),
          menu: (base) => ({
            ...base,
            zIndex: 9999,
          }),
        }}
        className="text-sm"
        classNamePrefix="react-select"
      />
    </>
  );
}
