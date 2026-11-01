import { useCallback, useEffect, useState } from "react";

import { initials } from "@/lib/format";
import { displayName, useAuth } from "@/lib/auth-provider";
import {
  findMyEmployee,
  isWorkingDay,
  listRecordsBetween,
  listRows,
  resolveShift,
  todayIso,
  currentMonthIso,
  type AttendanceRecord,
  type ShiftAssignment,
  type WorkShift,
} from "@/lib/attendance";
import { getDeviceHash, listLocations, listMyDevices, type EmployeeDevice } from "@/lib/attendance-verify";
import { useCompany } from "@/lib/company-provider";
import type { EmployeeRecord } from "@/lib/employee-records";

export type PunchMode = "ready" | "in" | "blocked";

export interface MyDay {
  loading: boolean;
  companyName: string;
  fullName: string;
  personMeta: string;
  initials: string;
  shift: WorkShift | null;
  shiftName: string;
  range: string;
  expectedOut: string;
  open: AttendanceRecord | null;
  done: boolean;
  offDay: boolean;
  device: EmployeeDevice | null;
  deviceBlocked: boolean;
  workedDays: number;
  plannedDays: number;
  placeName: string | null;
  punch: PunchMode;
}

const EMPTY: MyDay = {
  loading: false,
  companyName: "ONHRM",
  fullName: "",
  personMeta: "",
  initials: "NV",
  shift: null,
  shiftName: "Ca làm việc",
  range: "Chưa phân ca",
  expectedOut: "",
  open: null,
  done: false,
  offDay: false,
  device: null,
  deviceBlocked: false,
  workedDays: 0,
  plannedDays: 0,
  placeName: null,
  punch: "ready",
};

const short = (value: string | null | undefined) => (value ? value.slice(0, 5) : "");

const shiftRange = (shift: WorkShift | null) => {
  if (!shift) return "Chưa phân ca";
  if (shift.shift_type === "single") {
    return `${short(shift.morning_start || shift.start_time)} – ${short(shift.morning_end || shift.end_time)}`;
  }
  return `${short(shift.morning_start || shift.start_time)} – ${short(shift.afternoon_end || shift.end_time)}`;
};

const plannedWorkingDays = (shift: WorkShift | null, month: string) => {
  if (!shift) return 0;
  const [year, monthValue] = month.split("-").map(Number);
  const last = new Date(year, monthValue, 0).getDate();
  let count = 0;
  for (let day = 1; day <= last; day += 1) {
    const iso = `${month}-${String(day).padStart(2, "0")}`;
    if (isWorkingDay(shift, iso)) count += 1;
  }
  return count;
};

export const useMyDay = (enabled = true): MyDay => {
  const { user, profile } = useAuth();
  const { activeCompany, activeMembership } = useCompany();
  const [state, setState] = useState<MyDay>(EMPTY);

  const load = useCallback(async () => {
    const companyId = activeCompany?.id;
    if (!enabled || !companyId || !user?.id) {
      setState({
        ...EMPTY,
        companyName: activeCompany?.name ?? "ONHRM",
        fullName: displayName(profile, user?.email),
        initials: initials(displayName(profile, user?.email)),
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, companyName: activeCompany.name }));
    const today = todayIso();
    const month = currentMonthIso();
    try {
      const [employee, shifts, assignments, locations] = await Promise.all([
        findMyEmployee(companyId, user.id),
        listRows<WorkShift>("work_shifts", companyId, "start_time", true),
        listRows<ShiftAssignment>("shift_assignments", companyId, "created_at"),
        listLocations(companyId).catch(() => []),
      ]);
      const shift = employee ? resolveShift(employee, assignments, shifts, today) : null;
      const monthEndDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
      const monthEnd = `${month}-${String(monthEndDay).padStart(2, "0")}`;
      let records: AttendanceRecord[] = [];
      let device: EmployeeDevice | null = null;
      if (employee) {
        const [rows, devices, hash] = await Promise.all([
          listRecordsBetween(companyId, `${month}-01`, monthEnd),
          listMyDevices(employee.id),
          getDeviceHash(),
        ]);
        records = rows.filter((row) => row.employee_id === employee.id);
        device = devices.find((item) => item.device_hash === hash) ?? null;
      }
      const todayRecords = records.filter((row) => row.work_date === today);
      const open = todayRecords.find((row) => row.check_in && !row.check_out) ?? null;
      const done = todayRecords.length > 0 && todayRecords.every((row) => row.check_in && row.check_out);
      const deviceBlocked = Boolean(employee) && device?.status !== "approved";
      const workedDays = new Set(records.filter((row) => row.check_in).map((row) => row.work_date)).size;
      const activePlaces = locations.filter((place) => place.active);
      const name = employee?.full_name || displayName(profile, user.email);
      const meta = [employee?.position || activeMembership?.job_title, employee?.department || activeMembership?.department]
        .filter(Boolean)
        .join(" · ");
      setState({
        loading: false,
        companyName: activeCompany.name,
        fullName: name,
        personMeta: meta,
        initials: initials(name),
        shift,
        shiftName: shift?.name ?? "Ca làm việc",
        range: shiftRange(shift),
        expectedOut: short(shift?.afternoon_end || shift?.end_time || shift?.morning_end),
        open,
        done,
        offDay: Boolean(shift && !isWorkingDay(shift, today)),
        device,
        deviceBlocked,
        workedDays,
        plannedDays: plannedWorkingDays(shift, month),
        placeName: activePlaces.length === 1 ? activePlaces[0].name : null,
        punch: deviceBlocked ? "blocked" : open ? "in" : "ready",
      });
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        companyName: activeCompany?.name ?? "ONHRM",
        fullName: displayName(profile, user?.email),
        initials: initials(displayName(profile, user?.email)),
      }));
    }
  }, [activeCompany, activeMembership?.department, activeMembership?.job_title, enabled, profile, user?.email, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return state;
};

export const elapsedLabel = (fromIso: string, now = Date.now()) => {
  const start = new Date(fromIso).getTime();
  if (Number.isNaN(start)) return "00:00:00";
  const total = Math.max(0, Math.floor((now - start) / 1000));
  const hours = String(Math.floor(total / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

export type { EmployeeRecord };
