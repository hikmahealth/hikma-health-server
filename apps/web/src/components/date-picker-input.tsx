import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@hh/ui/components/button";
import { Calendar } from "@hh/ui/components/calendar";
import { Label } from "@hh/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@hh/ui/components/popover";

interface DatePickerProps {
  id?: string;
  label?: string;
  placeholder?: string;
  description?: string;
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  className?: string;
  buttonClassName?: string;
  calendarProps?: React.ComponentProps<typeof Calendar>;
  popoverContentProps?: React.ComponentProps<typeof PopoverContent>;
  withAsterisk?: boolean;
}

export function DatePickerInput({
  id = "date",
  label,
  placeholder = "Select date",
  description,
  value,
  onChange,
  className,
  withAsterisk = false,
  buttonClassName,
  calendarProps,
  popoverContentProps,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(value);

  React.useEffect(() => {
    setDate(value);
  }, [value]);

  const handleSelect = (newDate: Date | undefined) => {
    setDate(newDate);
    onChange?.(newDate);
    setOpen(false);
  };

  return (
    <div className={`w-full flex flex-col gap-3 ${className || ""}`}>
      {label && (
        <Label htmlFor={id} className="px-1">
          {label}
          {withAsterisk && <span className="text-destructive">*</span>}
        </Label>
      )}
      {description && (
        <p className="text-muted-foreground px-1">{description}</p>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id={id}
            className={`w-full justify-between font-normal ${
              buttonClassName || ""
            }`}
          >
            {date ? date.toLocaleDateString() : placeholder}
            <ChevronDownIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto overflow-hidden p-0"
          align="start"
          {...popoverContentProps}
        >
          <Calendar
            mode="single"
            selected={date}
            captionLayout="dropdown"
            onSelect={handleSelect}
            {...calendarProps}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
