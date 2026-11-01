import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

import { RecordPhotoButton } from "@/components/attendance/record-photo-button";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompany } from "@/lib/company-provider";
import { listEmployees, type EmployeeRecord } from "@/lib/employee-records";
import {
  isLegacyAttendance,
  ATTENDANCE_STATUS_LABELS,
  addDays,
  formatTime,
  listRecordsBetween,
  todayIso,
  type AttendanceRecord,
} from "@/lib/attendance";
import {
  FLAG_LABELS,
  listCompanyDevices,
  listLocations,
  listPunchLogs,
  mapsUrl,
  type AttendanceLocation,
  type EmployeeDevice,
  type PunchLog,
} from "@/lib/attendance-verify";
import { getErrorMessage } from "@/lib/utils";

const MapLink = ({ lat, lng, accuracy, distance }: { lat?: number | null; lng?: number | null; accuracy?: number | null; distance?: number | null }) =>
  lat != null && lng != null ? (
    <a
      href={mapsUrl(lat, lng)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
    >
      <MapPin className="h-3 w-3" /> Bản đồ
      {accuracy != null ? ` ±${Math.round(accuracy)}m` : ""}
      {distance != null ? ` · cách ${Math.round(distance)}m` : ""}
    </a>
  ) : (
    <span className="text-[11px] text-muted-foreground">Không có GPS</span>
  );

/** Chi tiết chấm công cho HR: ảnh, vị trí, thiết bị, cảnh báo; và nhật ký lần chấm bị từ chối. */
const AttendanceLog = () => {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const [params, setParams] = useSearchParams();
  const initialDate = params.get("date") ?? todayIso();
  const [from, setFrom] = useState(params.get("from") ?? initialDate);
  const [to, setTo] = useState(params.get("to") ?? initialDate);
  const [employeeFilter, setEmployeeFilter] = useState(params.get("employee") ?? "");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"records" | "rejected">("records");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [logs, setLogs] = useState<PunchLog[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [devices, setDevices] = useState<EmployeeDevice[]>([]);
  const [locations, setLocations] = useState<AttendanceLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [recordRows, logRows, employeeRows, deviceRows, locationRows] = await Promise.all([
        listRecordsBetween(companyId, from, to),
        listPunchLogs(companyId, from, to),
        listEmployees(companyId),
        listCompanyDevices(companyId),
        listLocations(companyId),
      ]);
      setRecords(recordRows);
      setLogs(logRows);
      setEmployees(employeeRows);
      setDevices(deviceRows);
      setLocations(locationRows);
    } catch (error) {
      toast.error("Không tải được nhật ký chấm công", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const employeeMap = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const deviceMap = useMemo(() => new Map(devices.map((device) => [device.id, device])), [devices]);
  const locationMap = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations]);

  const matches = (employeeId: string) => {
    if (employeeFilter && employeeId !== employeeFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const employee = employeeMap.get(employeeId);
    return [employee?.full_name, employee?.code].some((value) => value?.toLowerCase().includes(q));
  };

  const shownRecords = records
    .filter((record) => matches(record.employee_id))
    .sort((a, b) => (b.check_in ?? "").localeCompare(a.check_in ?? ""));
  const shownLogs = logs.filter((log) => matches(log.employee_id));
  const deviceLabel = (id?: string | null) => {
    if (!id) return "Không rõ thiết bị";
    const device = deviceMap.get(id);
    return device ? device.device_name ?? device.model ?? "Thiết bị" : "Thiết bị đã xoá";
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Chấm công"
        title="Chi tiết chấm công"
        description="Ảnh selfie, vị trí GPS, thiết bị và cảnh báo của từng lần chấm; kèm các lần bị từ chối."
      />

      <Card className="flex flex-wrap items-center gap-2 p-4">
        <input
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="h-9 rounded-md border border-border bg-card px-3 text-[12.5px]"
        />
        <span className="text-muted-foreground">→</span>
        <input
          type="date"
          value={to}
          min={from}
          onChange={(event) => setTo(event.target.value)}
          className="h-9 rounded-md border border-border bg-card px-3 text-[12.5px]"
        />
        <button
          type="button"
          className="h-9 rounded-md border border-border px-3 text-[12px] text-muted-foreground hover:bg-muted"
          onClick={() => {
            setFrom(addDays(todayIso(), -6));
            setTo(todayIso());
          }}
        >
          7 ngày
        </button>
        {employeeFilter && (
          <button
            type="button"
            className="h-9 rounded-md bg-muted px-3 text-[12px]"
            onClick={() => {
              setEmployeeFilter("");
              params.delete("employee");
              setParams(params, { replace: true });
            }}
          >
            {employeeMap.get(employeeFilter)?.full_name ?? "Nhân viên"} ✕
          </button>
        )}
        <label className="relative ml-auto block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm nhân viên…"
            className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[12.5px] outline-none focus:border-primary sm:w-[200px]"
          />
        </label>
      </Card>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="mt-4">
        <TabsList>
          <TabsTrigger value="records">Lần chấm hợp lệ ({shownRecords.length})</TabsTrigger>
          <TabsTrigger value="rejected">Bị từ chối ({shownLogs.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <Card className="mt-3 flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
        </Card>
      ) : tab === "records" ? (
        <Card className="mt-3 divide-y divide-border/60 p-0">
          {shownRecords.length === 0 && (
            <p className="px-5 py-10 text-center text-[12.5px] text-muted-foreground">Không có bản ghi.</p>
          )}
          {shownRecords.map((record) => {
            const employee = employeeMap.get(record.employee_id);
            const flags = record.flags ?? [];
            return (
              <div key={record.id} className="grid gap-2 px-5 py-3 sm:grid-cols-[1.1fr_1fr_1fr]">
                <div>
                  <p className="text-[12.5px] font-semibold text-foreground">
                    {employee?.full_name ?? "Nhân viên"} <span className="font-normal text-muted-foreground">{employee?.code}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(`${record.work_date}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })} ·{" "}
                    {record.session === "afternoon" ? "Chiều" : "Sáng"}
                    {record.location_id ? ` · ${locationMap.get(record.location_id)?.name ?? ""}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant={record.status === "on_time" ? "success" : "warning"}>
                      {ATTENDANCE_STATUS_LABELS[record.status] ?? record.status}
                    </Badge>
                    {isLegacyAttendance(record) && (
                      <Badge variant="outline" title="Bản ghi không có ảnh, GPS hay thiết bị — nhập tay hoặc không có bằng chứng">
                        Nhập tay/không có bằng chứng
                      </Badge>
                    )}
                    {flags.map((flag) => (
                      <Badge key={flag} variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> {FLAG_LABELS[flag] ?? flag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[12px] font-medium text-foreground">Vào {formatTime(record.check_in)}</p>
                  {record.photo_path ? <RecordPhotoButton path={record.photo_path} label="Ảnh vào" /> : <p className="text-[11px] text-muted-foreground">Không có ảnh</p>}
                  <div>
                    <MapLink lat={record.latitude} lng={record.longitude} accuracy={record.accuracy_m} distance={record.distance_m} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{deviceLabel(record.device_id)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[12px] font-medium text-foreground">Ra {formatTime(record.check_out)}</p>
                  {record.check_out && (
                    <>
                      {record.photo_out_path ? <RecordPhotoButton path={record.photo_out_path} label="Ảnh ra" /> : <p className="text-[11px] text-muted-foreground">Không có ảnh</p>}
                      <div>
                        <MapLink lat={record.latitude_out} lng={record.longitude_out} accuracy={record.accuracy_out_m} distance={record.distance_out_m} />
                      </div>
                      <p className="text-[11px] text-muted-foreground">{deviceLabel(record.device_out_id)}</p>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      ) : (
        <Card className="mt-3 divide-y divide-border/60 p-0">
          {shownLogs.length === 0 && (
            <p className="px-5 py-10 text-center text-[12.5px] text-muted-foreground">Không có lần chấm bị từ chối.</p>
          )}
          {shownLogs.map((log) => {
            const employee = employeeMap.get(log.employee_id);
            return (
              <div key={log.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-foreground">
                    {employee?.full_name ?? "Nhân viên"} · {log.action === "out" ? "Chấm ra" : "Chấm vào"}{" "}
                    <span className="font-normal text-muted-foreground">
                      {new Date(log.created_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </p>
                  <p className="text-[11.5px] text-destructive">{log.reason}</p>
                  <div className="flex flex-wrap gap-3">
                    <MapLink lat={log.latitude} lng={log.longitude} accuracy={log.accuracy_m} />
                    <span className="text-[11px] text-muted-foreground">{log.device_id ? deviceLabel(log.device_id) : "Thiết bị lạ"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </AppShell>
  );
};

export default AttendanceLog;
