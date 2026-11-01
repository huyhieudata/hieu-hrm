import { useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";

import { Input } from "@/components/ui/input";

export const MULTI_SEPARATOR = "; ";
export const splitMulti = (value: string | null | undefined) =>
  (value ?? "").split(/\s*;\s*/).map((item) => item.trim()).filter(Boolean);
export const joinMulti = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).join(MULTI_SEPARATOR);

const norm = (value: string) => value.trim().toLowerCase();

/** Chọn nhiều có tìm kiếm, hiện dạng chip. Giá trị lưu là chuỗi "A; B" (tương thích dữ liệu cũ). */
export const MultiSelectField = ({
  id,
  value,
  options,
  allowCustom,
  placeholder,
  onChange,
}: {
  id: string;
  value: string;
  options: { value: string; label: string }[];
  allowCustom?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) => {
  const [query, setQuery] = useState("");
  const selected = splitMulti(value);
  const selectedKeys = new Set(selected.map(norm));
  const known = new Set(options.map((option) => norm(option.value)));
  const filtered = useMemo(
    () => options.filter((option) => !query.trim() || norm(option.label).includes(norm(query))),
    [options, query],
  );
  const toggle = (item: string) =>
    onChange(joinMulti(selectedKeys.has(norm(item)) ? selected.filter((s) => norm(s) !== norm(item)) : [...selected, item]));
  const canAddCustom = allowCustom && query.trim() && !known.has(norm(query)) && !selectedKeys.has(norm(query));

  return (
    <div className="space-y-2">
      {selected.length ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <span key={item} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-primary-subtle py-1 pl-3 pr-1 text-[13px] font-medium text-brand-navy">
              {item}
              {!known.has(norm(item)) ? <span className="text-[11px] text-muted-foreground">(ngoài sơ đồ)</span> : null}
              <button type="button" aria-label={`Bỏ ${item}`} onClick={() => toggle(item)} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-background/60">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <Input id={id} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder ?? "Tìm vị trí…"} className="h-10" />
      <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background">
        {filtered.map((option) => {
          const active = selectedKeys.has(norm(option.value));
          return (
            <button key={option.value} type="button" onClick={() => toggle(option.value)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-[14px] hover:bg-muted">
              <span className={`flex h-5 w-5 items-center justify-center rounded border ${active ? "border-brand-navy bg-brand-navy text-white" : "border-border"}`}>
                {active ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              {option.label}
            </button>
          );
        })}
        {canAddCustom ? (
          <button type="button" onClick={() => { toggle(query.trim()); setQuery(""); }} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-[14px] font-medium text-brand-orange hover:bg-muted">
            <Plus className="h-4 w-4" /> Khác: thêm “{query.trim()}”
          </button>
        ) : null}
        {!filtered.length && !canAddCustom ? <p className="px-3 py-3 text-[13px] text-muted-foreground">Không có vị trí phù hợp.</p> : null}
      </div>
    </div>
  );
};
