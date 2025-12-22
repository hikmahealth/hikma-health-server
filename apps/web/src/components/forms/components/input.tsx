import EventForm from "@/models/event-form";
import { MultiSelect } from "@/components/multi-select";
import { RadioGroup, RadioGroupItem } from "@hh/ui/components/radio-group";
import eq from "lodash/eq";
import React from "react";
import { Label } from "@hh/ui/components/label";
import { Select } from "@hh/ui/components/select";

export const OptionsInput = React.memo(
  ({ field }: { field: EventForm.HHFieldWithPosition | EventForm.HHField }) => {
    const inputProps = {
      // @ts-expect-error
      placeholder: field.placeholder,
      label: field.name,
      description: field.description,
      required: field.required,
      // @ts-expect-error
      multi: field.multi,
      // value: field.value,
    };

    switch (field.inputType) {
      case "radio":
        return (
          // @ts-expect-erro
          <RadioGroup name={field.name} {...inputProps}>
            <div className="mt-2">
              {field.options.map((option) => (
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
        // @ts-expect-error
        if (field.multi) {
          return (
            <MultiSelect
              // @ts-expect-error
              data={field.options}
              // @ts-expect-error
              multiple={field.multi}
              {...inputProps}
              // @ts-expect-error
              // field={field}
            />
          );
        } else {
          return (
            // @ts-expect-erro
            <Select
              options={field.options || []}
              {...inputProps}
              // field={field}
            />
          );
        }
    }
  },
  (pres, next) => eq(pres.field, next.field),
);
