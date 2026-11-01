import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, CalendarDays, ChevronRight, KeyRound, LogOut, Moon, Smartphone, User, Wallet } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { useMyDay } from "@/components/mobile/use-my-day";
import { ChangePasswordDialog, NotificationSettingsDialog } from "@/components/mobile/AccountSettings";
import { useDeviceMode } from "@/hooks/use-device-mode";
import { initials as personInitials } from "@/lib/format";
import { SelfChangeRequestCard } from "@/components/employee/change-requests";
import { Switch } from "@/components/ui/switch";
import { useAuth, displayName } from "@/lib/auth-provider";
import { findMyEmployee } from "@/lib/attendance";
import { useCompany } from "@/lib/company-provider";
import type { EmployeeRecord } from "@/lib/employee-records";
import { resolveDark, writeTheme } from "@/lib/theme";
import { getErrorMessage } from "@/lib/utils";

const initials = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NV";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const LINKS = [
  { to: "/toi/ho-so", label: "Thông tin cá nhân", icon: User },
  { to: "/toi/bang-cong", label: "Bảng công", icon: CalendarDays },
  { to: "/toi/phieu-luong", label: "Phiếu lương", icon: Wallet },
  { to: "/toi/thiet-bi", label: "Thiết bị của tôi", icon: Smartphone },
] as const;

export const EmployeeProfile = ({ infoOnly = false }: { infoOnly?: boolean }) => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { activeCompany } = useCompany();
  const [me, setMe] = useState<EmployeeRecord | null>(null);
  const [dark, setDark] = useState(() => resolveDark());
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompany?.id || !user?.id) return;
    try {
      setMe(await findMyEmployee(activeCompany.id, user.id));
    } catch (error) {
      toast.error("Không tải được hồ sơ", { description: getErrorMessage(error) });
    }
  }, [activeCompany?.id, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const fullName = me?.full_name || displayName(profile, user?.email);
  const rows = useMemo(
    () =>
      [
        ["Mã nhân viên", me?.code],
        ["Phòng ban", me?.department],
        ["Chức danh", me?.position],
        ["Điện thoại", me?.phone],
        ["Email", me?.work_email || profile?.email || user?.email],
        ["Ngày vào", me?.hire_date],
        ["Thường trú", me?.permanent_address],
        ["Tạm trú", me?.current_address],
        ["Liên hệ khẩn cấp", [me?.emergency_contact_name, me?.emergency_contact_phone].filter(Boolean).join(" · ")],
        ["Ngân hàng", [me?.bank_name, me?.bank_account].filter(Boolean).join(" · ")],
      ].filter((row): row is [string, string] => Boolean(row[1])),
    [me, profile?.email, user?.email],
  );

  const mobile = useDeviceMode() === "mobile";
  const day = useMyDay(mobile);

  const logout = async () => {
    try {
      await signOut();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  if (mobile) {
    const deviceLabel =
      day.device?.status === "approved" ? "Đã đăng ký" : day.deviceBlocked ? "Chưa duyệt" : null;
    return (
      <AppShell>
        <div className="-mx-3 space-y-2">
          <section className="flex items-center gap-4 bg-card px-5 py-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-[20px] font-bold text-brand-navy">
              {personInitials(fullName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[18px] font-bold">{fullName}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {[me?.code, me?.position, me?.department].filter(Boolean).join(" · ") || activeCompany?.name}
              </p>
            </div>
          </section>
          {infoOnly ? (
            <section className="bg-card px-5">
              {rows.map(([label, value]) => (
                <div key={label} className="flex min-h-12 items-center justify-between gap-3 border-t border-border py-2 text-[14px] first:border-t-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-right font-semibold">{value}</span>
                </div>
              ))}
            </section>
          ) : (
            <section className="bg-card px-5">
              <Link to="/toi/ho-so" className="flex h-14 items-center gap-3 text-[15px] font-medium">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-subtle text-brand-navy">
                  <User className="h-4 w-4" />
                </span>
                <span className="flex-1">Thông tin cá nhân</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link to="/toi/thiet-bi" className="flex h-14 items-center gap-3 border-t border-border text-[15px] font-medium">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-subtle text-brand-navy">
                  <Smartphone className="h-4 w-4" />
                </span>
                <span className="flex-1">Thiết bị</span>
                {deviceLabel ? (
                  <span className={day.device?.status === "approved" ? "rounded-full bg-success-subtle px-2 py-0.5 text-[12px] font-semibold text-success" : "rounded-full bg-accent px-2 py-0.5 text-[12px] font-semibold text-accent-foreground"}>
                    {deviceLabel}
                  </span>
                ) : null}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <button type="button" onClick={() => setPasswordOpen(true)} className="flex h-14 w-full items-center gap-3 border-t border-border text-left text-[15px] font-medium">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-subtle text-brand-navy">
                  <KeyRound className="h-4 w-4" />
                </span>
                <span className="flex-1">Đổi mật khẩu</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <button type="button" onClick={() => setNotifyOpen(true)} className="flex h-14 w-full items-center gap-3 border-t border-border text-left text-[15px] font-medium">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-subtle text-brand-navy">
                  <Bell className="h-4 w-4" />
                </span>
                <span className="flex-1">Cài đặt thông báo</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <label className="flex h-14 items-center gap-3 border-t border-border text-[15px] font-medium">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-subtle text-brand-navy">
                  <Moon className="h-4 w-4" />
                </span>
                <span className="flex-1">Giao diện tối</span>
                <Switch
                  checked={dark}
                  onCheckedChange={(checked) => {
                    writeTheme(checked ? "dark" : "light");
                    setDark(checked);
                  }}
                  aria-label="Bật giao diện tối"
                />
              </label>
              <button type="button" onClick={() => void logout()} className="flex h-14 w-full items-center gap-3 border-t border-border text-left text-[15px] font-semibold text-destructive">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive-subtle text-destructive">
                  <LogOut className="h-4 w-4" />
                </span>
                Đăng xuất
              </button>
            </section>
          )}
          <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} email={user?.email} />
          <NotificationSettingsDialog open={notifyOpen} onOpenChange={setNotifyOpen} userId={user?.id} />
          {infoOnly && me && activeCompany ? <div className="px-4"><SelfChangeRequestCard companyId={activeCompany.id} employee={me} /></div> : null}
          <p className="py-3 text-center text-[12px] text-muted-foreground">ONHRM</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="pt-2 text-center">
        <div className="bg-gradient-primary mx-auto flex h-16 w-16 items-center justify-center rounded-full p-[3px]">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-card font-display text-[18px] font-extrabold text-primary">
            {initials(fullName)}
          </div>
        </div>
        <p className="mt-2 font-display text-[16px] font-extrabold">{fullName}</p>
        <p className="text-[12px] text-muted-foreground">
          {[me?.code, me?.department].filter(Boolean).join(" · ") || activeCompany?.name}
        </p>
      </div>

      {infoOnly ? (
        <section className="shadow-mobile divide-y divide-border/70 rounded-3xl bg-card px-4">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 py-3 text-[13px]">
              <span className="text-muted-foreground">{label}</span>
              <span className="text-right font-semibold">{value}</span>
            </div>
          ))}
        </section>
      ) : null}
      {infoOnly && me && activeCompany ? <SelfChangeRequestCard companyId={activeCompany.id} employee={me} /> : null}
      {infoOnly ? null : (
        <section className="shadow-mobile divide-y divide-border/70 rounded-3xl bg-card px-2">
          {LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className="flex min-h-12 w-full items-center gap-3 px-2 text-[14px] font-semibold">
                <Icon className="h-4 w-4 text-primary" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
          <label className="flex min-h-12 items-center gap-3 px-2 text-[14px] font-semibold">
            <Moon className="h-4 w-4 text-primary" />
            <span className="flex-1">Giao diện tối</span>
            <Switch
              checked={dark}
              onCheckedChange={(checked) => {
                writeTheme(checked ? "dark" : "light");
                setDark(checked);
              }}
              aria-label="Bật giao diện tối"
            />
          </label>
        </section>
      )}

      {!infoOnly ? (
        <button type="button" onClick={() => void logout()} className="shadow-mobile mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-3xl border border-destructive/20 bg-card text-[14px] font-bold text-destructive active:bg-destructive/5">
          <LogOut className="h-4 w-4" /> Đăng xuất
        </button>
      ) : null}
    </AppShell>
  );
};

export default EmployeeProfile;
