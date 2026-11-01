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
import { recommendationLabel } from "@/lib/employee-evaluations";

// Tổng hợp phiếu đánh giá (thử việc/định kỳ – KPI theo tiêu chí có trọng số) đã có trong employee_evaluations.
// Không tạo bảng mới: dùng lại biểu mẫu + phiếu đánh giá hiện có; RLS giới hạn phạm vi (Quản lý chỉ thấy nhân viên mình).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Row {
  id: string;
  employee_id: string;
  kind: string;
  period_label: string | null;
  period_end: string | null;
  total_score: number | null;
  recommendation: string | null;
  status: string;
  updated_at: string;
  template_id: string;
}

const KIND_LABELS: Record<string, string> = { probation: "Thử việc", periodic: "Định kỳ (KPI)" };

const PerformanceOverview = () => {
  const { activeCompany } = useCompany();
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, { full_name: string; code: string | null; department: string | null }>>({});
  const [scales, setScales] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    const { data, error } = await db
      .from("employee_evaluations")
      .select("id, employee_id, kind, period_label, period_end, total_score, recommendation, status, updated_at, template_id")
      .eq("company_id", activeCompany.id)
      .order("updated_at", { ascending: false })
      .limit(1000);
    if (error) {
      setLoading(false);
      toast.error(error.message || "Không tải được đánh giá.");
      return;
    }
    const list = (data ?? []) as Row[];
    const empIds = [...new Set(list.map((r) => r.employee_id))];
    const tplIds = [...new Set(list.map((r) => r.template_id))];
    const [emps, tpls] = await Promise.all([
      empIds.length ? db.from("employees").select("id, full_name, code, department").in("id", empIds) : { data: [] },
      tplIds.length ? db.from("evaluation_templates").select("id, scale_max").in("id", tplIds) : { data: [] },
    ]);
    setLoading(false);
    setRows(list);
    setNames(Object.fromEntries(((emps.data ?? []) as { id: string; full_name: string; code: string | null; department: string | null }[]).map((e) => [e.id, e])));
    setScales(Object.fromEntries(((tpls.data ?? []) as { id: string; scale_max: number }[]).map((t) => [t.id, t.scale_max])));
  }, [activeCompany]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind !== "all" && r.kind !== kind) return false;
      if (status !== "all" && r.status !== status) return false;
      const n = names[r.employee_id];
      return !q || `${n?.full_name ?? ""} ${n?.code ?? ""} ${n?.department ?? ""} ${r.period_label ?? ""}`.toLowerCase().includes(q);
    });
  }, [rows, kind, status, query, names]);

  const summary = useMemo(() => {
    const submitted = shown.filter((r) => r.status === "submitted" && r.total_score != null);
    const pct = submitted.map((r) => (Number(r.total_score) / (scales[r.template_id] || 5)) * 100);
    const avg = pct.length ? Math.round(pct.reduce((a, b) => a + b, 0) / pct.length) : null;
    return { total: shown.length, submitted: submitted.length, drafts: shown.filter((r) => r.status === "draft").length, avg };
  }, [shown, scales]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Đánh giá"
        title="Đánh giá hiệu suất"
        description="Tổng hợp phiếu đánh giá thử việc và định kỳ (KPI theo tiêu chí có trọng số). Tạo phiếu trong hồ sơ nhân viên › tab Đánh giá; tiêu chí ở Cài đặt › Biểu mẫu đánh giá."
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Tổng phiếu", summary.total],
          ["Đã nộp", summary.submitted],
          ["Bản nháp", summary.drafts],
          ["Điểm TB (% thang)", summary.avg == null ? "—" : `${summary.avg}%`],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-4">
            <p className="text-[11.5px] text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-[12.5px]">
          <option value="all">Mọi loại</option>
          <option value="periodic">Định kỳ (KPI)</option>
          <option value="probation">Thử việc</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-[12.5px]">
          <option value="all">Mọi trạng thái</option>
          <option value="submitted">Đã nộp</option>
          <option value="draft">Bản nháp</option>
        </select>
        <Input placeholder="Tìm nhân viên, phòng ban, kỳ…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 w-64" />
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-2">Nhân viên</th>
              <th>Loại</th>
              <th>Kỳ</th>
              <th>Điểm</th>
              <th>Xếp loại</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Chưa có phiếu đánh giá.</td></tr>
            ) : (
              shown.map((r) => {
                const n = names[r.employee_id];
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-1.5">
                      <span className="font-medium">{n?.full_name ?? "—"}</span>
                      {n?.department ? <span className="text-muted-foreground"> · {n.department}</span> : null}
                    </td>
                    <td>{KIND_LABELS[r.kind] ?? r.kind}</td>
                    <td>{r.period_label || r.period_end || "—"}</td>
                    <td>{r.total_score == null ? "—" : `${Number(r.total_score)}/${scales[r.template_id] ?? 5}`}</td>
                    <td>{recommendationLabel(r.kind, r.recommendation)}</td>
                    <td>{r.status === "submitted" ? "Đã nộp" : "Bản nháp"}</td>
                    <td className="pr-3 text-right">
                      <Link to={`/employees/${r.employee_id}?tab=evaluations`} className="text-primary hover:underline">Mở</Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
};

export default PerformanceOverview;
