import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/mobile/EmptyState";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-provider";
import { findMyEmployee } from "@/lib/attendance";
import { useCompany } from "@/lib/company-provider";
import { useDeviceMode } from "@/hooks/use-device-mode";
import { listPayrollItems, listPayrollPeriods, PAYROLL_STATUS_LABELS, type PayrollItem, type PayrollPeriod } from "@/lib/payroll";
import { getErrorMessage } from "@/lib/utils";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(Math.round(value));

/** Amounts stay hidden until the employee taps. No PIN — that needs a decision from HR. */
const EmployeePayslip = () => {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !user?.id) return;
    setLoading(true);
    setBlocked(null);
    try {
      const employee = await findMyEmployee(companyId, user.id);
      if (!employee) {
        setItems([]);
        return;
      }
      const [periodRows, itemRows] = await Promise.all([listPayrollPeriods(companyId), listPayrollItems(companyId)]);
      const mine = itemRows.filter((item) => item.employee_id === employee.id);
      setPeriods(periodRows);
      setItems(mine);
      setSelected(mine[0]?.period_id ?? null);
    } catch (error) {
      setBlocked(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [companyId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const periodById = useMemo(() => new Map(periods.map((period) => [period.id, period])), [periods]);
  const current = items.find((item) => item.period_id === selected) ?? items[0] ?? null;
  const period = current ? periodById.get(current.period_id) : null;
  const allowance = current ? current.position_allowance + current.responsibility_allowance + current.other_allowance : 0;
  const mobile = useDeviceMode() === "mobile";
  const periodIndex = current ? items.findIndex((item) => item.period_id === current.period_id) : -1;

  if (mobile) {
    const lines = current
      ? [
          ["Lương cơ bản", money(current.base_salary)],
          current.position_allowance ? ["Phụ cấp chức vụ", money(current.position_allowance)] : null,
          current.responsibility_allowance ? ["Phụ cấp trách nhiệm", money(current.responsibility_allowance)] : null,
          current.other_allowance ? ["Phụ cấp khác", money(current.other_allowance)] : null,
          !current.position_allowance && !current.responsibility_allowance && !current.other_allowance && allowance
            ? ["Phụ cấp", money(allowance)]
            : null,
        ].filter((row): row is [string, string] => Boolean(row))
      : [];
    return (
      <AppShell>
        <div className="space-y-3">
          {items.length > 1 && current ? (
            <div className="flex h-11 items-center justify-between">
              <button
                type="button"
                aria-label="Kỳ trước"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-card-soft"
                onClick={() => {
                  const next = items[Math.min(items.length - 1, periodIndex + 1)];
                  if (next) {
                    setSelected(next.period_id);
                    setRevealed(false);
                  }
                }}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="font-display text-[16px] font-bold">
                Tháng {period ? `${period.month}/${period.year}` : ""}
              </p>
              <button
                type="button"
                aria-label="Kỳ sau"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-card-soft"
                onClick={() => {
                  const next = items[Math.max(0, periodIndex - 1)];
                  if (next) {
                    setSelected(next.period_id);
                    setRevealed(false);
                  }
                }}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          ) : null}
          {loading ? <div className="h-36 animate-pulse rounded-[20px] bg-card" /> : null}
          {!loading && blocked ? (
            <EmptyState emoji="🔒" title="Chưa xem được phiếu lương" description="Phiếu lương chưa được mở cho tài khoản này, hoặc HR chưa phát hành." />
          ) : null}
          {!loading && !blocked && !current ? (
            <EmptyState emoji="💸" title="Chưa có phiếu lương" description="Khi HR chốt kỳ lương, phiếu của bạn hiện ở đây. Số tiền mặc định được che." />
          ) : null}
          {current && !blocked ? (
            <>
              <button type="button" onClick={() => setRevealed((value) => !value)} className="bg-brand-navy relative w-full overflow-hidden rounded-[20px] px-5 py-5 text-left text-white">
                <span className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full border-[12px] border-brand-orange/50" />
                <p className="text-[13px] text-white/75">Thực nhận {period ? `tháng ${period.month}/${period.year}` : ""}</p>
                <p className="mt-1 font-display text-[30px] font-bold tabular tracking-tight">
                  {revealed ? money(current.net_salary) : "••••••"} <small className="text-[16px] font-semibold">đ</small>
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[12px] text-white/80">
                  {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {period?.status === "paid" ? <Check className="h-3.5 w-3.5" /> : null}
                  {revealed ? "Chạm để ẩn" : "Ẩn mặc định · chạm để xem"}
                  {period ? ` · ${PAYROLL_STATUS_LABELS[period.status] ?? ""}` : ""}
                </p>
              </button>
              {revealed ? (
                <section className="shadow-card-soft rounded-[20px] bg-card px-4 py-2">
                  <p className="pt-2 text-[13px] font-bold text-muted-foreground">Thu nhập</p>
                  {lines.map(([label, value]) => (
                    <div key={label} className="flex h-10 items-center justify-between border-b border-border text-[14px]">
                      <span>{label}</span>
                      <b className="font-semibold tabular">{value}</b>
                    </div>
                  ))}
                  <p className="pt-3 text-[13px] font-bold text-muted-foreground">Khấu trừ</p>
                  <div className="flex h-10 items-center justify-between border-b border-border text-[14px]">
                    <span>BHXH, BHYT, BHTN</span>
                    <b className="font-semibold tabular text-destructive">-{money(current.insurance_employee)}</b>
                  </div>
                  <div className="flex h-10 items-center justify-between border-b border-border text-[14px]">
                    <span>Thuế TNCN</span>
                    <b className="font-semibold tabular text-destructive">-{money(current.tax_amount)}</b>
                  </div>
                  {current.other_deduction ? (
                    <div className="flex h-10 items-center justify-between text-[14px]">
                      <span>Khấu trừ khác</span>
                      <b className="font-semibold tabular text-destructive">-{money(current.other_deduction)}</b>
                    </div>
                  ) : null}
                </section>
              ) : (
                <p className="text-center text-[12px] text-muted-foreground">Chi tiết hiện sau khi bạn chạm để xem số tiền.</p>
              )}
            </>
          ) : null}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {loading ? <div className="h-36 animate-pulse rounded-3xl bg-card" /> : null}
      {!loading && blocked ? (
        <EmptyState
          emoji="🔒"
          title="Chưa xem được phiếu lương"
          description="Phiếu lương chưa được mở cho tài khoản này, hoặc HR chưa phát hành. Liên hệ HR nếu bạn cần bản giấy."
        />
      ) : null}
      {!loading && !blocked && !current ? (
        <EmptyState emoji="💸" title="Chưa có phiếu lương" description="Khi HR chốt kỳ lương, phiếu của bạn hiện ở đây. Số tiền mặc định được che." />
      ) : null}
      {current && !blocked ? (
        <>
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="bg-gradient-ok w-full rounded-3xl px-4 py-4 text-left text-white shadow-glow"
          >
            <p className="text-[12px] text-white/80">
              Thực nhận tháng {period ? `${period.month}/${period.year}` : ""}
            </p>
            <p className="mt-1 font-display text-[28px] font-extrabold tabular">{revealed ? `${money(current.net_salary)} ₫` : "•••••• ₫"}</p>
            <p className="mt-1 flex items-center gap-1 text-[12px] text-white/80">
              {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {revealed ? "Chạm để ẩn" : "Ẩn mặc định · chạm để xem"}
            </p>
          </button>
          {revealed ? (
            <section className="shadow-mobile space-y-2 rounded-3xl bg-card px-4 py-3 text-[13px]">
              <Row label="Lương cơ bản" value={money(current.base_salary)} />
              <Row label="Phụ cấp" value={`+${money(allowance)}`} tone="ok" />
              <Row label="BHXH" value={`−${money(current.insurance_employee)}`} tone="bad" />
              <Row label="Thuế TNCN" value={`−${money(current.tax_amount)}`} tone="bad" />
              {current.other_deduction ? <Row label="Khấu trừ khác" value={`−${money(current.other_deduction)}`} tone="bad" /> : null}
            </section>
          ) : (
            <p className="text-center text-[12px] text-muted-foreground">Chi tiết hiện sau khi bạn chạm để xem số tiền.</p>
          )}
          <div className="space-y-2">
            {items.map((item) => {
              const itemPeriod = periodById.get(item.period_id);
              const active = item.period_id === current.period_id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelected(item.period_id);
                    setRevealed(false);
                  }}
                  className={`flex min-h-12 w-full items-center justify-between rounded-2xl px-3 text-left ${active ? "bg-primary-subtle" : "bg-card shadow-mobile"}`}
                >
                  <span className="text-[13px] font-bold">
                    Tháng {itemPeriod ? `${itemPeriod.month}/${itemPeriod.year}` : ""}
                  </span>
                  <Badge variant={itemPeriod?.status === "paid" ? "success" : itemPeriod?.status === "locked" ? "info" : "muted"}>
                    {itemPeriod ? PAYROLL_STATUS_LABELS[itemPeriod.status] : "Kỳ lương"}
                  </Badge>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
      {blocked ? null : null}
    </AppShell>
  );
};

const Row = ({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-bold tabular ${tone === "ok" ? "text-success" : tone === "bad" ? "text-destructive" : ""}`}>{value}</span>
  </div>
);

export default EmployeePayslip;
