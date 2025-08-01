import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, X } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

export interface SelectInputProps {
  // Data
  data: (string | SelectOption | SelectGroup)[];
  // Value control
  value?: string;
  defaultValue?: string;
  onChange?: (value: string | null, option?: SelectOption) => void;
  // Behavior
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  allowDeselect?: boolean;
  // Form integration
  label?: string;
  description?: string;
  error?: string | boolean;
  withAsterisk?: boolean;
  // Visual
  size?: "sm" | "md" | "lg";
  radius?: "none" | "sm" | "md" | "lg" | "full";
  // Sections
  leftSection?: React.ReactNode;
  rightSection?: React.ReactNode;
  leftSectionPointerEvents?: "none" | "auto";
  rightSectionPointerEvents?: "none" | "auto";
  // Layout
  className?: string;
  wrapperProps?: React.HTMLAttributes<HTMLDivElement>;
  // Accessibility
  name?: string;
  id?: string;
  "aria-label"?: string;
}

const SelectInput = React.forwardRef<
  React.ElementRef<typeof SelectTrigger>,
  SelectInputProps
>(
  (
    {
      data,
      value,
      defaultValue,
      onChange,
      placeholder = "Select an option",
      disabled = false,
      clearable = false,
      allowDeselect = true,
      label,
      description,
      error,
      withAsterisk = false,
      size = "md",
      radius = "md",
      leftSection,
      rightSection,
      leftSectionPointerEvents = "none",
      rightSectionPointerEvents = "none",
      className,
      wrapperProps,
      name,
      id,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const controlledValue = value !== undefined ? value : internalValue;

    const sizeClasses = {
      sm: "h-8 px-2 text-sm",
      md: "h-9 px-3 text-base md:text-sm",
      lg: "h-10 px-4 text-base",
    };

    const radiusClasses = {
      none: "rounded-none",
      sm: "rounded-sm",
      md: "rounded-md",
      lg: "rounded-lg",
      full: "rounded-full",
    };

    const hasError = error && error !== false;
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

    // Normalize data to consistent format
    const normalizedData = React.useMemo(() => {
      return data.map((item) => {
        if (typeof item === "string") {
          return { value: item, label: item };
        }
        if ("options" in item) {
          return {
            ...item,
            options: item.options.map((option) =>
              typeof option === "string"
                ? { value: option, label: option }
                : option
            ),
          };
        }
        return item;
      });
    }, [data]);

    // Find selected option for onChange callback
    const findSelectedOption = (
      selectedValue: string
    ): SelectOption | undefined => {
      for (const item of normalizedData) {
        if ("options" in item) {
          const found = item.options.find((opt) => opt.value === selectedValue);
          if (found) return found;
        } else if ("value" in item && item.value === selectedValue) {
          return item;
        }
      }
      return undefined;
    };

    const handleValueChange = (newValue: string) => {
      const selectedOption = findSelectedOption(newValue);

      // Handle deselection
      if (allowDeselect && controlledValue === newValue) {
        const finalValue = null;
        if (value === undefined) setInternalValue(undefined);
        onChange?.(finalValue, undefined);
        return;
      }

      if (value === undefined) setInternalValue(newValue);
      onChange?.(newValue, selectedOption);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      const finalValue = null;
      if (value === undefined) setInternalValue("");
      onChange?.(finalValue, undefined);
    };

    const showClearButton = clearable && controlledValue && !disabled;

    const selectElement = (
      <Select
        value={controlledValue || ""}
        onValueChange={handleValueChange}
        disabled={disabled}
        name={name}
        {...props}
      >
        <SelectTrigger
          ref={ref}
          id={selectId}
          className={cn(
            "relative",
            sizeClasses[size],
            radiusClasses[radius],
            hasError && "border-destructive",
            leftSection &&
              (size === "sm" ? "pl-8" : size === "lg" ? "pl-10" : "pl-9"),
            (rightSection || showClearButton) &&
              (size === "sm" ? "pr-12" : size === "lg" ? "pr-14" : "pr-13"),
            className
          )}
          aria-label={ariaLabel}
          aria-invalid={hasError === true}
          aria-describedby={
            [
              description && `${selectId}-description`,
              hasError && typeof error === "string" && `${selectId}-error`,
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
        >
          {leftSection && (
            <div
              className={cn(
                "absolute left-0 z-20 flex items-center justify-center text-muted-foreground",
                size === "sm"
                  ? "w-8 h-8"
                  : size === "lg"
                  ? "w-10 h-10"
                  : "w-9 h-9"
              )}
              style={{ pointerEvents: leftSectionPointerEvents }}
            >
              {leftSection}
            </div>
          )}

          <SelectValue placeholder={placeholder} />

          {showClearButton && (
            <button
              type="button"
              onClick={handleClear}
              className={cn(
                "absolute right-2 z-20 flex items-center justify-center text-muted-foreground hover:text-foreground",
                size === "sm" ? "w-4 h-4" : "w-5 h-5"
              )}
              style={{ pointerEvents: rightSectionPointerEvents }}
            >
              <X className="w-3 h-3" />
            </button>
          )}

          {rightSection && !showClearButton && (
            <div
              className={cn(
                "absolute right-2 z-90 flex items-center justify-center text-muted-foreground",
                size === "sm"
                  ? "w-8 h-8"
                  : size === "lg"
                  ? "w-10 h-10"
                  : "w-9 h-9"
              )}
              style={{ pointerEvents: rightSectionPointerEvents }}
            >
              {rightSection}
            </div>
          )}
        </SelectTrigger>

        <SelectContent>
          {normalizedData.map((item, index) => {
            if ("options" in item) {
              // Render group
              return (
                <SelectGroup key={index}>
                  <SelectLabel>{item.label}</SelectLabel>
                  {item.options.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              );
            } else {
              // Render individual option
              return (
                <SelectItem
                  key={item.value}
                  value={item.value}
                  disabled={item.disabled}
                >
                  {item.label}
                </SelectItem>
              );
            }
          })}
        </SelectContent>
      </Select>
    );

    // If no label, description, or error, return just the select
    if (!label && !description && !hasError) {
      return selectElement;
    }

    // Return wrapped select with label and description
    return (
      <div
        {...wrapperProps}
        className={cn("space-y-1", wrapperProps?.className)}
      >
        {label && (
          <Label htmlFor={selectId}>
            {label}
            {withAsterisk && <span className="text-destructive">*</span>}
          </Label>
        )}

        {description && (
          <p
            id={`${selectId}-description`}
            className="text-sm text-muted-foreground"
          >
            {description}
          </p>
        )}

        {selectElement}

        {hasError && typeof error === "string" && (
          <p id={`${selectId}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }
);

SelectInput.displayName = "SelectInput";

export { SelectInput };
