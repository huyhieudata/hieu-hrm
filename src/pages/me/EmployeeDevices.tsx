import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { DeviceStatusCard } from "@/components/devices/DeviceStatusCard";
import { EmptyState } from "@/components/mobile/EmptyState";
import { useDeviceInfo } from "@/hooks/useDeviceInfo";
import { useAuth } from "@/lib/auth-provider";
import { findMyEmployee } from "@/lib/attendance";
import {
  cancelMyDevice,
  getPolicy,
  listMyDevices,
  registerDevice,
  type AttendancePolicy,
  type EmployeeDevice,
} from "@/lib/attendance-verify";
import { useCompany } from "@/lib/company-provider";
import { getErrorMessage } from "@/lib/utils";

const EmployeeDevices = () => {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const { info, hash, shortHash } = useDeviceInfo();
  const [devices, setDevices] = useState<EmployeeDevice[]>([]);
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!companyId || !user?.id) return;
    setLoading(true);
    try {
      const [employee, nextPolicy] = await Promise.all([findMyEmployee(companyId, user.id), getPolicy(companyId)]);
      setPolicy(nextPolicy);
      if (!employee) {
        setDevices([]);
        return;
      }
      setDevices(await listMyDevices(employee.id));
    } catch (error) {
      toast.error("Không tải được thiết bị", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = devices.find((item) => item.device_hash === hash) ?? null;
  const others = devices.filter((item) => item.device_hash !== hash);
  const canSubmit = !current || current.status === "rejected" || current.status === "revoked" || showForm;

  const submit = async () => {
    if (!companyId) return;
    setBusy(true);
    try {
      const result = await registerDevice(companyId, name.trim() || info?.suggestedName || "");
      toast.success(result.status === "approved" ? "Thiết bị đã được duyệt" : "Đã gửi yêu cầu, chờ HR duyệt");
      setShowForm(false);
      setName("");
      await load();
    } catch (error) {
      toast.error("Không đăng ký được thiết bị", { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (device: EmployeeDevice) => {
    if (!window.confirm(`Huỷ yêu cầu đăng ký "${device.device_name || "thiết bị"}"?`)) return;
    setBusy(true);
    try {
      await cancelMyDevice(device.id);
      toast.success("Đã huỷ yêu cầu thiết bị");
      await load();
    } catch (error) {
      toast.error("Không huỷ được yêu cầu", { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="text-center text-[40px] leading-none" aria-hidden>
        📱
      </div>
      <p className="text-center text-[13px] leading-5 text-muted-foreground">
        Mỗi người dùng thiết bị HR đã duyệt{policy ? ` (tối đa ${policy.max_devices})` : ""}. Sai máy thì không chấm công được.
      </p>

      {loading ? (
        <div className="h-28 animate-pulse rounded-3xl bg-card" />
      ) : !current ? (
        <DeviceStatusCard
          name={info?.suggestedName || "Điện thoại này"}
          detail={[info?.platform, info?.browser, shortHash && `Mã …${shortHash}`].filter(Boolean).join(" · ")}
          status="unregistered"
          current
          note="Máy này chưa có trong danh sách đã đăng ký."
        />
      ) : (
        <DeviceStatusCard
          name={current.device_name || info?.suggestedName || "Thiết bị này"}
          detail={[current.platform, current.model, current.browser].filter(Boolean).join(" · ")}
          status={current.status}
          current
          note={
            current.status === "pending"
              ? `Gửi ${new Date(current.created_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}. Bạn nhận thông báo khi HR xử lý. Bạn có thể tự huỷ nếu gửi nhầm.`
              : current.status === "rejected"
                ? "HR từ chối thiết bị này. Bạn có thể gửi lại hoặc liên hệ HR."
                : current.status === "approved"
                  ? `Duyệt ${current.approved_at ? new Date(current.approved_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : ""}`.trim()
                  : "Thiết bị đã ngừng dùng."
          }
          actionLabel={current.status === "pending" && !busy ? "Huỷ yêu cầu" : undefined}
          onAction={current.status === "pending" ? () => void cancel(current) : undefined}
        />
      )}

      {others.map((item) => (
        <DeviceStatusCard
          key={item.id}
          name={item.device_name || "Thiết bị khác"}
          detail={[item.platform, item.browser].filter(Boolean).join(" · ")}
          status={item.status}
          actionLabel={item.status === "pending" && !busy ? "Huỷ yêu cầu" : undefined}
          onAction={item.status === "pending" ? () => void cancel(item) : undefined}
        />
      ))}

      {canSubmit ? (
        <section className="shadow-mobile space-y-2 rounded-3xl bg-card p-4">
          <label className="block text-[12px] font-semibold text-muted-foreground" htmlFor="device-name">
            Đặt tên gợi nhớ
          </label>
          <input
            id="device-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={info?.suggestedName || "Điện thoại cá nhân"}
            maxLength={80}
            className="min-h-11 w-full rounded-2xl bg-background px-3 text-[14px] outline-none ring-primary focus:ring-2"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="bg-gradient-primary min-h-12 w-full rounded-2xl text-[14px] font-bold text-white disabled:opacity-60"
          >
            {busy ? "Đang gửi…" : current?.status === "rejected" ? "Gửi lại yêu cầu" : "Gửi yêu cầu đăng ký"}
          </button>
        </section>
      ) : (
        <button type="button" onClick={() => setShowForm(true)} className="touch-target text-[13px] font-bold text-primary">
          Yêu cầu đổi thiết bị
        </button>
      )}

      {!loading && devices.length === 0 && !canSubmit ? (
        <EmptyState emoji="📱" title="Chưa có thiết bị" description="Gửi yêu cầu để HR duyệt máy này." />
      ) : null}
    </AppShell>
  );
};

export default EmployeeDevices;
