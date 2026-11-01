import { toast } from "sonner";
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
import { MultiSelectField } from "@/components/employee/multi-select-field";
import { getErrorMessage } from "@/lib/utils";

export type { FieldDef, FieldType } from "@/lib/field-defs";

export type FieldValues = Record<string, string>;

/** Ném lỗi này trong onSubmit để hiện lỗi ngay dưới ô `field`. */
export class FieldError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
    this.name = "FieldError";
  }
}

interface FieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FieldDef[];
  initial?: object | null;
  submitLabel?: string;
  onSubmit: (values: Record<string, string | number | null>) => Promise<void>;
  /** Gợi ý giá trị khác khi một field đổi (vd: chọn phòng ban → tự điền quản lý). */
  onFieldChange?: (
    name: string,
    value: string,
    values: FieldValues,
  ) => Partial<FieldValues> | void;
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

const buildValues = (
  fields: FieldDef[],
  initial?: object | null,
): FieldValues => {
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
  onFieldChange,
}: FieldDialogProps) => {
  const [values, setValues] = useState<FieldValues>({});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [customFields, setCustomFields] = useState<Record<string, boolean>>({});
  const wasOpen = useRef(false);
  const [createFor, setCreateFor] = useState<FieldDef | null>(null);
  const [createName, setCreateName] = useState("");
  const [createParent, setCreateParent] = useState("none");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const submitCreate = async () => {
    if (!createFor?.onCreate) return;
    const name = createName.trim();
    if (!name) return setCreateError("Vui lòng nhập tên.");
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createFor.onCreate({ name, parentId: createParent === "none" ? null : createParent }, values);
      setField(createFor.name, created);
      toast.success(`Đã tạo “${created}”`);
      setCreateFor(null);
    } catch (caught) {
      setCreateError(getErrorMessage(caught));
    } finally {
      setCreating(false);
    }
  };

  // Reset only when the dialog opens (not on every render), otherwise typing
  // would be wiped by a new `fields`/`initial` identity each render.
  useEffect(() => {
    if (open && !wasOpen.current) {
      setValues(buildValues(fields, initial));
      setCustomFields({});
      setError(null);
      setFieldErrors({});
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
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      // Xoá giá trị của field phụ thuộc nếu không còn hợp lệ (vd: đổi phòng ban → chức danh cũ).
      fields.forEach((field) => {
        if (field.dependsOn !== name || !field.optionsByValue) return;
        const options = field.optionsByValue[value] ?? field.options ?? [];
        if (
          next[field.name] &&
          !options.some((option) => option.value === next[field.name])
        ) {
          next[field.name] = "";
        }
      });
      const patch = onFieldChange?.(name, value, next);
      return patch ? { ...next, ...(patch as FieldValues) } : next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    // Gom lỗi TỪNG trường (hiện ngay dưới ô), không dừng ở lỗi đầu tiên.
    const nextErrors: Record<string, string> = {};
    for (const field of fields) {
      const raw = (values[field.name] ?? "").trim();
      if (field.required && !raw) {
        nextErrors[field.name] = `Vui lòng nhập ${field.label.toLowerCase()}.`;
        continue;
      }
      if (
        (field.type === "number" || field.type === "currency") &&
        raw &&
        Number.isNaN(Number(raw))
      ) {
        nextErrors[field.name] = `${field.label} phải là số.`;
        continue;
      }
      const invalid = raw && field.validate ? field.validate(raw, values) : null;
      if (invalid) nextErrors[field.name] = invalid;
    }
    setFieldErrors(nextErrors);
    const firstInvalid = fields.find((field) => nextErrors[field.name]);
    if (firstInvalid) {
      const count = Object.keys(nextErrors).length;
      setError(count > 1 ? `Còn ${count} ô cần sửa.` : nextErrors[firstInvalid.name]);
      toast.error(count > 1 ? `Còn ${count} ô cần sửa` : nextErrors[firstInvalid.name]);
      document.getElementById(`field-${firstInvalid.name}`)?.focus();
      return;
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
        payload[field.name] = Number.isNaN(parsed.getTime())
          ? raw
          : parsed.toISOString();
      } else {
        payload[field.name] = raw;
      }
    }

    setSaving(true);
    try {
      await onSubmit(payload);
      onOpenChange(false);
    } catch (submitError) {
      const message = getErrorMessage(submitError);
      if (submitError instanceof FieldError) {
        setFieldErrors((prev) => ({ ...prev, [submitError.field]: message }));
        document.getElementById(`field-${submitError.field}`)?.focus();
      }
      setError(message);
      toast.error("Chưa lưu được", { description: message });
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
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                    {section.label}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {section.fields.map((field) => {
                    const id = `field-${field.name}`;
                    const span =
                      field.span === 2 || field.type === "textarea"
                        ? "sm:col-span-2"
                        : "";
                    return (
                      <div
                        key={field.name}
                        className={`space-y-1.5 ${span} ${fieldErrors[field.name] ? "[&_input]:border-destructive [&_textarea]:border-destructive [&_button[role=combobox]]:border-destructive" : ""}`}
                      >
                        <Label htmlFor={id} className="text-[12px]">
                          {field.label}
                          {field.required && (
                            <span className="ml-0.5 text-destructive">*</span>
                          )}
                        </Label>

                        {field.type === "select" ? (
                          (() => {
                            const opts =
                              (field.dependsOn && field.optionsByValue
                                ? (field.optionsByValue[
                                    values[field.dependsOn] ?? ""
                                  ] ?? field.options)
                                : field.options) ?? [];
                            const current = values[field.name] ?? "";
                            const isLegacy =
                              !!current &&
                              !opts.some((option) => option.value === current);
                            if (customFields[field.name]) {
                              return (
                                <div className="flex gap-2">
                                  <Input
                                    id={id}
                                    autoFocus
                                    value={current}
                                    placeholder="Nhập giá trị khác"
                                    onChange={(event) =>
                                      setField(field.name, event.target.value)
                                    }
                                    className="h-10"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-10"
                                    onClick={() =>
                                      setCustomFields((prev) => ({
                                        ...prev,
                                        [field.name]: false,
                                      }))
                                    }
                                  >
                                    Danh sách
                                  </Button>
                                </div>
                              );
                            }
                            return (
                              <Select
                                value={current || "none"}
                                onValueChange={(value) => {
                                  if (value === "__create__") {
                                    setCreateFor(field);
                                    setCreateName("");
                                    setCreateParent("none");
                                    setCreateError(null);
                                    return;
                                  }
                                  if (value === "__custom__") {
                                    setCustomFields((prev) => ({
                                      ...prev,
                                      [field.name]: true,
                                    }));
                                    return;
                                  }
                                  setField(
                                    field.name,
                                    value === "none" ? "" : value,
                                  );
                                }}
                              >
                                <SelectTrigger id={id} className="h-10">
                                  <SelectValue
                                    placeholder={field.placeholder ?? "Chọn"}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    Chưa chọn
                                  </SelectItem>
                                  {isLegacy && (
                                    <SelectItem value={current}>
                                      {current} (không có trên sơ đồ)
                                    </SelectItem>
                                  )}
                                  {opts.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                  {field.onCreate && (
                                    <SelectItem value="__create__" className="font-semibold text-brand-orange">
                                      {field.createLabel ?? "+ Tạo mới…"}
                                    </SelectItem>
                                  )}
                                  {field.allowCustom && (
                                    <SelectItem value="__custom__">
                                      Khác (nhập tay)…
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            );
                          })()
                        ) : field.type === "multiselect" ? (
                          <MultiSelectField
                            id={id}
                            value={values[field.name] ?? ""}
                            options={field.options ?? []}
                            allowCustom={field.allowCustom}
                            placeholder={field.placeholder}
                            onChange={(value) => setField(field.name, value)}
                          />
                        ) : field.type === "textarea" ? (
                          <Textarea
                            id={id}
                            rows={3}
                            value={values[field.name] ?? ""}
                            placeholder={field.placeholder}
                            onChange={(event) =>
                              setField(field.name, event.target.value)
                            }
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
                            inputMode={
                              field.type === "number" ||
                              field.type === "currency"
                                ? "numeric"
                                : undefined
                            }
                            value={values[field.name] ?? ""}
                            placeholder={field.placeholder}
                            onChange={(event) =>
                              setField(field.name, event.target.value)
                            }
                            className="h-10 text-[13px]"
                          />
                        )}

                        {fieldErrors[field.name] && (
                          <p className="text-[11px] font-medium leading-4 text-destructive" role="alert">
                            {fieldErrors[field.name]}
                          </p>
                        )}
                        {field.hint && !fieldErrors[field.name] && (
                          <p className="text-[11px] leading-4 text-muted-foreground">
                            {field.hint}
                          </p>
                        )}
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
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Huỷ
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Đang lưu…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <Dialog open={!!createFor} onOpenChange={(next) => !next && setCreateFor(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{(createFor?.createLabel ?? "Tạo mới").replace(/^\+\s*/, "").replace(/…$/, "")}</DialogTitle>
            <DialogDescription>Lưu vào sơ đồ tổ chức của công ty và tự chọn vào ô.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="create-option-name">Tên</Label>
              <Input id="create-option-name" autoFocus value={createName} onChange={(event) => setCreateName(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submitCreate(); } }} className="h-10" />
            </div>
            {createFor?.createParentOptions?.length ? (
              <div className="space-y-1.5">
                <Label>Phòng ban cha (nếu có)</Label>
                <Select value={createParent} onValueChange={setCreateParent}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không có</SelectItem>
                    {createFor.createParentOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {createError ? <p className="text-[13px] font-medium text-destructive">{createError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCreateFor(null)}>Huỷ</Button>
            <Button type="button" disabled={creating} onClick={() => void submitCreate()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Tạo và chọn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
