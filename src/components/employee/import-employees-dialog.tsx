import { getErrorMessage } from "@/lib/utils";
import { readXlsxFirstSheet } from "@/lib/xlsx-reader";
import { useState } from "react";
import { AccountResultsView } from "@/components/employee/account-dialog";
import { MAX_ACCOUNT_ROWS, createEmployeeAccounts, type AccountResult } from "@/lib/employee-accounts";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  downloadEmployeeTemplate,
  importEmployees,
  parseEmployeeFile,
  parseEmployeeTable,
  type EmployeeImportRow,
  type ImportResult,
} from "@/lib/employee-import";

interface ImportEmployeesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onImported: () => void | Promise<void>;
}

export const ImportEmployeesDialog = ({
  open,
  onOpenChange,
  companyId,
  onImported,
}: ImportEmployeesDialogProps) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<EmployeeImportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [accounts, setAccounts] = useState<AccountResult[]>([]);

  const reset = () => {
    setFileName(null);
    setRows([]);
    setError(null);
    setResult(null);
    setAccounts([]);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    setAccounts([]);
    setError(null);

    const lower = file.name.toLowerCase();
    const isXlsx = lower.endsWith(".xlsx");
    if (!lower.endsWith(".csv") && !isXlsx) {
      setError("Chỉ hỗ trợ tệp .xlsx hoặc .csv. Hãy tải file mẫu, điền dữ liệu rồi lưu lại.");
      setRows([]);
      setFileName(file.name);
      return;
    }

    let parsed: ReturnType<typeof parseEmployeeFile>;
    try {
      parsed = isXlsx
        ? parseEmployeeTable(await readXlsxFirstSheet(await file.arrayBuffer()))
        : parseEmployeeFile(await file.text());
    } catch (readError) {
      setError(getErrorMessage(readError));
      setRows([]);
      setFileName(file.name);
      return;
    }
    setFileName(file.name);
    setRows(parsed.rows);
    setError(parsed.error);
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const outcome = await importEmployees(companyId, rows);
      setResult(outcome);
      // Hồ sơ có email → tự tạo tài khoản đăng nhập (quyền Nhân viên) + gửi mail tai_khoan_moi.
      const ids = outcome.createdIds ?? [];
      if (ids.length > 0) {
        const all: AccountResult[] = [];
        // Gửi từng lô nhỏ (server xử lý song song 5 luồng) để hiện tiến độ i/N.
        const step = Math.min(10, MAX_ACCOUNT_ROWS);
        for (let i = 0; i < ids.length; i += step) {
          setProgress(`Đang tạo tài khoản ${Math.min(i + step, ids.length)}/${ids.length}…`);
          const chunk = ids.slice(i, i + step).map((id) => ({ key: id, employee_id: id, role: "employee" }));
          all.push(...(await createEmployeeAccounts(companyId, chunk).catch((e: unknown): AccountResult[] =>
            chunk.map((c) => ({ key: c.key, employee_id: c.key, full_name: "", email: "", result: "error" as const,
              message: e instanceof Error ? e.message : "Lỗi tạo tài khoản." })))));
        }
        setProgress(null);
        setAccounts(all);
      }
      if (outcome.created > 0) {
        toast.success(`Đã import ${outcome.created} nhân sự`, {
          description:
            outcome.errors.length > 0
              ? `${outcome.errors.length} dòng bị bỏ qua.`
              : undefined,
        });
        await onImported();
      } else {
        toast.error("Không import được dòng nào", {
          description: "Xem chi tiết lỗi trong hộp thoại.",
        });
      }
    } catch (importError) {
      setProgress(null);
      setError(
        importError instanceof Error
          ? importError.message
          : "Không import được dữ liệu.",
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Import danh sách nhân sự
          </DialogTitle>
          <DialogDescription>
            Tải file mẫu, điền dữ liệu (mỗi dòng một nhân sự) rồi tải lên. Hồ sơ
            tạo mới sẽ tự có bản ghi tiếp nhận trong quá trình công tác.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-[12px]"
              onClick={() => {
                downloadEmployeeTemplate();
                toast.success("Đã tải file mẫu", {
                  description: "Mở bằng Excel, điền dữ liệu và lưu dạng CSV.",
                });
              }}
            >
              <Download className="h-3.5 w-3.5" /> Tải file mẫu (CSV)
            </Button>

            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="hidden"
                onChange={(event) => {
                  void handleFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[12px] font-medium text-foreground shadow-xs transition-colors hover:border-primary/35 hover:bg-primary-subtle">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Chọn tệp Excel/CSV
              </span>
            </label>

            {fileName && (
              <span className="text-[11.5px] text-muted-foreground">
                {fileName}
              </span>
            )}
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive-subtle px-3 py-2 text-[11.5px] leading-5 text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          {rows.length > 0 && !result && (
            <div className="rounded-md border border-border">
              <div className="border-b border-border/70 bg-muted/40 px-3 py-2 text-[11.5px] font-medium text-foreground">
                Đọc được {rows.length} dòng — xem trước 5 dòng đầu
              </div>
              <ul className="divide-y divide-border/60">
                {rows.slice(0, 5).map((row, index) => (
                  <li
                    key={`${row.code}-${index}`}
                    className="flex items-center gap-2 px-3 py-2 text-[11.5px]"
                  >
                    <span className="w-5 shrink-0 text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="w-[92px] shrink-0 truncate font-mono text-[11px] text-muted-foreground">
                      {row.code || "—"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {row.full_name || "—"}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {row.department ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {accounts.length > 0 && (
            <div className="space-y-2">
              <p className="text-[13px] font-semibold">Tài khoản đăng nhập (email hồ sơ = tên đăng nhập)</p>
              <AccountResultsView
                results={accounts}
                onCleared={() => setAccounts((cur) => cur.map(({ temporary_password: _pw, ...rest }) => rest))}
              />
            </div>
          )}
          {result && (
            <div className="space-y-2">
              <p
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-[12px] font-medium ${
                  result.created > 0
                    ? "border border-success/25 bg-success-subtle text-success"
                    : "border border-destructive/25 bg-destructive-subtle text-destructive"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" /> Đã tạo {result.created} hồ
                sơ nhân sự
              </p>
              {result.errors.length > 0 && (
                <div className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2">
                  <p className="text-[11.5px] font-semibold text-warning">
                    {result.errors.length} dòng không import được
                  </p>
                  <ul className="mt-1 space-y-1 text-[11px] leading-5 text-warning/90">
                    {result.errors.slice(0, 8).map((item) => (
                      <li key={`${item.line}-${item.message}`}>
                        Dòng {item.line}: {item.message}
                      </li>
                    ))}
                    {result.errors.length > 8 && (
                      <li>… và {result.errors.length - 8} dòng khác</li>
                    )}
                  </ul>
                </div>
              )}
              {result.warnings.length > 0 && (
                <div className="rounded-md border border-border bg-muted/50 px-3 py-2">
                  <p className="text-[11.5px] font-semibold text-foreground">
                    {result.warnings.length} dòng không khớp sơ đồ tổ chức (vẫn
                    tạo, cần rà lại)
                  </p>
                  <ul className="mt-1 space-y-1 text-[11px] leading-5 text-muted-foreground">
                    {result.warnings.slice(0, 10).map((item) => (
                      <li key={`w-${item.line}-${item.message}`}>
                        Dòng {item.line}: {item.message}
                      </li>
                    ))}
                    {result.warnings.length > 10 && (
                      <li>… và {result.warnings.length - 10} dòng khác</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
            Cột bắt buộc: <strong>Mã nhân viên</strong>,{" "}
            <strong>Họ và tên</strong>. Ngày nhận dạng <code>YYYY-MM-DD</code>{" "}
            hoặc <code>DD/MM/YYYY</code>. Hệ thống tự bỏ qua dòng trùng mã,
            trùng email hoặc trùng số điện thoại.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            className="gap-2"
            onClick={() => void handleImport()}
            disabled={importing || rows.length === 0 || !!result}
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {importing ? progress ?? "Đang import…" : `Import ${rows.length || ""} nhân sự`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
