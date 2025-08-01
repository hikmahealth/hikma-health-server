import { useState } from "react";
import icd11 from "@/data/icd11-xs.js"; // Importing the extra small ICD10 JSON file
import EventForm from "@/models/event-form";
import { MultiSelect } from "@/components/multi-select";
import { FormLabel, FormDescription } from "../ui/form";
import Select from "react-select";
import { Label } from "../ui/label";
import { cn } from "@/lib/utils";
import AsyncSelect from "react-select/async";
import { stringSimilarity } from "@/lib/utils";
import MiniSearch from "minisearch";

type Props = {
  name: string;
  description: string;
  withAsterisk: boolean;
  required?: boolean;
  multi?: boolean;
};

let miniSearch = new MiniSearch({
  fields: ["desc", "code"], // fields to index for full-text search
  storeFields: ["desc", "code"], // fields to return with search results
  idField: "code",
  searchOptions: {
    // prefix: true,
    fuzzy: 1,
    boost: {
      desc: 5,
      code: 1,
    },
  },
});

miniSearch.addAll(icd11);

export function DiagnosisSelect({
  name,
  description,
  withAsterisk,
  required,
  multi,
}: Props) {
  // const [data, setData] = useState(
  //   icd11.map((item) => ({
  //     value: `${item.desc} (${item.code})`,
  //     label: `${item.desc} (${item.code})`,
  //   }))
  // );

  const loadOptions = (
    inputValue: string,
    callback: (options: { value: string; label: string }[]) => void
  ) => {
    callback(
      miniSearch
        .search(inputValue)
        .sort((a, b) => b.score - a.score)
        .slice(0, 25)
        .map((item) => ({
          value: `${item.desc} (${item.code})`,
          label: `${item.desc} (${item.code})`,
        }))
    );
  };

  // FIXME: Need to replace the diagnosis picker with new select item from `react-select` with better creatable support
  return (
    <>
      <Label>
        {name}
        {withAsterisk && <span className="text-destructive">*</span>}
      </Label>
      {description && (
        <p id={`${name}-description`} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}

      <div className="mt-2">
        <AsyncSelect
          cacheOptions
          isMulti={multi}
          loadOptions={loadOptions}
          defaultOptions
          placeholder="Search for a diagnosis..."
        />
      </div>
    </>
  );
}
