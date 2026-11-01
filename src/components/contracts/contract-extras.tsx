import { confirmDialog } from "@/components/common/confirm-dialog";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, FileDown, FileText, Info, Loader2, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { FieldDialog, type FieldDef } from "@/components/employee/field-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  APPENDIX_TYPE_LABELS,
  getEmployee,
  toOptions,
  type ContractAppendixRecord,
} from "@/lib/employee-records";
import {
  buildContractVars,
  contractLegalWarnings,
  createContractAppendix,
  deleteContractAppendix,
  downloadContractWord,
  listContractAppendices,
  listContractTemplates,
  pickTemplate,
  printContractPdf,
  renderContractTemplate,
  type ContractLike,
} from "@/lib/contract-docs";
import { getErrorMessage } from "@/lib/utils";

const money = (value: number | null) =>
  value === null || value === undefined ? null : `${new Intl.NumberFormat("vi-VN").format(Number(value))} đ`;
const day = (value: string | null) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");

type ContractRow = ContractLike & { id: string; status: string; employee_id: string; company_id: string };

/** Cảnh báo pháp lý (chỉ gợi ý, không chặn). */
export const ContractLegalWarnings = ({ contract, history }: { contract: ContractRow; history: ContractRow[] }) => {
  const warnings = contractLegalWarnings(contract, history);
  if (warnings.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {warnings.map((warning) => (
        <li
          key={warning.text}
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[11.5px] leading-5 ${
            warning.tone === "danger"
              ? "border-destructive/25 bg-destructive-subtle text-destructive"
              : warning.tone === "warning"
                ? "border-warning/30 bg-warning-subtle text-warning"
                : "border-border bg-muted/30 text-muted-foreground"
          }`}
        >
          {warning.tone === "info" ? (
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          {warning.text}
        </li>
      ))}
    </ul>
  );
};

/** Xuất Word / PDF từ mẫu (Cài đặt → Mẫu hợp đồng), tự điền dữ liệu hồ sơ. */
export const exportContract = async (contract: ContractRow, companyName: string, kind: "word" | "pdf") => {
  const [employee, templates] = await Promise.all([
    getEmployee(contract.employee_id),
    listContractTemplates(contract.company_id).catch(() => []),
  ]);
  const html = renderContractTemplate(
    pickTemplate(templates, contract.contract_type),
    buildContractVars(contract, employee, companyName),
  );
  const title = `HDLD ${contract.contract_no ?? ""} ${employee?.full_name ?? ""}`.trim();
  if (kind === "word") downloadContractWord(title, html);
  else printContractPdf(title, html);
};

/** Dùng cho menu "…": xuất + báo lỗi bằng toast. */
export const runContractExport = (contract: ContractRow, companyName: string, kind: "word" | "pdf") =>
  exportContract(contract, companyName, kind).catch((error: unknown) =>
    toast.error("Không xuất được hợp đồng", { description: getErrorMessage(error) }),
  );

export const ContractExportButtons = ({ contract, companyName }: { contract: ContractRow; companyName: string }) => {
  const [busy, setBusy] = useState<"word" | "pdf" | null>(null);
  const run = async (kind: "word" | "pdf") => {
    setBusy(kind);
    try {
      await exportContract(contract, companyName, kind);
    } catch (error) {
      toast.error("Không xuất được hợp đồng", { description: getErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" className="h-9 gap-1.5 text-[12px]" disabled={!!busy} onClick={() => void run("word")}>
        {busy === "word" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
        Xuất Word
      </Button>
      <Button variant="outline" className="h-9 gap-1.5 text-[12px]" disabled={!!busy} onClick={() => void run("pdf")}>
        {busy === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
        In / PDF
      </Button>
    </div>
  );
};

const appendixFields: FieldDef[] = [
  { name: "appendix_no", label: "Số phụ lục", placeholder: "PL-01" },
  { name: "change_type", label: "Nội dung thay đổi", type: "select", options: toOptions(APPENDIX_TYPE_LABELS), required: true },
  { name: "effective_date", label: "Ngày hiệu lực", type: "date", required: true },
  { name: "base_salary", label: "Lương cơ bản mới", type: "currency" },
  { name: "insurance_salary", label: "Lương đóng BHXH mới", type: "currency" },
  { name: "allowance", label: "Phụ cấp mới", type: "currency" },
  { name: "position", label: "Chức danh mới" },
  { name: "department", label: "Phòng ban mới" },
  { name: "work_location", label: "Địa điểm làm việc mới" },
  { name: "content", label: "Nội dung chi tiết", type: "textarea", span: 2 },
];

/** Lịch sử phụ lục hợp đồng (tăng lương, đổi chức danh…). */
export const ContractAppendicesPanel = ({
  contract,
  canManage,
  onChanged,
}: {
  contract: ContractRow;
  canManage: boolean;
  onChanged?: () => void;
}) => {
  const [rows, setRows] = useState<ContractAppendixRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listContractAppendices(contract.id));
    } catch (error) {
      toast.error("Không tải được phụ lục", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [contract.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (row: ContractAppendixRecord) => {
    if (!(await confirmDialog(`Xoá phụ lục ${row.appendix_no ?? ""}?`))) return;
    try {
      await deleteContractAppendix(row.id);
      toast.success("Đã xoá phụ lục");
      await load();
      onChanged?.();
    } catch (error) {
      toast.error("Không xoá được", { description: getErrorMessage(error) });
    }
  };

  return (
    <div className="rounded-lg border border-border px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Phụ lục hợp đồng</p>
        {canManage && (
          <Button variant="ghost" className="h-8 gap-1 px-2 text-[11.5px]" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Thêm phụ lục
          </Button>
        )}
      </div>
      {loading ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Đang tải…
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">Chưa có phụ lục.</p>
      ) : (
        <ul className="mt-1.5 divide-y divide-border/60">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start gap-2 py-2">
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1 text-[11.5px]">
                <p className="font-medium text-foreground">
                  {row.appendix_no ? `${row.appendix_no} · ` : ""}
                  {APPENDIX_TYPE_LABELS[row.change_type] ?? row.change_type}
                  <Badge variant="subtle" className="ml-1.5">
                    Hiệu lực {day(row.effective_date)}
                  </Badge>
                </p>
                <p className="text-muted-foreground">
                  {[
                    money(row.base_salary) && `Lương ${money(row.base_salary)}`,
                    money(row.insurance_salary) && `Lương BH ${money(row.insurance_salary)}`,
                    money(row.allowance) && `Phụ cấp ${money(row.allowance)}`,
                    row.position && `Chức danh: ${row.position}`,
                    row.department && `Phòng ban: ${row.department}`,
                    row.work_location && `Địa điểm: ${row.work_location}`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || row.content || "—"}
                </p>
              </div>
              {canManage && (
                <Button variant="ghost" size="icon-sm" aria-label="Xoá phụ lục" onClick={() => void remove(row)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <FieldDialog
        open={open}
        onOpenChange={setOpen}
        title="Thêm phụ lục hợp đồng"
        description="Phụ lục lưu lịch sử thay đổi; điều chỉnh bảng lương/hồ sơ thực hiện ở tab tương ứng."
        fields={appendixFields}
        initial={{ change_type: "salary", effective_date: new Date().toISOString().slice(0, 10) }}
        submitLabel="Lưu phụ lục"
        onSubmit={async (values) => {
          if (contract.start_date && values.effective_date && String(values.effective_date) < contract.start_date)
            throw new Error("Ngày hiệu lực phụ lục phải sau ngày bắt đầu hợp đồng.");
          await createContractAppendix({ ...values, contract_id: contract.id });
          toast.success("Đã thêm phụ lục");
          await load();
          onChanged?.();
        }}
      />
    </div>
  );
};

/** Nút gọn cho từng dòng hợp đồng (hồ sơ 360°): Word · PDF · Phụ lục. */
export const ContractRowDocActions = ({
  contract,
  companyName,
  canManage,
}: {
  contract: ContractRow;
  companyName: string;
  canManage: boolean;
}) => {
  const [busy, setBusy] = useState<"word" | "pdf" | null>(null);
  const [appendixOpen, setAppendixOpen] = useState(false);
  const run = async (kind: "word" | "pdf") => {
    setBusy(kind);
    await runContractExport(contract, companyName, kind);
    setBusy(null);
  };
  return (
    <div className="flex flex-wrap justify-end gap-1" onClick={(event) => event.stopPropagation()}>
      <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-[11.5px]" disabled={!!busy} onClick={() => void run("word")} title="Xuất Word">
        {busy === "word" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
        Word
      </Button>
      <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-[11.5px]" disabled={!!busy} onClick={() => void run("pdf")} title="In / PDF">
        {busy === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
        PDF
      </Button>
      <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-[11.5px]" onClick={() => setAppendixOpen(true)} title="Phụ lục hợp đồng">
        <FileText className="h-3.5 w-3.5" />
        Phụ lục
      </Button>
      <Dialog open={appendixOpen} onOpenChange={setAppendixOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Phụ lục hợp đồng {contract.contract_no ?? ""}</DialogTitle>
          </DialogHeader>
          {appendixOpen && <ContractAppendicesPanel contract={contract} canManage={canManage} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};
