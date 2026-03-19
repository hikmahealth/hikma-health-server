import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export interface CheckboxProps
  extends React.ComponentProps<typeof CheckboxPrimitive.Root> {
  // Size variants
  size?: "sm" | "md" | "lg";
  // Visual variants
  variant?: "default" | "filled" | "outline";
  // State props
  error?: string | boolean;
  // Color variants
  color?: "default" | "primary" | "secondary" | "destructive";
  // Layout props
  radius?: "none" | "sm" | "md" | "lg" | "full";
  // Label props
  label?: string;
  description?: string;
  // Wrapper props
  wrapperProps?: React.HTMLAttributes<HTMLDivElement>;
  // Icon customization
  icon?: React.ReactNode;
  // Indeterminate state
  indeterminate?: boolean;
  // Required state
  required?: boolean;
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(
  (
    {
      className,
      size = "md",
      variant = "default",
      error,
      color = "default",
      radius = "sm",
      label,
      description,
      wrapperProps,
      icon,
      indeterminate,
      required,
      ...props
    },
    ref,
  ) => {
    const sizeClasses = {
      sm: "size-3.5",
      md: "size-4",
      lg: "size-5",
    };

    const iconSizeClasses = {
      sm: "size-2.5",
      md: "size-3.5",
      lg: "size-4",
    };

    const variantClasses = {
      default: "border border-input dark:bg-input/30",
      filled: "bg-muted border border-muted",
      outline: "bg-transparent border-2",
    };

    const colorClasses = {
      default:
        "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground",
      primary:
        "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground",
      secondary:
        "data-[state=checked]:bg-secondary data-[state=checked]:border-secondary data-[state=checked]:text-secondary-foreground",
      destructive:
        "data-[state=checked]:bg-destructive data-[state=checked]:border-destructive data-[state=checked]:text-primary-foreground",
    };

    const radiusClasses = {
      none: "rounded-none",
      sm: "rounded-[4px]",
      md: "rounded-md",
      lg: "rounded-lg",
      full: "rounded-full",
    };

    const hasError = error && error !== false;
    const checkboxId =
      props.id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    const checkboxElement = (
      <CheckboxPrimitive.Root
        ref={ref}
        id={checkboxId}
        data-slot="checkbox"
        className={cn(
          "peer shrink-0 shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:border-ring focus-visible:ring-ring/50",
          // Base size, variant, and color classes
          sizeClasses[size],
          variantClasses[variant],
          colorClasses[color],
          radiusClasses[radius],
          // Error state
          hasError
            ? "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border-destructive"
            : "",
          // Indeterminate state
          indeterminate
            ? "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-primary-foreground"
            : "",
          className,
        )}
        aria-invalid={hasError ? true : false}
        aria-describedby={
          [
            description && `${checkboxId}-description`,
            hasError && typeof error === "string" && `${checkboxId}-error`,
          ]
            .filter(Boolean)
            .join(" ") || undefined
        }
        {...props}
      >
        <CheckboxPrimitive.Indicator
          data-slot="checkbox-indicator"
          className="flex items-center justify-center text-current transition-none"
        >
          {icon || (
            <CheckIcon className={`${iconSizeClasses[size]} text-current`} />
          )}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );

    // If no label, description, or error, return just the checkbox
    if (!label && !description && !hasError) {
      return checkboxElement;
    }

    // Return wrapped checkbox with label and description
    return (
      <div
        {...wrapperProps}
        className={cn("space-y-1", wrapperProps?.className)}
      >
        <div className="flex items-start space-x-2">
          {checkboxElement}
          <div className="space-y-1 leading-none">
            {label && (
              <Label
                htmlFor={checkboxId}
                className={cn("cursor-pointer", hasError && "text-destructive")}
              >
                {label}
                {required && <span className="text-destructive">*</span>}
              </Label>
            )}
            {description && (
              <p
                id={`${checkboxId}-description`}
                className="text-sm text-muted-foreground"
              >
                {description}
              </p>
            )}
          </div>
        </div>

        {hasError && typeof error === "string" && (
          <p id={`${checkboxId}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
