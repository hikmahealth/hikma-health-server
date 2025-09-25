import * as React from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  // Size variants
  // size?: "sm" | "md" | "lg";
  // Visual variants
  // variant?: "default" | "filled" | "unstyled";
  // State props
  error?: string | boolean;
  // Icon props
  // leftSection?: React.ReactNode;
  // rightSection?: React.ReactNode;
  // leftSectionPointerEvents?: "none" | "auto";
  // rightSectionPointerEvents?: "none" | "auto";
  // Layout props
  // radius?: "none" | "sm" | "md" | "lg" | "full";
  // Wrapper props
  withAsterisk?: boolean;
  required?: boolean;
  label?: string;
  description?: string;
  // Input wrapper class
  wrapperProps?: React.HTMLAttributes<HTMLDivElement>;
}

function Textarea(props: TextareaProps) {
  const { className, label, withAsterisk, wrapperProps, ...rest } = props;

  const inputId = rest.id || `input-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <div className={cn("space-y-1", wrapperProps?.className)}>
      {label && (
        <Label htmlFor={inputId}>
          {label}
          {(withAsterisk || props.required) && (
            <span className="text-destructive">*</span>
          )}
        </Label>
      )}
      <textarea
        data-slot="textarea"
        id={inputId}
        className={cn(
          "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        {...rest}
      />
    </div>
  );
}

export { Textarea };
