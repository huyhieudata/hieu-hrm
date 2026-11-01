import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileText, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/mobile/EmptyState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCompany } from "@/lib/company-provider";
import { deleteDocument, documentUrl, listDocuments, uploadDocument, type CompanyDocument } from "@/lib/company-documents";
import { getErrorMessage } from "@/lib/utils";

const size = (b: number | null) => (b == null ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

const EmployeeDocuments = () => {
  const { activeCompany, role } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const isHr = role === "owner" || role === "admin" || role === "hr";
  const [docs, setDocs] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setDocs(await listDocuments(companyId));
    } catch (e) {
      toast.error("Không tải được tài liệu", { description: getErrorMessage(e) });
    } finally {
      setLoading(false);
    }
  }, [companyId]);
  useEffect(() => void load(), [load]);

  const groups = useMemo(() => {
    const n = query.trim().toLocaleLowerCase("vi");
    const list = n ? docs.filter((d) => `${d.title} ${d.category} ${d.file_name}`.toLocaleLowerCase("vi").includes(n)) : docs;
    const map = new Map<string, CompanyDocument[]>();
    for (const d of list) map.set(d.category, [...(map.get(d.category) ?? []), d]);
    return [...map.entries()];
  }, [docs, query]);

  const open = async (doc: CompanyDocument, download: boolean) => {
    try {
      const url = await documentUrl(doc, download);
      if (download) window.location.assign(url);
      else window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <AppShell>
      <label className="shadow-card-soft flex h-12 items-center gap-2.5 rounded-full bg-card px-4 text-muted-foreground ring-1 ring-border">
        <Search className="h-4 w-4" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tài liệu..." className="h-11 w-full bg-transparent text-base text-foreground outline-none" />
      </label>
      {isHr && (
        <Button className="mt-3 w-full gap-1.5 rounded-full bg-brand-orange text-white hover:bg-brand-orange/90" onClick={() => setUploading(true)}>
          <Upload className="h-4 w-4" /> Tải lên tài liệu
        </Button>
      )}
      {!loading && groups.length === 0 ? (
        <div className="mt-4"><EmptyState emoji="📁" title="Chưa có tài liệu" description="Nội quy, quy trình, biểu mẫu công ty sẽ hiển thị ở đây." /></div>
      ) : null}
      {groups.map(([cat, items]) => (
        <section key={cat}>
          <h2 className="mb-2 mt-5 px-1 text-[13px] font-bold tracking-wide text-muted-foreground">{cat} {items.length}</h2>
          <div className="space-y-2">
            {items.map((d) => (
              <div key={d.id} className="shadow-card-soft flex items-center gap-3 rounded-[18px] bg-card p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-subtle text-brand-navy"><FileText className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{d.title}</p>
                  <p className="truncate text-[11.5px] text-muted-foreground">{d.file_name} · {size(d.size_bytes)} · {new Date(d.created_at).toLocaleDateString("vi-VN")}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-11 w-11" aria-label="Xem" onClick={() => open(d, false)}><Eye className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-11 w-11" aria-label="Tải về" onClick={() => open(d, true)}><Download className="h-4 w-4" /></Button>
                {isHr && (
                  <Button size="icon" variant="ghost" className="h-11 w-11 text-destructive" aria-label="Xoá"
                    onClick={() => { if (window.confirm(`Xoá "${d.title}"?`)) deleteDocument(d).then(load).catch((e) => toast.error(getErrorMessage(e))); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
      {uploading && companyId && <UploadDialog companyId={companyId} categories={[...new Set(docs.map((d) => d.category))]} onClose={() => setUploading(false)} onDone={load} />}
    </AppShell>
  );
};

const UploadDialog = ({ companyId, categories, onClose, onDone }: { companyId: string; categories: string[]; onClose: () => void; onDone: () => void }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Chung");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!file) return toast.error("Chọn tệp.");
    setBusy(true);
    try {
      await uploadDocument(companyId, file, { title: title.trim() || file.name, category: category.trim() || "Chung" });
      toast.success("Đã tải lên");
      onClose();
      onDone();
    } catch (e) {
      toast.error("Không tải lên được", { description: getErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Tải lên tài liệu</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, "")); }} />
          <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>{file ? `${file.name} (${size(file.size)})` : "Chọn tệp (tối đa 20MB)"}</Button>
          <Input placeholder="Tiêu đề" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          <Input placeholder="Danh mục (VD: Nội quy, Biểu mẫu)" list="doc-cats" value={category} onChange={(e) => setCategory(e.target.value)} />
          <datalist id="doc-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <DialogFooter>
          <Button className="w-full bg-brand-orange text-white hover:bg-brand-orange/90" disabled={busy} onClick={save}>Tải lên</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeDocuments;
