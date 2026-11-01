import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCompany } from "@/lib/company-provider";
import { getErrorMessage } from "@/lib/utils";
import {
  addHoliday,
  deleteHoliday,
  loadWorkCalendar,
  saveWorkDays,
  type CompanyHoliday,
} from "@/lib/work-calendar";

const PRESETS = [
  { key: "mon-fri", label: "Thứ 2 – Thứ 6", days: [1, 2, 3, 4, 5] },
  { key: "mon-sat", label: "Thứ 2 – Thứ 7", days: [1, 2, 3, 4, 5, 6] },
];

/** Lịch làm việc & ngày lễ: dùng để tính số ngày nghỉ (server + xem trước). Owner/Admin/HR chỉnh (RLS). */
const WorkCalendarPage = () => {
  const { activeCompany, role } = useCompany();
  const canEdit = role === "owner" || role === "admin" || role === "hr";
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    try {
      const r = await loadWorkCalendar(activeCompany.id);
      setWorkDays(r.workDays);
      setHolidays(r.holidays);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [activeCompany]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = PRESETS.find((p) => p.days.join() === [...workDays].sort().join())?.key ?? "mon-fri";

  const choose = async (days: number[]) => {
    if (!activeCompany) return;
    try {
      await saveWorkDays(activeCompany.id, days);
      setWorkDays(days);
      toast.success("Đã lưu lịch làm việc", { description: "Áp dụng cho đơn nghỉ tạo/sửa từ bây giờ." });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const add = async () => {
    if (!activeCompany) return;
    if (!date || !name.trim()) {
      toast.error("Nhập ngày và tên ngày lễ.");
      return;
    }
    try {
      await addHoliday(activeCompany.id, date, name.trim());
      setDate("");
      setName("");
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e).includes("duplicate") ? "Ngày này đã có trong danh sách." : getErrorMessage(e));
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Cài đặt"
        title="Lịch làm việc & ngày lễ"
        description="Số ngày nghỉ của đơn chỉ tính ngày làm việc, bỏ ngày nghỉ cuối tuần và ngày lễ dưới đây. Nửa ngày = 0,5."
      />
      {loading ? (
        <Card className="flex items-center gap-2 p-8 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h3 className="mb-3 text-[13px] font-semibold">Ngày làm việc trong tuần</h3>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.key}
                  variant={current === p.key ? "default" : "outline"}
                  disabled={!canEdit}
                  onClick={() => void choose(p.days)}
                  className="h-9 text-[12.5px]"
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {!canEdit && <p className="mt-2 text-[11.5px] text-muted-foreground">Chỉ Chủ sở hữu/Quản trị/HR được chỉnh.</p>}
          </Card>
          <Card className="p-4">
            <h3 className="mb-3 text-[13px] font-semibold">Ngày lễ</h3>
            {canEdit && (
              <div className="mb-3 flex flex-wrap gap-2">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" />
                <Input placeholder="Tên ngày lễ" value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-48" />
                <Button className="h-9 text-[12.5px]" onClick={() => void add()}>Thêm</Button>
              </div>
            )}
            {holidays.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">Chưa có ngày lễ.</p>
            ) : (
              <ul className="space-y-1 text-[12.5px]">
                {holidays.map((h) => (
                  <li key={h.id} className="flex items-center justify-between">
                    <span>{h.holiday_date.split("-").reverse().join("/")} · {h.name}</span>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void deleteHoliday(h.id).then(load).catch((e) => toast.error(getErrorMessage(e)))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
};

export default WorkCalendarPage;
