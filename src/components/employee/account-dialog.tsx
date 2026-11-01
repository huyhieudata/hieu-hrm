import { useEffect, useRef, useState } from "react";
import { Download, FileUp, KeyRound, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/common/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ACCOUNT_RESULT_META,
  MAX_ACCOUNT_ROWS,
  createEmployeeAccounts,
  downloadCredentialsCsv,
  readAccountFile,
  resetEmployeePassword,
  type AccountResult,
  type AccountRowInput,
} from "@/lib/employee-accounts";
import { getErrorMessage } from "@/lib/utils";

export type AccountTarget = { id: string; full_name: string; email: string | null; has_account?: boolean };

/** Bảng kết quả từng dòng + nút tải CSV mật khẩu tạm (một lần, chỉ khi gửi mail lỗi). */
export const AccountResultsView = ({ results, onCleared }: { results: AccountResult[]; onCleared: () => void }) => {
  const pending = results.filter((r) => r.temporary_password);
  const counts = results.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.result]: (acc[r.result] ?? 0) + 1 }), {});
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 text-[11.5px]">
        {Object.entries(counts).map(([k, n]) => (
          <Badge key={k} variant={ACCOUNT_RESULT_META[k as AccountResult["result"]].tone}>
            {ACCOUNT_RESULT_META[k as AccountResult["result"]].label}: {n}
          </Badge>
        ))}
      </div>
      {pending.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-[12px]">
          <p className="font-semibold">{pending.length} tài khoản chưa gửi được email.</p>
          <p className="mt-1 text-muted-foreground">
            Tải CSV tên đăng nhập + mật khẩu tạm để tự gửi cho nhân viên. Tệp chỉ tải được <b>một lần</b> trong phiên này; máy
            chủ không lưu mật khẩu. Nếu lỡ mất, dùng “Đặt lại mật khẩu và gửi lại”.
          </p>
          <Button
            size="sm"
            className="mt-2 gap-1.5"
            onClick={() => {
              downloadCredentialsCsv(results);
              onCleared();
            }}
          >
            <Download className="h-3.5 w-3.5" /> Tải CSV mật khẩu tạm
          </Button>
        </div>
      )}
      <div className="max-h-[320px] overflow-auto rounded-lg border">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-muted/60 text-left text-[11px] text-muted-foreground">
            <tr><th className="p-2">Nhân viên</th><th className="p-2">Tên đăng nhập</th><th className="p-2">Kết quả</th><th className="p-2">Ghi chú</th></tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.key} className="border-t">
                <td className="p-2">{r.full_name || "—"}</td>
                <td className="p-2 font-mono text-[11.5px]">{r.email || "—"}</td>
                <td className="p-2"><Badge variant={ACCOUNT_RESULT_META[r.result].tone}>{ACCOUNT_RESULT_META[r.result].label}</Badge></td>
                <td className="p-2 text-muted-foreground">{r.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/** Tạo tài khoản cho nhân viên đã chọn, hoặc nhập từ Excel/CSV (cột Email, Họ tên). */
export const CreateAccountsDialog = ({
  open,
  onOpenChange,
  companyId,
  targets = [],
  allowImport = false,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  targets?: AccountTarget[];
  allowImport?: boolean;
  onDone?: () => void;
}) => {
  const [fileRows, setFileRows] = useState<AccountRowInput[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<AccountResult[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      // Đóng hộp thoại ⇒ xoá kết quả (kể cả mật khẩu tạm) khỏi bộ nhớ.
      setResults(null);
      setFileRows(null);
    }
  }, [open]);

  const pendingTargets = targets.filter((t) => !t.has_account);
  const rows: AccountRowInput[] = fileRows ?? pendingTargets.map((t) => ({ key: t.id, employee_id: t.id }));

  const run = async () => {
    if (rows.length === 0) return;
    if (rows.length > MAX_ACCOUNT_ROWS) {
      toast.error(`Tối đa ${MAX_ACCOUNT_ROWS} nhân viên mỗi lần.`);
      return;
    }
    setBusy(true);
    try {
      const res = await createEmployeeAccounts(companyId, rows);
      setResults(res);
      const ok = res.filter((r) => r.result === "created" || r.result === "linked").length;
      toast.success(`Đã xử lý ${res.length} dòng · tạo/gắn ${ok}`);
      onDone?.();
    } catch (error) {
      toast.error("Không tạo được tài khoản", { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const hasPasswords = results?.some((r) => r.temporary_password);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && hasPasswords && !window.confirm("Còn mật khẩu tạm chưa tải CSV. Đóng sẽ mất mật khẩu này. Vẫn đóng?")) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tạo tài khoản đăng nhập</DialogTitle>
          <DialogDescription>
            Hệ thống tạo tài khoản bằng email trong hồ sơ, sinh mật khẩu tạm ngẫu nhiên và gửi email cho từng nhân viên.
            Nhân viên phải đổi mật khẩu ở lần đăng nhập đầu. Tối đa {MAX_ACCOUNT_ROWS} dòng mỗi lần.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <AccountResultsView
            results={results}
            onCleared={() => setResults((prev) => prev?.map(({ temporary_password: _pw, ...r }) => r) ?? null)}
          />
        ) : (
          <div className="space-y-3 text-[12.5px]">
            {allowImport && (
              <div className="rounded-lg border border-dashed p-3">
                <p className="font-medium">Nhập từ Excel/CSV</p>
                <p className="text-[11.5px] text-muted-foreground">
                  Dòng đầu là tiêu đề, cần cột <b>Email</b> (và <b>Họ tên</b>). Email trùng hồ sơ nhân viên sẽ được gắn tự động.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try {
                      setFileRows(await readAccountFile(file));
                    } catch (error) {
                      toast.error(getErrorMessage(error));
                    }
                  }}
                />
                <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => fileRef.current?.click()}>
                  <FileUp className="h-3.5 w-3.5" /> Chọn tệp .xlsx / .csv
                </Button>
              </div>
            )}
            {fileRows ? (
              <p>Đã đọc <b>{fileRows.length}</b> dòng từ tệp.{" "}
                <button type="button" className="text-primary underline" onClick={() => setFileRows(null)}>Bỏ tệp</button>
              </p>
            ) : targets.length > 0 ? (
              <p>
                Đã chọn <b>{targets.length}</b> nhân viên
                {targets.length - pendingTargets.length > 0 && <> · {targets.length - pendingTargets.length} người đã có tài khoản sẽ bỏ qua</>}
                {pendingTargets.some((t) => !t.email) && <> · có người chưa có email (sẽ báo lỗi dòng đó)</>}.
              </p>
            ) : !allowImport ? (
              <p className="text-muted-foreground">Chưa chọn nhân viên nào.</p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {results ? (
            <Button onClick={() => onOpenChange(false)} disabled={hasPasswords}>
              {hasPasswords ? "Hãy tải CSV trước" : "Xong"}
            </Button>
          ) : (
            <Button onClick={() => void run()} disabled={busy || rows.length === 0} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Tạo {rows.length} tài khoản
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Thanh trạng thái tài khoản trên hồ sơ nhân viên (owner/admin/HR). */
export const AccountStatusBar = ({
  companyId,
  employee,
  onChanged,
}: {
  companyId: string;
  employee: { id: string; full_name: string; user_id: string | null; work_email?: string | null; personal_email?: string | null };
  onChanged?: () => void;
}) => {
  const [createOpen, setCreateOpen] = useState(false);
  const [resetResults, setResetResults] = useState<AccountResult[] | null>(null);
  const email = employee.work_email || employee.personal_email || null;

  const reset = async () => {
    try {
      const res = await resetEmployeePassword(companyId, employee.id);
      const r = res[0];
      if (!r || r.result === "error") throw new Error(r?.message ?? "Không đặt lại được mật khẩu.");
      if (r.temporary_password) setResetResults(res);
      else toast.success("Đã đặt lại mật khẩu và gửi email cho nhân viên");
    } catch (error) {
      toast.error("Không đặt lại được mật khẩu", { description: getErrorMessage(error) });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-2 text-[11.5px]">
      {employee.user_id ? (
        <>
          <Badge variant="success">Đã có tài khoản</Badge>
          <ConfirmAction
            title="Đặt lại mật khẩu và gửi lại?"
            description={`Mật khẩu hiện tại của ${employee.full_name} sẽ không dùng được nữa. Hệ thống tạo mật khẩu tạm mới, gửi email và bắt đổi ở lần đăng nhập sau.`}
            confirmLabel="Đặt lại và gửi"
            onConfirm={reset}
          >
            <Button size="sm" variant="outline" className="h-7 gap-1 text-[11.5px]">
              <KeyRound className="h-3.5 w-3.5" /> Đặt lại mật khẩu và gửi lại
            </Button>
          </ConfirmAction>
        </>
      ) : (
        <>
          <Badge variant="muted">Chưa có tài khoản</Badge>
          <Button size="sm" className="h-7 gap-1 text-[11.5px]" onClick={() => setCreateOpen(true)} disabled={!email}>
            <UserPlus className="h-3.5 w-3.5" /> Tạo tài khoản
          </Button>
          {!email && <span className="text-muted-foreground">Cần nhập email trong hồ sơ trước.</span>}
        </>
      )}
      <CreateAccountsDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companyId={companyId}
        targets={[{ id: employee.id, full_name: employee.full_name, email }]}
        onDone={onChanged}
      />
      <Dialog open={!!resetResults} onOpenChange={(o) => {
        if (!o && resetResults?.some((r) => r.temporary_password) && !window.confirm("Chưa tải CSV mật khẩu tạm. Vẫn đóng?")) return;
        if (!o) setResetResults(null);
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Đã đặt lại mật khẩu — chưa gửi được email</DialogTitle></DialogHeader>
          {resetResults && (
            <AccountResultsView
              results={resetResults}
              onCleared={() => setResetResults((prev) => prev?.map(({ temporary_password: _pw, ...r }) => r) ?? null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
