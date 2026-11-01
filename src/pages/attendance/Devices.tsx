import { confirmDialog } from "@/components/common/confirm-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, RotateCcw, Search, ShieldOff, Smartphone, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import EmployeeDevices from "@/pages/me/EmployeeDevices";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompany } from "@/lib/company-provider";
import { listEmployees, type EmployeeRecord } from "@/lib/employee-records";
import {
  DEVICE_STATUS_LABELS,
  listCompanyDevices,
  resetEmployeeDevices,
  reviewDevice,
  type DeviceStatus,
  type EmployeeDevice,
} from "@/lib/attendance-verify";
import { getErrorMessage } from "@/lib/utils";
import { AppInstallCell, AppInstallSummary } from "@/components/pwa/app-install-cell";
import { loadAppInstallStatus, type AppInstallStatus } from "@/lib/app-installs";

const tone = (status: DeviceStatus) =>
  status === "approved" ? "success" : status === "pending" ? "warning" : "destructive";

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—";

/** HR duyệt / thu hồi / đặt lại điện thoại chấm công của nhân viên. */
const Devices = () => {
  const { activeCompany, canDo } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canEdit = canDo("attendance", "edit");
  const [devices, setDevices] = useState<EmployeeDevice[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [tab, setTab] = useState<"pending" | "approved" | "other">("pending");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [installs, setInstalls] = useState<AppInstallStatus[]>([]);
  const [onlyNoApp, setOnlyNoApp] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [deviceRows, employeeRows] = await Promise.all([listCompanyDevices(companyId), listEmployees(companyId)]);
      setDevices(deviceRows);
      setEmployees(employeeRows);
      void loadAppInstallStatus(companyId)
        .then(setInstalls)
        .catch(() => setInstalls([]));
    } catch (error) {
      toast.error("Không tải được thiết bị", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const employeeMap = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);

  const installByEmployee = useMemo(
    () => new Map(installs.filter((row) => row.employee_id).map((row) => [row.employee_id as string, row])),
    [installs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices.filter((device) => {
      const inTab =
        tab === "pending" ? device.status === "pending" : tab === "approved" ? device.status === "approved" : !["pending", "approved"].includes(device.status);
      if (!inTab) return false;
      if (onlyNoApp && installByEmployee.get(device.employee_id)?.installed !== false) return false;
      if (!q) return true;
      const employee = employeeMap.get(device.employee_id);
      return [employee?.full_name, employee?.code, device.device_name, device.model].some((value) =>
        value?.toLowerCase().includes(q),
      );
    });
  }, [devices, employeeMap, query, tab, onlyNoApp, installByEmployee]);

  const counts = useMemo(
    () => ({
      pending: devices.filter((device) => device.status === "pending").length,
      approved: devices.filter((device) => device.status === "approved").length,
      other: devices.filter((device) => !["pending", "approved"].includes(device.status)).length,
    }),
    [devices],
  );

  const act = async (device: EmployeeDevice, action: "approve" | "revoke" | "reject" | "delete") => {
    setBusy(device.id);
    try {
      await reviewDevice(device.id, action);
      toast.success(
        action === "approve" ? "Đã duyệt thiết bị" : action === "delete" ? "Đã xoá thiết bị" : "Đã thu hồi thiết bị",
      );
      await load();
    } catch (error) {
      toast.error("Không cập nhật được", { description: getErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const reset = async (device: EmployeeDevice) => {
    const employee = employeeMap.get(device.employee_id);
    if (!(await confirmDialog(`Đặt lại thiết bị cho ${employee?.full_name ?? "nhân viên"}? Mọi máy cũ bị thu hồi, nhân viên đăng ký lại máy mới.`))) return;
    setBusy(device.id);
    try {
      await resetEmployeeDevices(device.employee_id);
      toast.success("Đã đặt lại thiết bị", { description: "Nhân viên mở trang Chấm công trên máy mới để đăng ký." });
      await load();
    } catch (error) {
      toast.error("Không đặt lại được", { description: getErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Chấm công"
        title="Thiết bị chấm công"
        description="Duyệt điện thoại nhân viên đăng ký; chỉ thiết bị đã duyệt mới chấm công được. Thu hồi hoặc đặt lại khi nhân viên đổi máy."
      />

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList>
            <TabsTrigger value="pending">Chờ duyệt ({counts.pending})</TabsTrigger>
            <TabsTrigger value="approved">Đã duyệt ({counts.approved})</TabsTrigger>
            <TabsTrigger value="other">Thu hồi/Từ chối ({counts.other})</TabsTrigger>
          </TabsList>
        </Tabs>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm nhân viên, thiết bị…"
            className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[12.5px] outline-none focus:border-primary sm:w-[240px]"
          />
        </label>
      </Card>

      {installs.length > 0 && (
        <div className="mt-4">
          <AppInstallSummary
            installed={installs.filter((row) => row.installed).length}
            total={installs.length}
            note={(() => {
              const noAccount = Math.max(0, employeeMap.size - installs.filter((row) => row.employee_id).length);
              return noAccount ? `${noAccount} hồ sơ chưa có tài khoản đăng nhập không tính` : undefined;
            })()}
            onlyMissing={onlyNoApp}
            onToggle={setOnlyNoApp}
            missingNames={installs
              .filter((row) => !row.installed)
              .map((row) => (row.employee_id && employeeMap.get(row.employee_id)?.full_name) || "Chưa liên kết hồ sơ")}
          />
        </div>
      )}

      {loading ? (
        <Card className="mt-4 flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="mt-4 p-10 text-center text-[12.5px] text-muted-foreground">Không có thiết bị.</Card>
      ) : (
        <Card className="mt-4 divide-y divide-border/60 p-0">
          {filtered.map((device) => {
            const employee = employeeMap.get(device.employee_id);
            const working = busy === device.id;
            return (
              <div key={device.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-muted text-muted-foreground">
                  <Smartphone className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-foreground">
                    {employee?.full_name ?? "Nhân viên"}{" "}
                    <span className="font-normal text-muted-foreground">{employee?.code}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {device.device_name ?? "—"} · {[device.platform, device.model, device.browser].filter(Boolean).join(" / ")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Gửi {formatDateTime(device.created_at)} · Dùng gần nhất {formatDateTime(device.last_used_at)}
                  </p>
                </div>
                <AppInstallCell status={installByEmployee.get(device.employee_id)} />
                <Badge variant={tone(device.status)}>{DEVICE_STATUS_LABELS[device.status]}</Badge>
                {canEdit && (
                  <div className="flex flex-wrap gap-1.5">
                    {device.status === "pending" && (
                      <>
                        <Button size="sm" className="h-8 gap-1 text-[11.5px]" disabled={working} onClick={() => void act(device, "approve")}>
                          <Check className="h-3.5 w-3.5" /> Duyệt
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-[11.5px]" disabled={working} onClick={() => void act(device, "reject")}>
                          <X className="h-3.5 w-3.5" /> Từ chối
                        </Button>
                      </>
                    )}
                    {device.status === "approved" && (
                      <Button size="sm" variant="outline" className="h-8 gap-1 text-[11.5px]" disabled={working} onClick={() => void act(device, "revoke")}>
                        <ShieldOff className="h-3.5 w-3.5" /> Thu hồi
                      </Button>
                    )}
                    {device.status !== "pending" && device.status !== "approved" && (
                      <Button size="sm" variant="ghost" className="h-8 gap-1 text-[11.5px]" disabled={working} onClick={() => void act(device, "delete")}>
                        <Trash2 className="h-3.5 w-3.5" /> Xoá
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-[11.5px]" disabled={working} onClick={() => void reset(device)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Đặt lại (đổi máy)
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </AppShell>
  );
};

const DevicesPage = () => {
  const { role } = useCompany();
  if (role === "employee") return <EmployeeDevices />;
  return <Devices />;
};

export default DevicesPage;
