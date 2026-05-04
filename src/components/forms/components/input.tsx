import EventForm from "@/models/event-form";
import { MultiSelect } from "@/components/multi-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import eq from "lodash/eq";
import React from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export const OptionsInput = React.memo(
  ({ field }: { field: EventForm.HHFieldWithPosition | EventForm.HHField }) => {
    // @ts-expect-error - multi exists on OptionsField but not on all HHField variants
    const isMulti = Boolean(field.multi);
    const options: EventForm.FieldOption[] = field.options || [];

    switch (field.inputType) {
      case "radio":
        if (isMulti) {
          return (
            <div>
              <Label>{field.name}</Label>
              {field.description && (
                <p className="text-sm text-muted-foreground">
                  {field.description}
                </p>
              )}
              <div className="mt-2 space-y-2">
                {options.map((option) => (
                  <Checkbox
                    key={option.value}
                    id={`${field.name}-${option.value}`}
                    label={option.label}
                  />
                ))}
              </div>
            </div>
          );
        }
        return (
          <RadioGroup name={field.name}>
            <Label>{field.name}</Label>
            {field.description && (
              <p className="text-sm text-muted-foreground">
                {field.description}
              </p>
            )}
            <div className="mt-2">
              {options.map((option) => (
                <div className="flex items-center space-x-2" key={option.value}>
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value}>{option.label}</Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        );
      case "select":
      default:
        if (isMulti) {
          return (
            <MultiSelect
              options={options}
              onValueChange={() => {}}
              placeholder={field.name}
              defaultValue={[]}
            />
          );
        }
        return (
          <Select name={field.name}>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        );
    }
  },
  (pres, next) => eq(pres.field, next.field),
);
