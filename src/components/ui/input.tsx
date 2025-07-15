import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export interface InputProps extends React.ComponentProps<"input"> {
  // Size variants
  size?: "sm" | "md" | "lg";
  // Visual variants
  variant?: "default" | "filled" | "unstyled";
  // State props
  error?: string | boolean;
  // Icon props
  leftSection?: React.ReactNode;
  rightSection?: React.ReactNode;
  leftSectionPointerEvents?: "none" | "auto";
  rightSectionPointerEvents?: "none" | "auto";
  // Layout props
  radius?: "none" | "sm" | "md" | "lg" | "full";
  // Wrapper props
  withAsterisk?: boolean;
  required?: boolean;
  label?: string;
  description?: string;
  // Input wrapper class
  wrapperProps?: React.HTMLAttributes<HTMLDivElement>;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      size = "md",
      variant = "default",
      error,
      leftSection,
      rightSection,
      leftSectionPointerEvents = "none",
      rightSectionPointerEvents = "none",
      radius = "md",
      withAsterisk,
      label,
      description,
      wrapperProps,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "h-8 px-2 text-sm",
      md: "h-9 px-3 text-base md:text-sm",
      lg: "h-10 px-4 text-base",
    };

    const variantClasses = {
      default: "bg-transparent border border-input",
      filled: "bg-muted border border-transparent",
      unstyled: "bg-transparent border-none shadow-none",
    };

    const radiusClasses = {
      none: "rounded-none",
      sm: "rounded-sm",
      md: "rounded-md",
      lg: "rounded-lg",
      full: "rounded-full",
    };

    const hasError = error && error !== false;
    const inputId =
      props.id || `input-${Math.random().toString(36).substr(2, 9)}`;

    const inputElement = (
      <div className="relative flex items-center">
        {leftSection && (
          <div
            className={cn(
              "absolute left-0 z-10 flex items-center justify-center text-muted-foreground",
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

        <input
          ref={ref}
          type={type}
          id={inputId}
          data-slot="input"
          className={cn(
            "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 w-full min-w-0 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            // Base size and variant classes
            sizeClasses[size],
            variantClasses[variant],
            radiusClasses[radius],
            // Error state
            hasError
              ? "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border-destructive"
              : "",
            // Padding adjustments for icons
            leftSection &&
              (size === "sm" ? "pl-8" : size === "lg" ? "pl-10" : "pl-9"),
            rightSection &&
              (size === "sm" ? "pr-8" : size === "lg" ? "pr-10" : "pr-9"),
            className
          )}
          aria-invalid={hasError}
          aria-describedby={
            [
              description && `${inputId}-description`,
              hasError && typeof error === "string" && `${inputId}-error`,
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          {...props}
        />

        {rightSection && (
          <div
            className={cn(
              "absolute right-0 z-10 flex items-center justify-center text-muted-foreground",
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
      </div>
    );

    // If no label, description, or error, return just the input
    if (!label && !description && !hasError) {
      return inputElement;
    }

    // Return wrapped input with label and description
    return (
      <div
        {...wrapperProps}
        className={cn("space-y-1", wrapperProps?.className)}
      >
        {label && (
          <Label htmlFor={inputId}>
            {label}
            {(withAsterisk || props.required) && (
              <span className="text-destructive">*</span>
            )}
          </Label>
        )}

        {description && (
          <p
            id={`${inputId}-description`}
            className="text-sm text-muted-foreground"
          >
            {description}
          </p>
        )}

        {inputElement}

        {hasError && typeof error === "string" && (
          <p id={`${inputId}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
