import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioInputProps {
  // Data
  data: (string | RadioOption)[];
  // Value control
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, option?: RadioOption) => void;
  // Layout
  orientation?: "horizontal" | "vertical";
  // Form integration
  label?: string;
  description?: string;
  error?: string | boolean;
  withAsterisk?: boolean;
  // Visual
  size?: "sm" | "md" | "lg";
  // States
  disabled?: boolean;
  // Layout
  className?: string;
  wrapperProps?: React.HTMLAttributes<HTMLDivElement>;
  // Accessibility
  name?: string;
  id?: string;
  "aria-label"?: string;
  // Spacing
  spacing?: "xs" | "sm" | "md" | "lg" | "xl";
}

const RadioInput = React.forwardRef<
  React.ElementRef<typeof RadioGroup>,
  RadioInputProps
>(
  (
    {
      data,
      value,
      defaultValue,
      onChange,
      orientation = "vertical",
      label,
      description,
      error,
      withAsterisk = false,
      size = "md",
      disabled = false,
      className,
      wrapperProps,
      name,
      id,
      "aria-label": ariaLabel,
      spacing = "md",
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "w-3 h-3",
      md: "w-4 h-4",
      lg: "w-5 h-5",
    };

    const spacingClasses = {
      xs: "gap-1",
      sm: "gap-2",
      md: "gap-3",
      lg: "gap-4",
      xl: "gap-6",
    };

    const hasError = error && error !== false;
    const radioGroupId =
      id || `radio-group-${Math.random().toString(36).substr(2, 9)}`;

    // Normalize data to consistent format
    const normalizedData = React.useMemo(() => {
      return data.map((item) =>
        typeof item === "string" ? { value: item, label: item } : item
      );
    }, [data]);

    // Find selected option for onChange callback
    const findSelectedOption = (
      selectedValue: string
    ): RadioOption | undefined => {
      return normalizedData.find((option) => option.value === selectedValue);
    };

    const handleValueChange = (newValue: string) => {
      const selectedOption = findSelectedOption(newValue);
      onChange?.(newValue, selectedOption);
    };

    const radioGroupElement = (
      <RadioGroup
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        disabled={disabled}
        name={name}
        aria-label={ariaLabel}
        aria-invalid={hasError === true}
        aria-describedby={
          [
            description && `${radioGroupId}-description`,
            hasError && typeof error === "string" && `${radioGroupId}-error`,
          ]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={cn(
          "space-y-2",
          orientation === "horizontal" &&
            cn("flex flex-wrap", spacingClasses[spacing]),
          orientation === "vertical" &&
            spacingClasses[spacing].replace("gap-", "space-y-"),
          className
        )}
        {...props}
      >
        {normalizedData.map((option) => {
          const itemId = `${radioGroupId}-${option.value}`;
          const isDisabled = disabled || option.disabled;

          return (
            <div
              key={option.value}
              className={cn(
                "flex items-start space-x-2",
                orientation === "horizontal" && "flex-shrink-0"
              )}
            >
              <RadioGroupItem
                value={option.value}
                id={itemId}
                disabled={isDisabled}
                className={cn(
                  "mt-0.5", // Align with first line of label
                  sizeClasses[size],
                  hasError && "border-destructive"
                )}
              />
              <div className="space-y-1 leading-none">
                <Label
                  htmlFor={itemId}
                  className={cn(
                    "cursor-pointer",
                    isDisabled && "cursor-not-allowed opacity-50",
                    hasError && "text-destructive"
                  )}
                >
                  {option.label}
                </Label>
                {option.description && (
                  <p
                    className={cn(
                      "text-sm text-muted-foreground",
                      isDisabled && "opacity-50"
                    )}
                  >
                    {option.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </RadioGroup>
    );

    // If no label, description, or error, return just the radio group
    if (!label && !description && !hasError) {
      return radioGroupElement;
    }

    // Return wrapped radio group with label and description
    return (
      <div
        {...wrapperProps}
        className={cn("space-y-2", wrapperProps?.className)}
      >
        {label && (
          <Label className={cn(hasError && "text-destructive")}>
            {label}
            {withAsterisk && <span className="text-destructive">*</span>}
          </Label>
        )}

        {description && (
          <p
            id={`${radioGroupId}-description`}
            className="text-sm text-muted-foreground"
          >
            {description}
          </p>
        )}

        {radioGroupElement}

        {hasError && typeof error === "string" && (
          <p id={`${radioGroupId}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }
);

RadioInput.displayName = "RadioInput";

export { RadioInput };
