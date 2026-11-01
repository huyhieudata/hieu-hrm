import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/lib/company-provider";
import {
  deletePayrollParameter,
  listPayrollParameters,
  savePayrollParameter,
  type PayrollParameter,
} from "@/lib/payroll";
import { getErrorMessage } from "@/lib/utils";

const vnd = (value: number) => `${new Intl.NumberFormat("vi-VN").format(Number(value))} đ`;

interface BracketDraft {
  up_to: string;
  rate: string;
}

interface Draft {
  id?: string;
  effective_date: string;
  personal_deduction: string;
  dependent_deduction: string;
  base_wage: string;
  insurance_cap_multiplier: string;
  employee_insurance_rate: string;
  insurance_unpaid_days_exempt: string;
  brackets: BracketDraft[];
  source: string;
  note: string;
}

const toDraft = (row: PayrollParameter, keepId: boolean): Draft => ({
  id: keepId ? row.id : undefined,
  effective_date: keepId ? row.effective_date : new Date().toISOString().slice(0, 10),
  personal_deduction: String(row.personal_deduction),
  dependent_deduction: String(row.dependent_deduction),
  base_wage: String(row.base_wage),
  insurance_cap_multiplier: String(row.insurance_cap_multiplier),
  employee_insurance_rate: String(Number(row.employee_insurance_rate) * 100),
  insurance_unpaid_days_exempt: String(row.insurance_unpaid_days_exempt),
  brackets: row.pit_brackets.map((b) => ({ up_to: b.up_to === null ? "" : String(b.up_to), rate: String(Number(b.rate) * 100) })),
  source: row.source ?? "",
  note: row.note ?? "",
});

const num = (value: string) => Number(value.replace(/[.\s]/g, "").replace(",", "."));

export default function PayrollParameters() {
  const { activeCompany, canManageModule } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("payroll");
  const [rows, setRows] = useState<PayrollParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setRows(await listPayrollParameters(companyId));
    } catch (error) {
      toast.error("Không tải được tham số lương", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!draft || !companyId) return;
    const brackets = draft.brackets.map((b, i) => ({
      up_to: i === draft.brackets.length - 1 ? null : num(b.up_to),
      rate: num(b.rate) / 100,
    }));
    if (!draft.effective_date) return toast.error("Chọn ngày hiệu lực.");
    if (brackets.some((b) => Number.isNaN(b.rate) || (b.up_to !== null && Number.isNaN(b.up_to)))) {
      return toast.error("Biểu thuế có ô chưa hợp lệ.");
    }
    setSaving(true);
    try {
      await savePayrollParameter(
        {
          company_id: companyId,
          effective_date: draft.effective_date,
          personal_deduction: num(draft.personal_deduction),
          dependent_deduction: num(draft.dependent_deduction),
          base_wage: num(draft.base_wage),
          insurance_cap_multiplier: num(draft.insurance_cap_multiplier),
          employee_insurance_rate: num(draft.employee_insurance_rate) / 100,
          insurance_unpaid_days_exempt: num(draft.insurance_unpaid_days_exempt),
          pit_brackets: brackets,
          source: draft.source || null,
          note: draft.note || null,
        },
        draft.id,
      );
      toast.success("Đã lưu tham số lương. Các kỳ lương nháp cần bấm tính lại.");
      setDraft(null);
      await load();
    } catch (error) {
      toast.error("Không lưu được", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: PayrollParameter) => {
    if (!window.confirm(`Xoá bộ tham số hiệu lực ${row.effective_date}?`)) return;
    try {
      await deletePayrollParameter(row.id);
      await load();
    } catch (error) {
      toast.error("Không xoá được", { description: getErrorMessage(error) });
    }
  };

  const latest = rows[rows.length - 1];
  const field = (key: keyof Draft, label: string, type = "text") => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type={type}
        value={draft ? String(draft[key] ?? "") : ""}
        onChange={(e) => setDraft((d) => (d ? { ...d, [key]: e.target.value } : d))}
      />
    </div>
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow="Tính lương"
        title="Tham số lương"
        description="Giảm trừ gia cảnh, biểu thuế TNCN, lương cơ sở và bảo hiểm theo ngày hiệu lực. Kỳ lương dùng bộ tham số mới nhất có hiệu lực từ ngày đầu kỳ; bộ của công ty được ưu tiên hơn mặc định hệ thống."
        actions={
          canManage && latest ? (
            <Button onClick={() => setDraft(toDraft(latest, false))}>
              <Plus className="mr-2 h-4 w-4" /> Thêm bộ tham số
            </Button>
          ) : undefined
        }
      />
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {[...rows].reverse().map((row) => (
            <Card key={row.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Hiệu lực từ {row.effective_date.split("-").reverse().join("/")}</span>
                <Badge variant={row.company_id ? "default" : "secondary"}>{row.company_id ? "Riêng công ty" : "Mặc định hệ thống"}</Badge>
                {row.company_id && canManage && (
                  <div className="ml-auto flex gap-1">
                    <Button size="icon" variant="ghost" aria-label="Sửa" onClick={() => setDraft(toDraft(row, true))}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Xoá" onClick={() => void remove(row)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                <span>Giảm trừ bản thân: {vnd(row.personal_deduction)}</span>
                <span>Giảm trừ người phụ thuộc: {vnd(row.dependent_deduction)}</span>
                <span>Lương cơ sở: {vnd(row.base_wage)}</span>
                <span>Trần BH: {row.insurance_cap_multiplier} × lương cơ sở = {vnd(row.insurance_cap_multiplier * row.base_wage)}</span>
                <span>BH người lao động: {(Number(row.employee_insurance_rate) * 100).toLocaleString("vi-VN")}%</span>
                <span>Miễn BH khi nghỉ không lương ≥ {row.insurance_unpaid_days_exempt} ngày</span>
              </div>
              <div className="mt-2 text-sm">
                Biểu thuế:{" "}
                {row.pit_brackets
                  .map((b) => `${b.up_to === null ? "phần còn lại" : `đến ${vnd(b.up_to)}`}: ${(Number(b.rate) * 100).toLocaleString("vi-VN")}%`)
                  .join(" · ")}
              </div>
              {(row.source || row.note) && (
                <div className="mt-1 text-xs text-muted-foreground">{[row.source, row.note].filter(Boolean).join(" — ")}</div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Sửa bộ tham số" : "Thêm bộ tham số"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {field("effective_date", "Hiệu lực từ ngày", "date")}
                {field("base_wage", "Lương cơ sở (đ)")}
                {field("personal_deduction", "Giảm trừ bản thân (đ/tháng)")}
                {field("dependent_deduction", "Giảm trừ mỗi người phụ thuộc (đ/tháng)")}
                {field("employee_insurance_rate", "Tỷ lệ BH người lao động (%)")}
                {field("insurance_cap_multiplier", "Trần BH (số lần lương cơ sở)")}
                {field("insurance_unpaid_days_exempt", "Miễn BH khi nghỉ không lương từ (ngày)")}
                {field("source", "Căn cứ pháp lý")}
              </div>
              <div className="space-y-2">
                <Label>Biểu thuế TNCN lũy tiến (tháng)</Label>
                {draft.brackets.map((b, i) => {
                  const last = i === draft.brackets.length - 1;
                  const set = (patch: Partial<BracketDraft>) =>
                    setDraft((d) => (d ? { ...d, brackets: d.brackets.map((x, j) => (j === i ? { ...x, ...patch } : x)) } : d));
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-14 text-sm">Bậc {i + 1}</span>
                      <Input
                        placeholder={last ? "Phần còn lại" : "Đến (đ)"}
                        disabled={last}
                        value={last ? "" : b.up_to}
                        onChange={(e) => set({ up_to: e.target.value })}
                      />
                      <Input className="w-24" placeholder="%" value={b.rate} onChange={(e) => set({ rate: e.target.value })} />
                      <span className="text-sm">%</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Xoá bậc"
                        disabled={draft.brackets.length <= 1}
                        onClick={() => setDraft((d) => (d ? { ...d, brackets: d.brackets.filter((_, j) => j !== i) } : d))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDraft((d) =>
                      d ? { ...d, brackets: [...d.brackets.slice(0, -1), { up_to: "", rate: "" }, ...d.brackets.slice(-1)] } : d,
                    )
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> Thêm bậc
                </Button>
              </div>
              <div className="space-y-1">
                <Label>Ghi chú</Label>
                <Textarea value={draft.note} onChange={(e) => setDraft((d) => (d ? { ...d, note: e.target.value } : d))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Huỷ
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
