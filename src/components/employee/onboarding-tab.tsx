import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Eye, ListChecks, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/utils";
import OnboardingFormDialog from "@/components/onboarding/onboarding-form-dialog";
import { getEmployee, type EmployeeRecord } from "@/lib/employee-records";
import { listOnboardingTemplates, type OnboardingTemplate } from "@/lib/settings";
import { ONBOARDING_STATUS_LABELS, formatDay, listRows, type OnboardingRecord } from "@/lib/recruitment";

interface OnboardingTabProps {
  employeeId: string;
  companyId: string;
  canManage: boolean;
}

interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  completed: boolean;
}

const progressTone = (percent: number) =>
  percent >= 100 ? "bg-success" : percent >= 50 ? "bg-warning" : "bg-destructive";

const statusTone = (status: string) =>
  status === "completed" ? "success" : status === "in_progress" ? "info" : status === "cancelled" ? "muted" : "warning";

export const OnboardingTab = ({ employeeId, companyId, canManage }: OnboardingTabProps) => {
  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [employeeRecord, setEmployeeRecord] = useState<EmployeeRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allRecords, templateRows, employeeRow] = await Promise.all([
        listRows<OnboardingRecord>("onboarding_records", companyId, "created_at"),
        listOnboardingTemplates(companyId).catch(() => []),
        getEmployee(employeeId).catch(() => null),
      ]);
      setRecords(allRecords.filter((record) => record.employee_id === employeeId));
      setTemplates(templateRows);
      setEmployeeRecord(employeeRow);
    } catch (error) {
      toast.error("Không tải được hội nhập", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const mergeChecklist = useCallback(
    (record: OnboardingRecord): ChecklistItem[] => {
      const stored = (record.checklist ?? []) as ChecklistItem[];
      if (templates.length === 0) return stored;
      return templates.map((template) => {
        const match = stored.find(
          (item) => item.label.trim().toLowerCase() === template.label.trim().toLowerCase(),
        );
        return {
          id: match?.id ?? `tpl-${template.id}`,
          label: template.label,
          required: template.required,
          completed: match?.completed ?? false,
        };
      });
    },
    [templates],
  );

  const progressOf = (record: OnboardingRecord) => {
    const items = mergeChecklist(record);
    const total = items.length;
    const done = items.filter((item) => item.completed).length;
    return {
      done,
      total,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  };

  const statusOf = (record: OnboardingRecord) => {
    if (record.status === "cancelled") return "cancelled";
    const progress = progressOf(record);
    if (progress.total > 0 && progress.done === progress.total) return "completed";
    if (progress.done > 0) return "in_progress";
    return "pending";
  };

  const recordsView = useMemo(
    () => records.map((record) => ({ record, progress: progressOf(record), status: statusOf(record) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, templates],
  );

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-subtle text-primary-subtle-foreground">
            <ListChecks className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <div>
            <h3 className="text-[13.5px] font-semibold text-foreground">Hội nhập</h3>
            <p className="text-[11.5px] text-muted-foreground">
              {records.length} bản ghi · đồng bộ với module Hội nhập
            </p>
          </div>
        </div>
        {canManage && (
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-[12px]"
            onClick={() => setFormOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Thêm bản ghi
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-10 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
        </div>
      ) : recordsView.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <ListChecks className="mx-auto h-5 w-5 text-muted-foreground/70" />
          <p className="mt-2 text-[12.5px] text-muted-foreground">Nhân sự này chưa có bản ghi hội nhập nào.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {recordsView.map(({ record, progress, status }) => (
            <li key={record.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-foreground">
                  {record.position ?? "—"}
                  {record.department ? ` · ${record.department}` : ""}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Nhận việc {formatDay(record.hire_date)}
                  {record.expected_completion_date
                    ? ` · Dự kiến hoàn thành ${formatDay(record.expected_completion_date)}`
                    : ""}
                </p>
                {status !== "cancelled" && progress.total > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="h-1.5 w-[140px] overflow-hidden rounded-full bg-muted">
                      <span
                        className={`block h-full rounded-full ${progressTone(progress.percent)}`}
                        style={{ width: `${progress.percent}%` }}
                      />
                    </span>
                    <span className="text-[10.5px] text-muted-foreground">
                      {progress.done}/{progress.total} · {progress.percent}%
                    </span>
                  </div>
                )}
              </div>

              <Badge variant={statusTone(status)}>{ONBOARDING_STATUS_LABELS[status] ?? status}</Badge>

              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11.5px]" asChild>
                <Link
                  to={`/hoi-nhap?record=${record.id}&return=${encodeURIComponent(
                    `/employees/${employeeId}?tab=onboarding`,
                  )}`}
                >
                  <Eye className="h-3.5 w-3.5" /> Chi tiết
                </Link>
              </Button>

              <Button variant="ghost" size="icon-sm" aria-label="Mở bản ghi trong module Hội nhập" asChild>
                <Link to={`/hoi-nhap?record=${record.id}`}>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {employeeRecord && (
        <OnboardingFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          companyId={companyId}
          employee={employeeRecord}
          onSaved={load}
        />
      )}
    </Card>
  );
};

export default OnboardingTab;
