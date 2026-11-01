// Lịch làm việc công ty: cùng công thức với server (public.company_workday_count).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface WorkCalendar {
  workDays: number[]; // ISO: 1=T2 … 7=CN
  holidays: Set<string>;
}

export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];
export const DEFAULT_CALENDAR: WorkCalendar = { workDays: DEFAULT_WORK_DAYS, holidays: new Set() };

export interface CompanyHoliday {
  id: string;
  holiday_date: string;
  name: string;
}

export const loadWorkCalendar = async (companyId: string): Promise<{ workDays: number[]; holidays: CompanyHoliday[] }> => {
  const [cal, hol] = await Promise.all([
    db.from("company_work_calendar").select("work_days").eq("company_id", companyId).maybeSingle(),
    db.from("company_holidays").select("id, holiday_date, name").eq("company_id", companyId).order("holiday_date"),
  ]);
  return {
    workDays: (cal.data?.work_days as number[] | undefined) ?? DEFAULT_WORK_DAYS,
    holidays: (hol.data ?? []) as CompanyHoliday[],
  };
};

export const saveWorkDays = async (companyId: string, workDays: number[]) => {
  const { error } = await db
    .from("company_work_calendar")
    .upsert({ company_id: companyId, work_days: workDays, updated_at: new Date().toISOString() });
  if (error) throw error;
};

export const addHoliday = async (companyId: string, date: string, name: string) => {
  const { error } = await db.from("company_holidays").insert({ company_id: companyId, holiday_date: date, name });
  if (error) throw error;
};

export const deleteHoliday = async (id: string) => {
  const { error } = await db.from("company_holidays").delete().eq("id", id);
  if (error) throw error;
};

export const useWorkCalendar = (companyId: string | null | undefined): WorkCalendar => {
  const [cal, setCal] = useState<WorkCalendar>(DEFAULT_CALENDAR);
  useEffect(() => {
    if (!companyId) return;
    let alive = true;
    loadWorkCalendar(companyId)
      .then((r) => alive && setCal({ workDays: r.workDays, holidays: new Set(r.holidays.map((h) => h.holiday_date)) }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [companyId]);
  return cal;
};

/** Số ngày làm việc trong [start, end] (tối đa 62 ngày lịch), bỏ ngày nghỉ tuần và ngày lễ. */
export const countWorkdays = (start: string, end: string, cal: WorkCalendar = DEFAULT_CALENDAR) => {
  if (!start || !end || end < start) return 0;
  let n = 0;
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < 62; i += 1) {
    const iso = d.toISOString().slice(0, 10);
    if (iso > end) break;
    const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (cal.workDays.includes(dow) && !cal.holidays.has(iso)) n += 1;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return n;
};
