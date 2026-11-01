import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-provider";

interface Row {
  id: string;
  created_at: string;
  actor_name: string | null;
  source: "activity" | "access";
  action: string;
  summary: string;
  employee_id: string | null;
}

const ACCESS_LABELS: Record<string, string> = {
  sensitive_read: "Xem dữ liệu nhạy cảm",
  sensitive_bulk_read: "Xem dữ liệu nhạy cảm (nhiều dòng)",
  export_excel: "Xuất Excel",
  export_pdf: "Xuất PDF",
};

const db = supabase as unknown as {
  from: (t: string) => {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        gte: (k: string, v: string) => {
          order: (k: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: unknown[] | null; error: Error | null }> };
        };
      };
    };
  };
};

const daysAgoIso = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/** Nhật ký hoạt động: chỉ Owner/Admin. RLS: data_access_audit chỉ owner/admin; activity_logs theo company role. */
const ActivityLog = () => {
  const { activeCompany, role } = useCompany();
  const allowed = role === "owner" || role === "admin";
  const [from, setFrom] = useState(daysAgoIso(30));
  const [kind, setKind] = useState<"all" | "activity" | "access">("all");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompany || !allowed) return;
    setLoading(true);
    const since = `${from}T00:00:00+07:00`;
    const [a, b] = await Promise.all([
      db.from("activity_logs").select("id, created_at, actor_name, action, summary, entity_type, entity_id")
        .eq("company_id", activeCompany.id).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
      db.from("data_access_audit").select("id, created_at, actor_name, kind, target, employee_id, row_count")
        .eq("company_id", activeCompany.id).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
    ]);
    setLoading(false);
    if (a.error || b.error) {
      toast.error((a.error ?? b.error)?.message || "Không tải được nhật ký.");
      return;
    }
    const act = (a.data ?? []) as { id: string; created_at: string; actor_name: string | null; action: string; summary: string; entity_type: string; entity_id: string }[];
    const acc = (b.data ?? []) as { id: string; created_at: string; actor_name: string | null; kind: string; target: string | null; employee_id: string | null; row_count: number }[];
    setRows(
      [
        ...act.map((r) => ({ id: `a-${r.id}`, created_at: r.created_at, actor_name: r.actor_name, source: "activity" as const, action: r.action, summary: r.summary, employee_id: r.entity_type === "employee" ? r.entity_id : null })),
        ...acc.map((r) => ({ id: `d-${r.id}`, created_at: r.created_at, actor_name: r.actor_name, source: "access" as const, action: ACCESS_LABELS[r.kind] ?? r.kind, summary: `${r.target ?? ""}${r.row_count ? ` · ${r.row_count} dòng` : ""}`.replace(/^ · /, ""), employee_id: r.employee_id })),
      ].sort((x, y) => y.created_at.localeCompare(x.created_at)),
    );
  }, [activeCompany, allowed, from]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (kind === "all" || r.source === kind) && (!q || `${r.actor_name ?? ""} ${r.action} ${r.summary}`.toLowerCase().includes(q)));
  }, [rows, kind, query]);

  if (!allowed) {
    return (
      <AppShell>
        <Card className="p-12 text-center text-[13px] text-muted-foreground">Chỉ Chủ sở hữu/Quản trị viên được xem nhật ký hoạt động.</Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader eyebrow="Cài đặt" title="Nhật ký hoạt động" description="Thay đổi quyền, thành viên, hồ sơ và các lần xem/xuất dữ liệu nhạy cảm. Không hiển thị giá trị dữ liệu." />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <p className="text-[12px]">Từ ngày</p>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="h-9 rounded-md border bg-background px-2 text-[12.5px]">
          <option value="all">Tất cả</option>
          <option value="activity">Thay đổi</option>
          <option value="access">Xem/xuất dữ liệu</option>
        </select>
        <Input placeholder="Tìm người thực hiện, nội dung…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 w-64" />
        {loading && <Loader2 className="mb-2 h-4 w-4 animate-spin" />}
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-2">Thời gian</th>
              <th>Người thực hiện</th>
              <th>Hành động</th>
              <th>Nội dung</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Không có bản ghi.</td></tr>
            ) : (
              shown.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="whitespace-nowrap px-3 py-1.5">{new Date(r.created_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</td>
                  <td>{r.actor_name ?? "Hệ thống"}</td>
                  <td>{r.action}</td>
                  <td>
                    {r.summary}
                    {r.employee_id && (
                      <Link to={`/employees/${r.employee_id}`} className="ml-2 text-primary hover:underline">Hồ sơ</Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-[11.5px] text-muted-foreground">Hiển thị tối đa 500 bản ghi mỗi loại.</p>
    </AppShell>
  );
};

export default ActivityLog;
