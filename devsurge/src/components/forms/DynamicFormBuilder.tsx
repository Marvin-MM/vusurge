import * as React from "react";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  Edit3,
  FileText,
  Hash,
  ToggleLeft,
  List,
  CheckSquare,
  Globe,
  Calendar,
  ShieldCheck,
  Upload,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DynamicFormRenderer } from "@/components/forms/DynamicFormRenderer";
import { FormFieldDefinition, FormFieldType, FormSchema } from "@/types";
import { cn } from "@/lib/utils";

export interface DynamicFormBuilderProps {
  /** The schema being edited — a full replacement each time a new version is saved. */
  initialSchema?: FormSchema;
  onSave: (schema: FormSchema) => void;
  saving?: boolean;
  saveLabel?: string;
}

const FIELD_TYPES: { type: FormFieldType; label: string; icon: typeof FileText; desc: string }[] = [
  { type: "SHORT_TEXT", label: "Short Text", icon: FileText, desc: "Single-line string for titles, names, affiliations" },
  { type: "LONG_TEXT", label: "Long Text", icon: FileText, desc: "Multi-line explanation, background, or essay" },
  { type: "NUMBER", label: "Number", icon: Hash, desc: "Integer or float with optional min/max" },
  { type: "BOOLEAN", label: "Yes / No", icon: ToggleLeft, desc: "Boolean toggle" },
  { type: "SINGLE_SELECT", label: "Single Select", icon: List, desc: "Dropdown selection from defined choices" },
  { type: "MULTI_SELECT", label: "Multi-Select", icon: CheckSquare, desc: "Choose one or more from defined choices" },
  { type: "URL", label: "URL", icon: Globe, desc: "Valid web link or code repository" },
  { type: "DATE", label: "Date", icon: Calendar, desc: "Calendar date" },
  { type: "CONSENT", label: "Consent", icon: ShieldCheck, desc: "Mandatory confirmation checkbox" },
  { type: "FILE_REF", label: "File Attachment", icon: Upload, desc: "Uploaded document reference" },
];

function slugifyKey(label: string, existing: Set<string>): string {
  let base = label
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^[^a-zA-Z]+/, "")
    .slice(0, 60);
  if (!base) base = "field";
  let key = base;
  let i = 2;
  while (existing.has(key)) {
    key = `${base}_${i}`;
    i += 1;
  }
  return key;
}

/** Edits a `FormSchema` in place, matching the backend's real, closed
 * 10-field-type catalogue and AJV-validated invariants (select types need
 * options, FILE_REF needs an uploadPurpose, keys are unique) — see
 * `backend/src/modules/forms/forms.service.ts`. Every save is a brand new
 * version (the backend has no in-place schema edit), so this always starts
 * from the org-admin page's `initialSchema` (the current draft/published
 * version's fields) and calls `onSave` with the full replacement schema. */
export function DynamicFormBuilder({ initialSchema, onSave, saving = false, saveLabel = "Save as New Version" }: DynamicFormBuilderProps) {
  const [fields, setFields] = React.useState<FormFieldDefinition[]>(initialSchema?.fields ?? []);
  const [activeTab, setActiveTab] = React.useState<"editor" | "preview">("editor");
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [showAddFieldModal, setShowAddFieldModal] = React.useState(false);

  const editingField = fields.find((f) => f.key === editingKey) ?? null;

  const handleAddField = (type: FormFieldType) => {
    const existingKeys = new Set(fields.map((f) => f.key));
    const label = FIELD_TYPES.find((t) => t.type === type)?.label ?? "New Field";
    const key = slugifyKey(label, existingKeys);
    const newField: FormFieldDefinition = {
      key,
      type,
      label,
      required: false,
      options: type === "SINGLE_SELECT" || type === "MULTI_SELECT" ? ["Option A", "Option B"] : undefined,
      uploadPurpose: type === "FILE_REF" ? "FORM_ATTACHMENT" : undefined,
    };
    setFields((prev) => [...prev, newField]);
    setShowAddFieldModal(false);
    setEditingKey(key);
  };

  const handleUpdateField = (key: string, updates: Partial<FormFieldDefinition>) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, ...updates } : f)));
  };

  const handleDeleteField = (key: string) => {
    setFields((prev) => prev.filter((f) => f.key !== key));
    if (editingKey === key) setEditingKey(null);
  };

  const handleMoveField = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= fields.length) return;
    setFields((prev) => {
      const next = [...prev];
      [next[index], next[targetIdx]] = [next[targetIdx], next[index]];
      return next;
    });
  };

  const invariantError = React.useMemo(() => {
    const seen = new Set<string>();
    for (const f of fields) {
      if (seen.has(f.key)) return `Duplicate field key "${f.key}".`;
      seen.add(f.key);
      if ((f.type === "SINGLE_SELECT" || f.type === "MULTI_SELECT") && (!f.options || f.options.length === 0)) {
        return `Field "${f.label}" needs at least one option.`;
      }
      if (f.type === "FILE_REF" && !f.uploadPurpose) {
        return `Field "${f.label}" is missing its upload purpose.`;
      }
    }
    if (fields.length === 0) return "Add at least one field.";
    return null;
  }, [fields]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-foreground">Form Schema</h3>
          <Badge variant="outline" className="text-[11px] uppercase tracking-wider font-mono">
            {fields.length} Field{fields.length === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5 bg-muted/40">
            <Button type="button" variant={activeTab === "editor" ? "secondary" : "ghost"} size="sm" onClick={() => setActiveTab("editor")} className="text-xs h-7 px-3 gap-1.5">
              <Edit3 className="h-3.5 w-3.5" />
              Builder
            </Button>
            <Button type="button" variant={activeTab === "preview" ? "secondary" : "ghost"} size="sm" onClick={() => setActiveTab("preview")} className="text-xs h-7 px-3 gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Live Preview
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={Boolean(invariantError) || saving}
            title={invariantError ?? undefined}
            onClick={() => onSave({ fields })}
            className="h-8 text-xs font-semibold px-4"
          >
            {saving ? "Saving..." : saveLabel}
          </Button>
        </div>
      </div>

      {invariantError && (
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400">
          {invariantError}
        </div>
      )}

      {activeTab === "editor" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-3">
            {fields.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                No fields yet. Add one from the palette on the right.
              </div>
            ) : (
              fields.map((field, index) => {
                const meta = FIELD_TYPES.find((t) => t.type === field.type);
                const Icon = meta?.icon ?? FileText;
                return (
                  <div key={field.key} className="p-3.5 rounded-xl border border-border bg-card space-y-2 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground truncate">{field.label}</span>
                          {field.required && <span className="text-[10px] text-destructive font-bold">*</span>}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">key: {field.key} · {meta?.label}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveField(index, "up")} disabled={index === 0}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveField(index, "down")} disabled={index === fields.length - 1}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => setEditingKey(field.key)}>
                          Edit
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteField(field.key)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAddFieldModal(true)} className="w-full text-xs gap-1.5 border-dashed">
              <Plus className="h-3.5 w-3.5" />
              Add Field
            </Button>
          </div>

          <div className="lg:col-span-4">
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Field Types</div>
              {FIELD_TYPES.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => handleAddField(t.type)}
                  className="w-full flex items-start gap-2 p-2 rounded-lg text-left hover:bg-accent transition-colors"
                >
                  <t.icon className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground">{t.label}</div>
                    <div className="text-[10px] text-muted-foreground">{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-xl">
          <DynamicFormRenderer schema={{ fields }} onSubmit={async () => {}} previewOnly />
        </div>
      )}

      <Dialog open={showAddFieldModal} onOpenChange={setShowAddFieldModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Add Field</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                onClick={() => handleAddField(t.type)}
                className="flex flex-col items-start gap-1 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-accent transition-colors text-left"
              >
                <t.icon className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">{t.label}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingField)} onOpenChange={(open) => !open && setEditingKey(null)}>
        <DialogContent className="sm:max-w-md">
          {editingField && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm">Edit Field</DialogTitle>
                <DialogDescription className="text-xs">{FIELD_TYPES.find((t) => t.type === editingField.type)?.label}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Label</Label>
                  <Input value={editingField.label} onChange={(e) => handleUpdateField(editingField.key, { label: e.target.value })} className="h-9 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Field Key <span className="text-muted-foreground font-normal">(what response data is stored under — cannot be changed after publishing)</span>
                  </Label>
                  <Input
                    value={editingField.key}
                    onChange={(e) => {
                      const newKey = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
                      if (!newKey || fields.some((f) => f.key === newKey && f.key !== editingField.key)) return;
                      setFields((prev) => prev.map((f) => (f.key === editingField.key ? { ...f, key: newKey } : f)));
                      setEditingKey(newKey);
                    }}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Help Text</Label>
                  <Textarea value={editingField.helpText ?? ""} onChange={(e) => handleUpdateField(editingField.key, { helpText: e.target.value || undefined })} rows={2} className="text-xs" />
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                  <Label className="text-xs font-semibold">Required</Label>
                  <Switch checked={editingField.required} onCheckedChange={(checked) => handleUpdateField(editingField.key, { required: checked })} />
                </div>

                {(editingField.type === "SHORT_TEXT" || editingField.type === "LONG_TEXT") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Max Length</Label>
                    <Input
                      type="number"
                      value={editingField.maxLength ?? ""}
                      onChange={(e) => handleUpdateField(editingField.key, { maxLength: e.target.value ? Number(e.target.value) : undefined })}
                      className="h-9 text-xs"
                    />
                  </div>
                )}

                {editingField.type === "NUMBER" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Min</Label>
                      <Input type="number" value={editingField.min ?? ""} onChange={(e) => handleUpdateField(editingField.key, { min: e.target.value ? Number(e.target.value) : undefined })} className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Max</Label>
                      <Input type="number" value={editingField.max ?? ""} onChange={(e) => handleUpdateField(editingField.key, { max: e.target.value ? Number(e.target.value) : undefined })} className="h-9 text-xs" />
                    </div>
                  </div>
                )}

                {(editingField.type === "SINGLE_SELECT" || editingField.type === "MULTI_SELECT") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Options (one per line)</Label>
                    <Textarea
                      value={(editingField.options ?? []).join("\n")}
                      onChange={(e) => handleUpdateField(editingField.key, { options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                      rows={4}
                      className="text-xs"
                    />
                    {editingField.type === "MULTI_SELECT" && (
                      <div className="space-y-1.5 pt-1">
                        <Label className="text-xs font-semibold">Max Selections</Label>
                        <Input
                          type="number"
                          value={editingField.maxSelections ?? ""}
                          onChange={(e) => handleUpdateField(editingField.key, { maxSelections: e.target.value ? Number(e.target.value) : undefined })}
                          className="h-9 text-xs"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" size="sm" onClick={() => setEditingKey(null)} className="text-xs">
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
