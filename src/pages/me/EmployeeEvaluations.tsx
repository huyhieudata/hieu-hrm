import { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/mobile/EmptyState";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-provider";
import { recommendationLabel } from "@/lib/employee-evaluations";
import { getErrorMessage } from "@/lib/utils";

interface MyEvaluation {
  id: string;
  kind: string;
  period_label: string | null;
  submitted_at: string | null;
  total_score: number | null;
  recommendation: string | null;
  strengths: string | null;
  improvements: string | null;
  overall_comment: string | null;
  template_name: string;
  scale_max: number;
  criteria: { name: string; group_name: string | null; weight: number; score: number | null; comment: string | null }[];
}

/** Phiếu đánh giá đã chốt của chính mình (RPC my_evaluations, lọc theo tài khoản đăng nhập). */
const EmployeeEvaluations = () => {
  const { activeCompany } = useCompany();
  const [rows, setRows] = useState<MyEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompany) return;
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .rpc("my_evaluations", { p_company: activeCompany.id })
      .then(({ data, error: e }: { data: MyEvaluation[] | null; error: Error | null }) => {
        if (e) setError(getErrorMessage(e));
        else setRows(data ?? []);
        setLoading(false);
      });
  }, [activeCompany]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-3 p-1">
        <h1 className="text-[16px] font-semibold">Đánh giá của tôi</h1>
        <p className="text-[12px] text-muted-foreground">Chỉ hiện phiếu đã chốt của chính anh/chị.</p>
        {loading ? (
          <Card className="p-6 text-[12.5px] text-muted-foreground">Đang tải…</Card>
        ) : error ? (
          <Card className="p-6 text-[12.5px] text-destructive">{error}</Card>
        ) : rows.length === 0 ? (
          <EmptyState emoji="📋" title="Chưa có phiếu đánh giá đã chốt" />
        ) : (
          rows.map((r) => (
            <Card key={r.id} className="space-y-2 p-4 text-[12.5px]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {r.template_name}
                  {r.period_label ? ` · ${r.period_label}` : ""}
                </span>
                <span className="text-[15px] font-semibold text-primary">
                  {r.total_score ?? "—"}/{r.scale_max}
                </span>
              </div>
              <p className="text-muted-foreground">
                {r.submitted_at ? `Chốt ngày ${new Date(r.submitted_at).toLocaleDateString("vi-VN")}` : ""} · Kết luận:{" "}
                {recommendationLabel(r.kind, r.recommendation)}
              </p>
              <ul className="divide-y">
                {r.criteria.map((c, i) => (
                  <li key={i} className="flex justify-between gap-3 py-1">
                    <span>
                      {c.group_name ? `${c.group_name} › ` : ""}
                      {c.name}
                      {c.comment ? <span className="block text-[11.5px] text-muted-foreground">{c.comment}</span> : null}
                    </span>
                    <span className="whitespace-nowrap font-medium">{c.score ?? "—"}</span>
                  </li>
                ))}
              </ul>
              {r.strengths && <p><b>Điểm mạnh:</b> {r.strengths}</p>}
              {r.improvements && <p><b>Cần cải thiện:</b> {r.improvements}</p>}
              {r.overall_comment && <p><b>Nhận xét:</b> {r.overall_comment}</p>}
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
};

export default EmployeeEvaluations;
