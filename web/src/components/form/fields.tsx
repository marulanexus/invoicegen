"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

function FieldShell({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface TextFieldProps
  extends Omit<React.ComponentProps<"input">, "onChange"> {
  label?: string;
  error?: string;
  hint?: string;
  onValueChange?: (value: string) => void;
}

export function TextField({
  label,
  error,
  hint,
  required,
  className,
  id,
  onValueChange,
  ...props
}: TextFieldProps & { required?: boolean }) {
  const fieldId = id ?? props.name;
  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <Input
        id={fieldId}
        aria-invalid={!!error}
        onChange={(e) => onValueChange?.(e.target.value)}
        {...props}
      />
    </FieldShell>
  );
}

interface TextAreaFieldProps
  extends Omit<React.ComponentProps<"textarea">, "onChange"> {
  label?: string;
  error?: string;
  hint?: string;
  onValueChange?: (value: string) => void;
}

export function TextAreaField({
  label,
  error,
  hint,
  className,
  id,
  onValueChange,
  ...props
}: TextAreaFieldProps) {
  const fieldId = id ?? props.name;
  return (
    <FieldShell label={label} htmlFor={fieldId} error={error} hint={hint} className={className}>
      <Textarea
        id={fieldId}
        aria-invalid={!!error}
        onChange={(e) => onValueChange?.(e.target.value)}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  value,
  onValueChange,
  options,
  placeholder,
  error,
  hint,
  required,
  className,
}: {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger aria-invalid={!!error}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="space-y-0.5 pr-4">
        <Label>{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
