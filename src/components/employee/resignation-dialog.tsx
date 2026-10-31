import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CalendarClock, DoorOpen, Laptop, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { currency } from "@/lib/format";
import {
  ASSET_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  createRecord,
  debtOutstanding,
  fetchRecords,
  formatDate,
  updateEmployee,
  type AssetRecord,
  type ContractRecord,
  type DebtRecord,
  type EmployeeRecord,
} from "@/lib/employee-records";

const RESIGNATION_REASONS = [
  "Nguyện vọng cá nhân",
  "Chuyển công tác / nơi ở",
  "Hết hạn hợp đồng",
  "Sức khoẻ",
  "Không phù hợp công việc",
  "Vi phạm kỷ luật",
  "Khác",
];

const today = () => new Date().toISOString().slice(0, 10);

const contractState = (contract: ContractRecord) => {
  if (contract.status !== "active") {
    return { label: "Đã chấm dứt", tone: "muted" as const };
  }
  if (!contract.end_date) {
    return { label: "Không thời hạn", tone: "info" as const };
  }
  const days = Math.ceil((new Date(contract.end_date).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `Hết hạn ${Math.abs(days)} ngày trước`, tone: "destructive" as const };
  if (days <= 30) return { label: `Sắp hết hạn · còn ${days} ngày`, tone: "warning" as const };
  return { label: `Còn ${days} ngày`, tone: "success" as const };
};

interface ResignationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeRecord;
  onDone: () => void | Promise<void>;
  /** Sends the user to the Assets tab so they can return the equipment first. */
  onRequestAssetReturn: () => void;
  /** Sends the user to the Debts tab so they can settle outstanding balances. */
  onRequestDebtSettle: () => void;
}

export const ResignationDialog = ({
  open,
  onOpenChange,
  employee,
  onDone,
  onRequestAssetReturn,
  onRequestDebtSettle,
}: ResignationDialogProps) => {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [reason, setReason] = useState(RESIGNATION_REASONS[0]);
  const [resignDate, setResignDate] = useState(today());
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assetRows, contractRows, debtRows] = await Promise.all([
        fetchRecords<AssetRecord>("employee_assets", employee.id, "assigned_date"),
        fetchRecords<ContractRecord>("employee_contracts", employee.id, "start_date"),
        fetchRecords<DebtRecord>("employee_debts", employee.id, "due_date"),
      ]);
      setAssets(assetRows.filter((asset) => asset.status !== "returned"));
      setContracts(contractRows);
      setDebts(debtRows.filter((debt) => debt.status === "open" && debtOutstanding(debt) > 0));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không tải được dữ liệu bàn giao.");
    } finally {
      setLoading(false);
    }
  }, [employee.id]);

  useEffect(() => {
    if (!open) return;
    setReason(RESIGNATION_REASONS[0]);
    setResignDate(today());
    setNote("");
    void load();
  }, [load, open]);

  const totalAssetValue = useMemo(
    () => assets.reduce((sum, asset) => sum + Number(asset.value ?? 0), 0),
    [assets],
  );

  const activeContracts = useMemo(
    () => contracts.filter((contract) => contract.status === "active"),
    [contracts],
  );

  const totalDebt = useMemo(
    () => debts.reduce((sum, debt) => sum + debtOutstanding(debt), 0),
    [debts],
  );

  const blocked = assets.length > 0 || debts.length > 0;

  const handleSubmit = async () => {
    if (blocked) {
      const reasons = [
        assets.length > 0 ? `${assets.length} tài sản chưa thu hồi` : null,
        debts.length > 0 ? `công nợ ${currency(totalDebt)} chưa tất toán` : null,
      ]
        .filter(Boolean)
        .join(" và ");
      setError(
        `Từ chối nghỉ việc: ${employee.full_name} còn ${reasons}. Hãy xử lý xong rồi quay lại đóng hồ sơ.`,
      );
      return;
    }

    if (!resignDate) {
      setError("Vui lòng chọn ngày nghỉ việc.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createRecord("employee_work_history", {
        employee_id: employee.id,
        event_type: "resignation",
        title: `Nghỉ việc – ${reason}`,
        department: employee.department,
        position: employee.position,
        location: employee.work_location,
        start_date: resignDate,
        note: note.trim() || `Lý do nghỉ việc: ${reason}`,
      });

      await updateEmployee(employee.id, { resignation_reason: reason });

      toast.success("Đã ghi nhận nghỉ việc", {
        description: [
          `${employee.full_name} nghỉ từ ${formatDate(resignDate)}.`,
          activeContracts.length > 0 ? `${activeContracts.length} hợp đồng đã chấm dứt.` : "Không có hợp đồng hiệu lực.",
        ].join(" "),
      });

      await onDone();
      onOpenChange(false);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Không ghi nhận được nghỉ việc.";
      setError(
        message.includes("tài sản chưa thu hồi")
          ? `${message} Hãy thu hồi tài sản trong tab Tài sản rồi quay lại.`
          : message.includes("row-level security")
            ? "Bạn không có quyền ghi nhận nghỉ việc cho nhân viên này."
            : message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[660px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DoorOpen className="h-4 w-4 text-warning" />
            Đóng hồ sơ — {employee.full_name}
          </DialogTitle>
          <DialogDescription>
            Kiểm tra hợp đồng và tài sản bàn giao. Chỉ có thể xác nhận nghỉ việc khi toàn bộ tài sản đã được
            thu hồi.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải hợp đồng và tài sản…
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {blocked && (
              <div className="rounded-md border border-destructive/30 bg-destructive-subtle px-3.5 py-3">
                <p className="flex items-start gap-2 text-[12px] font-semibold leading-5 text-destructive">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  Không thể nghỉ việc: còn{" "}
                  {[
                    assets.length > 0 ? `${assets.length} tài sản chưa thu hồi` : null,
                    debts.length > 0 ? `công nợ ${currency(totalDebt)} chưa tất toán` : null,
                  ]
                    .filter(Boolean)
                    .join(" và ")}
                </p>
                <p className="mt-1 pl-6 text-[11.5px] leading-5 text-destructive/90">
                  Hãy thu hồi tài sản và tất toán công nợ, sau đó quay lại đây để đóng hồ sơ nhân sự.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2 pl-6">
                  {assets.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 border-destructive/30 bg-card text-[11.5px] text-destructive hover:bg-destructive-subtle"
                      onClick={() => {
                        onOpenChange(false);
                        onRequestAssetReturn();
                      }}
                    >
                      <Laptop className="h-3.5 w-3.5" /> Tới tab Tài sản
                    </Button>
                  )}
                  {debts.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 border-destructive/30 bg-card text-[11.5px] text-destructive hover:bg-destructive-subtle"
                      onClick={() => {
                        onOpenChange(false);
                        onRequestDebtSettle();
                      }}
                    >
                      <Banknote className="h-3.5 w-3.5" /> Tới tab Công nợ
                    </Button>
                  )}
                </div>
              </div>
            )}

            <section>
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                  Hợp đồng lao động
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  {activeContracts.length} đang hiệu lực / {contracts.length} hợp đồng
                </span>
              </div>
              {contracts.length === 0 ? (
                <p className="mt-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2.5 text-[11.5px] text-muted-foreground">
                  Nhân sự chưa có hợp đồng nào trong hồ sơ.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-border/60 rounded-md border border-border">
                  {contracts.map((contract) => {
                    const state = contractState(contract);
                    return (
                      <li key={contract.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium text-foreground">
                            {contract.contract_no ?? "Hợp đồng"} ·{" "}
                            {CONTRACT_TYPE_LABELS[contract.contract_type] ?? contract.contract_type}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDate(contract.start_date)} →{" "}
                            {contract.end_date ? formatDate(contract.end_date) : "không thời hạn"}
                          </p>
                        </div>
                        <Badge variant={state.tone}>{state.label}</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                  <Laptop className="h-3.5 w-3.5 text-muted-foreground" />
                  Tài sản chưa thu hồi
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  {assets.length} tài sản · {currency(totalAssetValue, true)}
                </span>
              </div>
              {assets.length === 0 ? (
                <p className="mt-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2.5 text-[11.5px] text-muted-foreground">
                  Đã thu hồi toàn bộ tài sản — có thể đóng hồ sơ nhân sự.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-border/60 rounded-md border border-border">
                  {assets.map((asset) => (
                    <li key={asset.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-foreground">
                          {asset.name}
                          {asset.asset_code ? ` · ${asset.asset_code}` : ""}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Bàn giao {formatDate(asset.assigned_date)}
                          {asset.serial_number ? ` · SN ${asset.serial_number}` : ""}
                        </p>
                      </div>
                      <Badge
                        variant={
                          asset.status === "lost"
                            ? "destructive"
                            : asset.status === "damaged"
                              ? "warning"
                              : "info"
                        }
                      >
                        {ASSET_STATUS_LABELS[asset.status] ?? asset.status}
                      </Badge>
                      <span className="w-[72px] shrink-0 text-right text-[11.5px] text-muted-foreground">
                        {asset.value ? currency(Number(asset.value), true) : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                  <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                  Công nợ chưa tất toán
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  {debts.length} khoản · {currency(totalDebt)}
                </span>
              </div>
              {debts.length === 0 ? (
                <p className="mt-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2.5 text-[11.5px] text-muted-foreground">
                  Không còn công nợ — nhân sự đã tất toán đầy đủ.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-border/60 rounded-md border border-border">
                  {debts.map((debt) => (
                    <li key={debt.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-foreground">{debt.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {debt.due_date ? `Hạn tất toán ${formatDate(debt.due_date)}` : "Không đặt hạn"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[12px] font-semibold text-warning">
                        {currency(debtOutstanding(debt))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[12px]">
                  Lý do nghỉ việc <span className="text-destructive">*</span>
                </Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESIGNATION_REASONS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="resign-date" className="text-[12px]">
                  Ngày nghỉ việc <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="resign-date"
                  type="date"
                  value={resignDate}
                  onChange={(event) => setResignDate(event.target.value)}
                  className="h-10"
                />
                <p className="text-[10.5px] leading-4 text-muted-foreground">
                  Ngày sẽ tự khớp với ngày kết thúc của mốc công tác trước đó nếu đã có.
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="resign-note" className="text-[12px]">
                  Ghi chú bàn giao
                </Label>
                <Textarea
                  id="resign-note"
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ví dụ: bàn giao tài liệu dự án cho Trần Quốc Bảo trước ngày nghỉ."
                  className="text-[13px]"
                />
              </div>
            </section>

            {error && (
              <p className="rounded-md border border-destructive/25 bg-destructive-subtle px-3 py-2 text-[11.5px] leading-5 text-destructive">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button
            className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={loading || submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
            {submitting ? "Đang xử lý…" : "Hoàn tất thủ tục nghỉ việc"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
