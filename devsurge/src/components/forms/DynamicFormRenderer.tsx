import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FormFieldDefinition, FormSchema } from "@/types";
import { useUploadPrivateFile } from "@/lib/fileUpload";
import { cn } from "@/lib/utils";
import { Upload, Link as LinkIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export interface DynamicFormRendererProps {
  schema: FormSchema;
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  submitLabel?: string;
  isSubmitting?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
  className?: string;
  /** Builder's "Live Preview" tab: renders the same controls but never
   * actually calls onSubmit and disables the real FILE_REF upload path
   * (there's no real form/organization to attach a file to yet). */
  previewOnly?: boolean;
  /** Required (with organizationId) to make FILE_REF fields functional —
   * omit only for previewOnly rendering. */
  organizationId?: string;
  formDefinitionId?: string;
}

/** Builds a Zod schema matching the same invariants the backend's AJV
 * validator enforces (see forms.service.ts's `fieldToJsonSchema`), so
 * client-side errors surface before a round trip, not instead of it — the
 * server remains the actual source of truth. */
function buildZodSchema(fields: FormFieldDefinition[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    let validator: z.ZodTypeAny;
    switch (field.type) {
      case "NUMBER": {
        let num = z.coerce.number();
        if (field.min !== undefined) num = num.min(field.min, `Must be at least ${field.min}.`);
        if (field.max !== undefined) num = num.max(field.max, `Must be at most ${field.max}.`);
        validator = field.required ? num : num.optional();
        break;
      }
      case "BOOLEAN":
        validator = z.boolean();
        break;
      case "CONSENT":
        validator = field.required
          ? z.boolean().refine((v) => v === true, { message: "You must agree to continue." })
          : z.boolean().optional();
        break;
      case "MULTI_SELECT": {
        let arr = z.array(z.string());
        if (field.required) arr = arr.min(1, "Select at least one option.");
        if (field.maxSelections) arr = arr.max(field.maxSelections, `Select at most ${field.maxSelections}.`);
        validator = arr;
        break;
      }
      case "URL":
        validator = field.required
          ? z.string().min(1, "URL is required.").url("Enter a valid URL.")
          : z.union([z.string().url("Enter a valid URL."), z.literal("")]).optional();
        break;
      case "FILE_REF":
        validator = field.required ? z.string().min(1, "Attach a file to continue.") : z.string().optional();
        break;
      case "DATE":
      case "SINGLE_SELECT":
      case "SHORT_TEXT":
      case "LONG_TEXT":
      default: {
        let str = z.string();
        if (field.required) str = str.min(1, `${field.label} is required.`);
        if (field.maxLength) str = str.max(field.maxLength, `Maximum length is ${field.maxLength} characters.`);
        validator = field.required ? str : str.optional();
      }
    }
    shape[field.key] = validator;
  }
  return z.object(shape);
}

function defaultValueFor(field: FormFieldDefinition): unknown {
  switch (field.type) {
    case "MULTI_SELECT":
      return [];
    case "BOOLEAN":
    case "CONSENT":
      return false;
    default:
      return "";
  }
}

function FileRefControl({
  field,
  value,
  onChange,
  organizationId,
  formDefinitionId,
  disabled,
}: {
  field: FormFieldDefinition;
  value: string;
  onChange: (fileId: string) => void;
  organizationId?: string;
  formDefinitionId?: string;
  disabled?: boolean;
}) {
  const uploadMutation = useUploadPrivateFile();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);

  const handleSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !organizationId || !formDefinitionId) return;
    try {
      const asset = await uploadMutation.mutateAsync({
        purpose: "FORM_ATTACHMENT",
        organizationId,
        resourceId: formDefinitionId,
        file,
      });
      setFileName(file.name);
      onChange(asset.id);
      toast.success("File attached.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload file.");
    }
  };

  if (!organizationId || !formDefinitionId) {
    return <div className="text-[11px] text-muted-foreground italic">File upload is unavailable in preview.</div>;
  }

  return (
    <div className="space-y-1">
      <input ref={inputRef} type="file" className="hidden" onChange={handleSelected} />
      {value ? (
        <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <span className="truncate flex-1">{fileName || "File attached"}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled} className="h-6 text-[11px] px-2">
            Replace
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled || uploadMutation.isPending} className="text-xs h-8 gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          {uploadMutation.isPending ? "Uploading..." : "Upload File"}
        </Button>
      )}
    </div>
  );
}

/** Renders a `FormSchema` as a real fillable form and collects a
 * `responseData` payload matching exactly what `POST .../forms/:id/responses`
 * expects — used both for the org-admin builder's live preview
 * (`previewOnly`) and for real participant-facing form submission. */
export function DynamicFormRenderer({
  schema,
  initialValues = {},
  onSubmit,
  submitLabel = "Submit",
  isSubmitting = false,
  onCancel,
  cancelLabel = "Cancel",
  className,
  previewOnly = false,
  organizationId,
  formDefinitionId,
}: DynamicFormRendererProps) {
  const fields = schema.fields ?? [];
  const zodSchema = React.useMemo(() => buildZodSchema(fields), [fields]);

  const defaultValues = React.useMemo(() => {
    const values: Record<string, unknown> = {};
    for (const f of fields) {
      values[f.key] = initialValues[f.key] !== undefined ? initialValues[f.key] : defaultValueFor(f);
    }
    return values;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues,
  });

  const handleFormSubmit = handleSubmit(async (values) => {
    if (previewOnly) {
      toast.success("Preview passed validation.");
      return;
    }
    await onSubmit(values);
  });

  if (fields.length === 0) {
    return <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">This form has no fields yet.</div>;
  }

  return (
    <form onSubmit={handleFormSubmit} className={cn("space-y-4", className)}>
      {fields.map((field) => {
        const error = (errors as Record<string, { message?: string }>)[field.key]?.message;

        return (
          <div key={field.key} className="space-y-1.5">
            {field.type !== "CONSENT" && (
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={field.key} className="text-xs font-semibold text-foreground">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {field.helpText && !error && <span className="text-[11px] text-muted-foreground">{field.helpText}</span>}
              </div>
            )}

            {(field.type === "SHORT_TEXT") && (
              <Controller name={field.key} control={control} render={({ field: f }) => (
                <Input id={field.key} disabled={isSubmitting} maxLength={field.maxLength} className={cn("h-9 text-xs", error && "border-destructive")} {...f} value={(f.value as string) ?? ""} />
              )} />
            )}

            {field.type === "LONG_TEXT" && (
              <Controller name={field.key} control={control} render={({ field: f }) => (
                <Textarea id={field.key} rows={4} disabled={isSubmitting} maxLength={field.maxLength} className={cn("text-xs resize-y", error && "border-destructive")} {...f} value={(f.value as string) ?? ""} />
              )} />
            )}

            {field.type === "NUMBER" && (
              <Controller name={field.key} control={control} render={({ field: f }) => (
                <Input id={field.key} type="number" min={field.min} max={field.max} disabled={isSubmitting} className={cn("h-9 text-xs max-w-xs", error && "border-destructive")} {...f} value={(f.value as string | number) ?? ""} />
              )} />
            )}

            {field.type === "URL" && (
              <Controller name={field.key} control={control} render={({ field: f }) => (
                <div className="relative">
                  <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input id={field.key} type="url" placeholder="https://..." disabled={isSubmitting} className={cn("pl-8 h-9 text-xs font-mono", error && "border-destructive")} {...f} value={(f.value as string) ?? ""} />
                </div>
              )} />
            )}

            {field.type === "DATE" && (
              <Controller name={field.key} control={control} render={({ field: f }) => (
                <Input id={field.key} type="date" disabled={isSubmitting} className={cn("h-9 text-xs max-w-xs", error && "border-destructive")} {...f} value={(f.value as string) ?? ""} />
              )} />
            )}

            {field.type === "BOOLEAN" && (
              <Controller name={field.key} control={control} render={({ field: f }) => (
                <div className="flex items-center gap-2 p-2 rounded-lg border border-border">
                  <Switch checked={Boolean(f.value)} onCheckedChange={f.onChange} disabled={isSubmitting} />
                  <span className="text-xs text-muted-foreground">{f.value ? "Yes" : "No"}</span>
                </div>
              )} />
            )}

            {field.type === "CONSENT" && (
              <Controller name={field.key} control={control} render={({ field: f }) => (
                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border cursor-pointer hover:border-primary/40">
                  <input type="checkbox" checked={Boolean(f.value)} onChange={(e) => f.onChange(e.target.checked)} disabled={isSubmitting} className="mt-0.5 h-3.5 w-3.5" />
                  <span className="text-xs text-foreground">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                    {field.helpText && <div className="text-[11px] text-muted-foreground mt-0.5">{field.helpText}</div>}
                  </span>
                </label>
              )} />
            )}

            {field.type === "SINGLE_SELECT" && (
              <Controller name={field.key} control={control} render={({ field: f }) => (
                <div className="flex flex-wrap gap-1.5">
                  {(field.options ?? []).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => f.onChange(opt)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                        f.value === opt ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )} />
            )}

            {field.type === "MULTI_SELECT" && (
              <Controller name={field.key} control={control} render={({ field: f }) => {
                const selected: string[] = Array.isArray(f.value) ? f.value : [];
                return (
                  <div className="flex flex-wrap gap-1.5">
                    {(field.options ?? []).map((opt) => {
                      const isSelected = selected.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => f.onChange(isSelected ? selected.filter((s) => s !== opt) : [...selected, opt])}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                            isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40"
                          )}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                );
              }} />
            )}

            {field.type === "FILE_REF" && (
              <Controller name={field.key} control={control} render={({ field: f }) => (
                <FileRefControl field={field} value={(f.value as string) ?? ""} onChange={f.onChange} organizationId={previewOnly ? undefined : organizationId} formDefinitionId={previewOnly ? undefined : formDefinitionId} disabled={isSubmitting} />
              )} />
            )}

            {error && (
              <div className="flex items-center gap-1 text-[11px] text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>{error}</span>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" size="sm" disabled={isSubmitting} className="text-xs font-semibold">
          {isSubmitting ? "Submitting..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting} className="text-xs">
            {cancelLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
