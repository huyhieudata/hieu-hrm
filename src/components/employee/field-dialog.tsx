import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FieldDef } from "@/lib/field-defs";
import { getErrorMessage } from "@/lib/utils";

export type { FieldDef, FieldType } from "@/lib/field-defs";

export type FieldValues = Record<string, string>;

interface FieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FieldDef[];
  initial?: object | null;
  submitLabel?: string;
  onSubmit: (values: Record<string, string | number | null>) => Promise<void>;
}

const pad = (value: number) => String(value).padStart(2, "0");

const toInputValue = (value: unknown, type?: string) => {
  if (value === null || value === undefined) return "";
  if (type === "datetime") {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
      date.getMinutes(),
    )}`;
  }
  if (type === "date") return String(value).slice(0, 10);
  if (type === "month") return String(value).slice(0, 7);
  if (typeof value === "number") return String(value);
  return String(value);
};

const buildValues = (fields: FieldDef[], initial?: object | null): FieldValues => {
  const source = (initial ?? {}) as Record<string, unknown>;
  const next: FieldValues = {};
  for (const field of fields) {
    next[field.name] = toInputValue(source[field.name], field.type);
  }
  return next;
};

export const FieldDialog = ({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initial,
  submitLabel = "Lưu",
  onSubmit,
}: FieldDialogProps) => {
  const [values, setValues] = useState<FieldValues>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const wasOpen = useRef(false);

  // Reset only when the dialog opens (not on every render), otherwise typing
  // would be wiped by a new `fields`/`initial` identity each render.
  useEffect(() => {
    if (open && !wasOpen.current) {
      setValues(buildValues(fields, initial));
      setError(null);
    }
    wasOpen.current = open;
  }, [fields, initial, open]);

  const sections = useMemo(() => {
    const order: { label: string | null; fields: FieldDef[] }[] = [];
    for (const field of fields) {
      const label = field.section ?? null;
      const existing = order.find((entry) => entry.label === label);
      if (existing) existing.fields.push(field);
      else order.push({ label, fields: [field] });
    }
    return order;
  }, [fields]);

  const setField = (name: string, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      // Xoá giá trị của field phụ thuộc nếu không còn hợp lệ (vd: đổi phòng ban → chức danh cũ).
      fields.forEach((field) => {
        if (field.dependsOn !== name || !field.optionsByValue) return;
        const options = field.optionsByValue[value] ?? field.options ?? [];
        if (next[field.name] && !options.some((option) => option.value === next[field.name])) {
          next[field.name] = "";
        }
      });
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    for (const field of fields) {
      const raw = (values[field.name] ?? "").trim();
      if (field.required && !raw) {
        setError(`Vui lòng nhập ${field.label.toLowerCase()}.`);
        return;
      }
      if ((field.type === "number" || field.type === "currency") && raw && Number.isNaN(Number(raw))) {
        setError(`${field.label} phải là số.`);
        return;
      }
    }

    const payload: Record<string, string | number | null> = {};
    for (const field of fields) {
      const raw = (values[field.name] ?? "").trim();
      if (raw === "") {
        payload[field.name] = null;
      } else if (field.type === "number" || field.type === "currency") {
        payload[field.name] = Number(raw);
      } else if (field.type === "month") {
        payload[field.name] = /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : raw;
      } else if (field.type === "datetime") {
        const parsed = new Date(raw);
        payload[field.name] = Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
      } else {
        payload[field.name] = raw;
      }
    }

    setSaving(true);
    try {
      await onSubmit(payload);
      onOpenChange(false);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <div className="space-y-4 py-3">
            {sections.map((section, index) => (
              <div
                key={section.label ?? `section-${index}`}
                className={
                  section.label
                    ? "space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3.5"
                    : "space-y-3"
                }
              >
                {section.label && (
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-primary">
                    {section.label}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {section.fields.map((field) => {
                    const id = `field-${field.name}`;
                    const span = field.span === 2 || field.type === "textarea" ? "sm:col-span-2" : "";
                    return (
                      <div key={field.name} className={`space-y-1.5 ${span}`}>
                        <Label htmlFor={id} className="text-[12px]">
                          {field.label}
                          {field.required && <span className="ml-0.5 text-destructive">*</span>}
                        </Label>

                        {field.type === "select" ? (
                          <Select
                            value={values[field.name] || "none"}
                            onValueChange={(value) => setField(field.name, value === "none" ? "" : value)}
                          >
                            <SelectTrigger id={id} className="h-10">
                              <SelectValue placeholder={field.placeholder ?? "Chọn"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Chưa chọn</SelectItem>
                              {(
                                field.dependsOn && field.optionsByValue
                                  ? field.optionsByValue[values[field.dependsOn] ?? ""] ??
                                    field.options ??
                                    []
                                  : field.options ?? []
                              ).map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : field.type === "textarea" ? (
                          <Textarea
                            id={id}
                            rows={3}
                            value={values[field.name] ?? ""}
                            placeholder={field.placeholder}
                            onChange={(event) => setField(field.name, event.target.value)}
                            className="text-[13px]"
                          />
                        ) : (
                          <Input
                            id={id}
                            type={
                              field.type === "date"
                                ? "date"
                                : field.type === "month"
                                  ? "month"
                                : field.type === "datetime"
                                  ? "datetime-local"
                                  : field.type === "email"
                                    ? "email"
                                    : "text"
                            }
                            inputMode={field.type === "number" || field.type === "currency" ? "numeric" : undefined}
                            value={values[field.name] ?? ""}
                            placeholder={field.placeholder}
                            onChange={(event) => setField(field.name, event.target.value)}
                            className="h-10 text-[13px]"
                          />
                        )}

                        {field.hint && <p className="text-[10.5px] leading-4 text-muted-foreground">{field.hint}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {error && (
              <p className="rounded-md border border-destructive/25 bg-destructive-subtle px-3 py-2 text-[11.5px] leading-5 text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Đang lưu…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
