import { useCallback, useEffect, useState } from "react";
import { Check, History, Loader2, Send, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { FieldDialog, type FieldDef } from "@/components/employee/field-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EmployeeRecord } from "@/lib/employee-records";
import {
  FIELD_LABEL,
  SELF_EDITABLE_FIELDS,
  cancelChangeRequest,
  listChangeRequests,
  listSensitiveAudit,
  reviewChangeRequest,
  submitChangeRequest,
  type ChangeRequest,
  type SensitiveAuditRow,
} from "@/lib/change-requests";
import { getErrorMessage } from "@/lib/utils";

const when = (value: string) =>
  new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

const STATUS: Record<ChangeRequest["status"], { label: string; variant: "warning" | "success" | "destructive" | "muted" }> = {
  pending: { label: "Chờ HR duyệt", variant: "warning" },
  approved: { label: "Đã duyệt", variant: "success" },
  rejected: { label: "Từ chối", variant: "destructive" },
  cancelled: { label: "Đã huỷ", variant: "muted" },
};

const ChangeList = ({ changes }: { changes: Record<string, string | null> }) => (
  <ul className="mt-1 space-y-0.5 text-[12px]">
    {Object.entries(changes).map(([key, value]) => (
      <li key={key}>
        <span className="text-muted-foreground">{FIELD_LABEL[key] ?? key}:</span>{" "}
        <span className="font-medium text-foreground">{value || "(xoá)"}</span>
      </li>
    ))}
  </ul>
);

/** Nhân viên tự đề nghị cập nhật liên hệ / khẩn cấp / ngân hàng; HR duyệt mới áp dụng. */
export const SelfChangeRequestCard = ({ companyId, employee }: { companyId: string; employee: EmployeeRecord }) => {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    try {
      setRequests(await listChangeRequests(companyId, { employeeId: employee.id }));
    } catch {
      setRequests([]);
    }
  }, [companyId, employee.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const pending = requests.find((r) => r.status === "pending");
  const latest = requests[0];
  const fields: FieldDef[] = [
    ...SELF_EDITABLE_FIELDS.map((f) => ({ ...f, span: f.type === "textarea" ? (2 as const) : undefined })),
    { name: "__note", label: "Ghi chú cho HR", type: "textarea" as const, span: 2 as const },
  ];
  const record = employee as unknown as Record<string, string | null>;

  return (
    <section className="shadow-mobile mt-3 rounded-3xl bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold">Cập nhật thông tin</p>
        {latest && <Badge variant={STATUS[latest.status].variant}>{STATUS[latest.status].label}</Badge>}
      </div>
      {pending ? (
        <>
          <ChangeList changes={pending.changes} />
          <Button
            variant="outline"
            className="mt-2 h-11 w-full"
            onClick={async () => {
              try {
                await cancelChangeRequest(pending.id);
                toast.success("Đã huỷ đề nghị");
                await load();
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            }}
          >
            Huỷ đề nghị
          </Button>
        </>
      ) : (
        <>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Đổi số điện thoại, địa chỉ, liên hệ khẩn cấp hoặc tài khoản ngân hàng. HR duyệt xong mới cập nhật vào hồ sơ.
          </p>
          {latest?.status === "rejected" && latest.review_note && (
            <p className="mt-1 text-[12px] text-destructive">HR: {latest.review_note}</p>
          )}
          <Button className="mt-2 h-11 w-full gap-1.5" onClick={() => setOpen(true)}>
            <Send className="h-4 w-4" /> Đề nghị cập nhật
          </Button>
        </>
      )}
      <FieldDialog
        open={open}
        onOpenChange={setOpen}
        title="Đề nghị cập nhật hồ sơ"
        description="Chỉ gửi các ô bạn thay đổi."
        fields={fields}
        initial={Object.fromEntries(SELF_EDITABLE_FIELDS.map((f) => [f.name, record[f.name] ?? ""]))}
        submitLabel="Gửi HR"
        onSubmit={async (values) => {
          const changes: Record<string, string | null> = {};
          for (const f of SELF_EDITABLE_FIELDS) {
            const next = values[f.name] === null ? null : String(values[f.name]);
            if ((next ?? "") !== (record[f.name] ?? "")) changes[f.name] = next;
          }
          if (Object.keys(changes).length === 0) throw new Error("Bạn chưa thay đổi ô nào.");
          await submitChangeRequest(companyId, changes, values.__note ? String(values.__note) : undefined);
          toast.success("Đã gửi đề nghị cho HR");
          await load();
        }}
      />
    </section>
  );
};

/** HR duyệt đề nghị cập nhật hồ sơ (toàn công ty hoặc 1 nhân viên). */
export const ChangeRequestsReview = ({
  companyId,
  employeeId,
  onApplied,
}: {
  companyId: string;
  employeeId?: string;
  onApplied?: () => void | Promise<void>;
}) => {
  const [rows, setRows] = useState<ChangeRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setRows(await listChangeRequests(companyId, { employeeId, pendingOnly: true }));
    } catch {
      setRows([]);
    }
  }, [companyId, employeeId]);
  useEffect(() => {
    void load();
  }, [load]);

  if (rows.length === 0) return null;

  const act = async (row: ChangeRequest, approve: boolean) => {
    const note = approve ? undefined : (window.prompt("Lý do từ chối (không bắt buộc)") ?? undefined);
    setBusy(row.id);
    try {
      await reviewChangeRequest(row.id, approve, note);
      toast.success(approve ? "Đã duyệt và cập nhật hồ sơ" : "Đã từ chối đề nghị");
      await load();
      await onApplied?.();
    } catch (error) {
      toast.error("Không xử lý được", { description: getErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-warning/30 p-4">
      <p className="flex items-center gap-2 text-[13px] font-semibold">
        <ShieldCheck className="h-4 w-4 text-warning" /> Đề nghị cập nhật hồ sơ chờ duyệt ({rows.length})
      </p>
      <ul className="mt-2 divide-y divide-border/60">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              {!employeeId && (
                <p className="text-[12.5px] font-semibold">
                  {row.employees?.full_name ?? "Nhân viên"} · {row.employees?.code ?? ""}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">Gửi lúc {when(row.created_at)}</p>
              <ChangeList changes={row.changes} />
              {row.note && <p className="mt-1 text-[11.5px] italic text-muted-foreground">“{row.note}”</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" className="h-9 gap-1" disabled={busy === row.id} onClick={() => void act(row, false)}>
                <X className="h-3.5 w-3.5" /> Từ chối
              </Button>
              <Button className="h-9 gap-1" disabled={busy === row.id} onClick={() => void act(row, true)}>
                {busy === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Duyệt
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
};

/** Nhật ký sửa trường nhạy cảm (chỉ tên trường, không lưu giá trị). */
export const SensitiveAuditCard = ({ employeeId }: { employeeId: string }) => {
  const [rows, setRows] = useState<SensitiveAuditRow[] | null>(null);
  useEffect(() => {
    listSensitiveAudit(employeeId)
      .then(setRows)
      .catch(() => setRows([]));
  }, [employeeId]);
  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-[13px] font-semibold">
        <History className="h-4 w-4 text-primary" /> Nhật ký sửa thông tin nhạy cảm
      </p>
      {rows === null ? (
        <p className="mt-2 text-[12px] text-muted-foreground">Đang tải…</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-[12px] text-muted-foreground">Chưa có thay đổi CCCD, MST, BHXH, ngân hàng hay ngày sinh.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border/60 text-[12px]">
          {rows.map((row) => (
            <li key={row.id} className="py-2">
              <span className="font-medium">{row.actor_name ?? "Hệ thống"}</span> sửa{" "}
              {row.fields.map((f) => FIELD_LABEL[f] ?? f).join(", ")}
              {row.source === "change_request" ? " (duyệt đề nghị)" : ""}
              <span className="block text-[11px] text-muted-foreground">{when(row.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
