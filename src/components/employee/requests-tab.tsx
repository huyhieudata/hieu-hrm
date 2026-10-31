import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";
import { todayIso } from "@/lib/attendance";
import { getErrorMessage } from "@/lib/utils";
import {
  applyAttendanceFix,
  createRequestRow,
  deleteRequestRow,
  leaveDays,
  listRequests,
  listRequestTypes,
  REQUEST_SESSION_LABELS,
  REQUEST_STATUS_LABELS,
  requestStatusTone,
  updateRequestRow,
  type EmployeeRequest,
  type RequestType,
} from "@/lib/requests";

interface RequestsTabProps {
  employeeId: string;
  companyId: string;
  canManage: boolean;
}

const STATUS_OPTIONS = ["pending", "approved", "rejected", "cancelled"];
const TIME_CATEGORIES = ["late", "early_leave", "attendance_fix", "outside"];
const SESSION_CATEGORIES = ["leave", "remote", "attendance_fix"];

const formatDay = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN");
const shortTime = (value: string | null) => (value ? value.slice(0, 5) : "");

const RequestsTab = ({ employeeId, companyId, canManage }: RequestsTabProps) => {
  const { user } = useAuth();
  const { can } = useCompany();
  const canApprove = can("leave.approve");

  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [types, setTypes] = useState<RequestType[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRequest | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EmployeeRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [typeId, setTypeId] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [session, setSession] = useState("full_day");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("pending");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [requestRows, typeRows] = await Promise.all([listRequests(companyId), listRequestTypes(companyId)]);
      setRequests(requestRows.filter((request) => request.employee_id === employeeId));
      setTypes(typeRows.filter((type) => type.active));
    } catch (loadError) {
      toast.error("Không tải được đơn từ", { description: getErrorMessage(loadError) });
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const typeById = useMemo(() => new Map(types.map((type) => [type.id, type])), [types]);
  const selectedType = typeId ? typeById.get(typeId) ?? null : null;
  const category = selectedType?.category ?? "leave";
  const needsTime = TIME_CATEGORIES.includes(category);
  const needsSession = SESSION_CATEGORIES.includes(category);

  const openCreate = () => {
    setEditing(null);
    setTypeId(types[0]?.id ?? "");
    setStartDate(todayIso());
    setEndDate(todayIso());
    setSession("full_day");
    setStartTime("");
    setEndTime("");
    setReason("");
    setStatus("pending");
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (request: EmployeeRequest) => {
    setEditing(request);
    setTypeId(request.request_type_id);
    setStartDate(request.start_date);
    setEndDate(request.end_date);
    setSession(request.session ?? "full_day");
    setStartTime(request.start_time ? request.start_time.slice(0, 5) : "");
    setEndTime(request.end_time ? request.end_time.slice(0, 5) : "");
    setReason(request.reason ?? "");
    setStatus(request.status);
    setError(null);
    setFormOpen(true);
  };

  const submit = async () => {
    setError(null);
    if (!selectedType) {
      setError("Vui lòng chọn loại đơn.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Vui lòng chọn thời gian cho đơn.");
      return;
    }
    if (endDate < startDate) {
      setError("Ngày kết thúc phải sau ngày bắt đầu.");
      return;
    }
    if (needsTime && !startTime && !endTime) {
      setError("Vui lòng nhập giờ cụ thể cho đơn.");
      return;
    }
    if (startTime && endTime && endTime < startTime) {
      setError("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        employee_id: employeeId,
        company_id: companyId,
        request_type_id: selectedType.id,
        start_date: startDate,
        end_date: endDate,
        session: needsSession ? session : null,
        start_time: needsTime ? startTime || null : null,
        end_time: needsTime ? endTime || null : null,
        leave_days: category === "leave" ? leaveDays(startDate, endDate, session) : 0,
        reason: reason.trim() || null,
        status,
        ...(status === "pending"
          ? { decided_by: null, decided_at: null, decision_note: null }
          : { decided_by: user?.id ?? null, decided_at: new Date().toISOString() }),
      };

      if (editing) {
        await updateRequestRow(editing.id, payload);
        if (status === "approved" && selectedType.category === "attendance_fix") {
          await applyAttendanceFix({ ...editing, ...payload } as EmployeeRequest);
        }
        toast.success("Đã cập nhật đơn");
      } else {
        const newId = await createRequestRow(payload);
        if (status === "approved" && selectedType.category === "attendance_fix") {
          await applyAttendanceFix({ ...payload, id: newId } as EmployeeRequest);
        }
        toast.success("Đã thêm đơn cho nhân sự");
      }
      setFormOpen(false);
      await load();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  const removeRequest = async () => {
    if (!pendingDelete) return;
    try {
      await deleteRequestRow(pendingDelete.id);
      toast.success("Đã xoá đơn");
      setPendingDelete(null);
      await load();
    } catch (deleteError) {
      toast.error("Không xoá được đơn", { description: getErrorMessage(deleteError) });
    }
  };

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-5 py-3.5">
          <div>
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
              <FileText className="h-4 w-4 text-primary" /> Đơn từ của nhân sự
            </h3>
            <p className="text-[11.5px] text-muted-foreground">
              Tất cả đơn đi muộn, về sớm, nghỉ phép, làm từ xa, sửa chấm công…
            </p>
          </div>
          {canManage && (
            <Button className="h-8 gap-1.5 text-[12px]" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> Thêm đơn
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-[12.5px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải đơn từ…
          </div>
        ) : requests.length === 0 ? (
          <p className="px-5 py-10 text-center text-[12.5px] text-muted-foreground">Nhân sự chưa có đơn từ nào.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {requests.map((request) => {
              const type = typeById.get(request.request_type_id);
              const period =
                request.start_date === request.end_date
                  ? formatDay(request.start_date)
                  : `${formatDay(request.start_date)} → ${formatDay(request.end_date)}`;
              const times = [shortTime(request.start_time), shortTime(request.end_time)].filter(Boolean).join(" – ");
              return (
                <li key={request.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[12.5px] font-semibold text-foreground">{type?.name ?? "Loại đơn"}</p>
                      <Badge variant={requestStatusTone(request.status)}>
                        {REQUEST_STATUS_LABELS[request.status] ?? request.status}
                      </Badge>
                      {type?.deduct_leave && <Badge variant="info">Trừ {request.leave_days} ngày phép</Badge>}
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {period}
                      {request.session ? ` · ${REQUEST_SESSION_LABELS[request.session] ?? request.session}` : ""}
                      {times ? ` · ${times}` : ""}
                    </p>
                    {request.reason && <p className="mt-0.5 line-clamp-2 text-[11.5px] text-foreground/80">{request.reason}</p>}
                    {request.decision_note && request.status !== "pending" && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">Phản hồi: {request.decision_note}</p>
                    )}
                  </div>

                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Thao tác đơn">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[180px]">
                        <DropdownMenuItem className="gap-2 text-[12.5px]" onSelect={() => openEdit(request)}>
                          <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                          onSelect={() => setPendingDelete(request)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Xoá đơn
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa đơn" : "Thêm đơn cho nhân sự"}</DialogTitle>
            <DialogDescription>Đơn được liên kết với mô-đun Đơn từ và bảng công.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[12px]">Loại đơn</Label>
                <Select value={typeId} onValueChange={setTypeId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Chọn loại đơn" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                        {type.deduct_leave ? " · trừ phép" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {canApprove && (
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Trạng thái</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {REQUEST_STATUS_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="employee-request-start" className="text-[12px]">
                  Từ ngày
                </Label>
                <Input
                  id="employee-request-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    if (event.target.value > endDate) setEndDate(event.target.value);
                  }}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="employee-request-end" className="text-[12px]">
                  Đến ngày
                </Label>
                <Input
                  id="employee-request-end"
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            {needsSession && (
              <div className="space-y-1.5">
                <Label className="text-[12px]">Buổi áp dụng</Label>
                <Select value={session} onValueChange={setSession}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REQUEST_SESSION_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {needsTime && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="employee-request-start-time" className="text-[12px]">
                    Từ giờ
                  </Label>
                  <Input
                    id="employee-request-start-time"
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="employee-request-end-time" className="text-[12px]">
                    Đến giờ
                  </Label>
                  <Input
                    id="employee-request-end-time"
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className="h-10"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="employee-request-reason" className="text-[12px]">
                Lý do
              </Label>
              <Textarea
                id="employee-request-reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Lý do nghỉ / đi muộn / điều chỉnh…"
              />
            </div>

            {category === "leave" && (
              <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11.5px] text-muted-foreground">
                Nghỉ {leaveDays(startDate, endDate, session)} ngày
                {selectedType?.deduct_leave ? " · trừ ngày phép năm" : " · không trừ ngày phép"}
              </p>
            )}

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-[11.5px] text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="h-9" onClick={() => setFormOpen(false)} disabled={saving}>
              Huỷ
            </Button>
            <Button className="h-9 gap-2" onClick={() => void submit()} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editing ? "Lưu thay đổi" : "Thêm đơn"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá đơn?</AlertDialogTitle>
            <AlertDialogDescription>
              Đơn sẽ bị xoá khỏi hồ sơ nhân sự và mô-đun Đơn từ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void removeRequest()}
            >
              Xoá đơn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RequestsTab;
