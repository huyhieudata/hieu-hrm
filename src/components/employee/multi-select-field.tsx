import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";

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

  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const close = (event: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // Một combobox: ô hiển thị chip đã chọn, bấm mở bảng tìm + danh sách ngay bên dưới.
  return (
    <div ref={boxRef} className="relative">
      <div
        id={id}
        role="combobox"
        aria-expanded={open}
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen((v) => !v); }
          if (event.key === "Escape") setOpen(false);
        }}
        className="flex min-h-10 w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-md border border-input bg-card py-1.5 pl-2 pr-9 text-[13px] outline-none focus-visible:border-primary"
      >
        {selected.length ? (
          selected.map((item) => (
            <span key={item} className="inline-flex min-h-7 items-center gap-1 rounded-full bg-primary-subtle py-0.5 pl-2.5 pr-0.5 text-[12.5px] font-medium text-brand-navy">
              {item}
              {!known.has(norm(item)) ? <span className="text-[11px] text-muted-foreground">(ngoài sơ đồ)</span> : null}
              <button
                type="button"
                aria-label={`Bỏ ${item}`}
                onClick={(event) => { event.stopPropagation(); toggle(item); }}
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-background/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))
        ) : (
          <span className="px-1.5 text-muted-foreground">{placeholder ?? "Chọn vị trí…"}</span>
        )}
        <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open ? (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-overlay">
          <div className="border-b border-border p-2">
            <Input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm vị trí…" className="h-9 text-[13px]" />
          </div>
          <div className="max-h-56 overflow-y-auto overscroll-contain">
            {filtered.map((option) => {
              const active = selectedKeys.has(norm(option.value));
              return (
                <button key={option.value} type="button" onClick={() => toggle(option.value)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-[14px] hover:bg-muted">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${active ? "border-brand-navy bg-brand-navy text-white" : "border-border"}`}>
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
      ) : null}
    </div>
  );
};
