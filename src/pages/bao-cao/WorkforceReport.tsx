import { useCallback, useEffect, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-provider";
import { exportExcel } from "@/lib/export-utils";

type Bucket = { label: string; count: number; leavers?: number };
interface Report {
  scope: "company" | "team";
  headcount_start: number;
  headcount_end: number;
  hires: number;
  leavers: number;
  turnover_pct: number | null;
  monthly: { month: string; hires: number; leavers: number }[];
  by_department: Bucket[];
  by_gender: Bucket[];
  by_type: Bucket[];
  by_tenure: Bucket[];
  by_age: Bucket[];
  leave_reasons: Bucket[];
}

const TYPE_LABELS: Record<string, string> = {
  full_time: "Toàn thời gian",
  part_time: "Bán thời gian",
  intern: "Thực tập",
  contract: "Hợp đồng/Thời vụ",
  probation: "Thử việc",
  unknown: "Chưa rõ",
};

const year = new Date().getFullYear();

const BarList = ({ title, items, labels }: { title: string; items: Bucket[]; labels?: Record<string, string> }) => {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-[13px] font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">Chưa có dữ liệu.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.label} className="text-[12px]">
              <div className="flex justify-between">
                <span>{labels?.[item.label] ?? item.label}</span>
                <span className="font-medium">
                  {item.count}
                  {item.leavers ? <span className="text-muted-foreground"> · nghỉ {item.leavers}</span> : null}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded bg-muted">
                <div className="h-1.5 rounded bg-primary" style={{ width: `${(item.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

const WorkforceReport = () => {
  const { activeCompany } = useCompany();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    const { data: rows, error } = await supabase.rpc("workforce_report" as never, {
      p_company: activeCompany.id,
      p_from: from,
      p_to: to,
    } as never);
    setLoading(false);
    if (error) {
      toast.error(error.message || "Không tải được báo cáo.");
      return;
    }
    setData(rows as unknown as Report);
  }, [activeCompany, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = () => {
    if (!data) return;
    exportExcel(
      `bao-cao-nhan-su-${from}-${to}`,
      ["Tháng", "Tuyển mới", "Nghỉ việc"],
      data.monthly.map((m) => [m.month, m.hires, m.leavers]),
    );
  };

  const stats = data
    ? [
        { label: "Nhân sự đầu kỳ", value: data.headcount_start },
        { label: "Nhân sự cuối kỳ", value: data.headcount_end },
        { label: "Tuyển mới", value: data.hires },
        { label: "Nghỉ việc", value: data.leavers },
        { label: "Tỷ lệ nghỉ việc", value: data.turnover_pct == null ? "—" : `${data.turnover_pct}%` },
      ]
    : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Báo cáo"
        title="Biến động & cơ cấu nhân sự"
        description={
          data?.scope === "team"
            ? "Chỉ gồm nhân viên anh/chị quản lý."
            : "Tuyển mới, nghỉ việc, tỷ lệ nghỉ việc và cơ cấu nhân sự của công ty. Không gồm dữ liệu lương."
        }
        actions={
          <Button variant="outline" className="h-9 gap-1.5 text-[12.5px]" onClick={handleExport} disabled={!data}>
            <FileSpreadsheet className="h-4 w-4" /> Xuất Excel
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-[12px]">Từ ngày</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
        </div>
        <div>
          <Label className="text-[12px]">Đến ngày</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
        </div>
        {loading && <Loader2 className="mb-2 h-4 w-4 animate-spin" />}
      </div>
      {data && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            {stats.map((s) => (
              <Card key={s.label} className="p-4">
                <p className="text-[11.5px] text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-xl font-semibold">{s.value}</p>
              </Card>
            ))}
          </div>
          <Card className="mb-4 overflow-x-auto p-4">
            <h3 className="mb-3 text-[13px] font-semibold">Biến động theo tháng</h3>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1">Tháng</th>
                  <th>Tuyển mới</th>
                  <th>Nghỉ việc</th>
                  <th>Chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly.map((m) => (
                  <tr key={m.month} className="border-t">
                    <td className="py-1">{m.month.split("-").reverse().join("/")}</td>
                    <td>{m.hires}</td>
                    <td>{m.leavers}</td>
                    <td>{m.hires - m.leavers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="grid gap-3 md:grid-cols-3">
            <BarList title="Theo phòng ban" items={data.by_department} />
            <BarList title="Theo giới tính" items={data.by_gender} />
            <BarList title="Theo loại hình" items={data.by_type} labels={TYPE_LABELS} />
            <BarList title="Theo thâm niên" items={data.by_tenure} />
            <BarList title="Theo độ tuổi" items={data.by_age} />
            <BarList title="Lý do nghỉ việc (trong kỳ)" items={data.leave_reasons} />
          </div>
        </>
      )}
    </AppShell>
  );
};

export default WorkforceReport;
