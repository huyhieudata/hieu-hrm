import { useState } from "react";
import { Loader2, ShieldCheck, ShieldAlert, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEVICE_STATUS_LABELS, registerDevice, type EmployeeDevice } from "@/lib/attendance-verify";
import { getErrorMessage } from "@/lib/utils";

interface Props {
  companyId: string;
  device: EmployeeDevice | null;
  required: boolean;
  suggestedName: string;
  onChanged: () => void;
}

/** Trạng thái thiết bị hiện tại của nhân viên + nút gửi yêu cầu đăng ký. */
export const MyDeviceCard = ({ companyId, device, required, suggestedName, onChanged }: Props) => {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const result = await registerDevice(companyId, name.trim() || suggestedName);
      toast.success(
        result.status === "approved" ? "Thiết bị đã được đăng ký và duyệt" : "Đã gửi yêu cầu, chờ HR duyệt",
      );
      onChanged();
    } catch (error) {
      toast.error("Không đăng ký được thiết bị", { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const approved = device?.status === "approved";
  const tone = approved ? "success" : device?.status === "pending" ? "warning" : "destructive";

  return (
    <div className="mt-4 rounded-lg border border-border/70 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
          {approved ? (
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5 text-warning" />
          )}
          Thiết bị này
        </p>
        <Badge variant={device ? tone : "muted"}>{device ? DEVICE_STATUS_LABELS[device.status] : "Chưa đăng ký"}</Badge>
      </div>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Smartphone className="h-3 w-3" /> {device?.device_name ?? suggestedName}
      </p>
      {device?.status === "pending" && (
        <p className="mt-1 text-[11px] text-warning">Yêu cầu đang chờ HR/quản lý duyệt. Bạn chưa chấm công được trên máy này.</p>
      )}
      {(!device || device.status === "revoked" || device.status === "rejected") && (
        <div className="mt-2 space-y-2">
          {required && (
            <p className="text-[11px] text-muted-foreground">
              Công ty chỉ cho chấm công trên điện thoại đã đăng ký. Gửi yêu cầu đăng ký máy này:
            </p>
          )}
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={suggestedName}
              className="h-8 text-[12px]"
              maxLength={80}
            />
            <Button size="sm" className="h-8 text-[11.5px]" disabled={busy} onClick={() => void submit()}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Đăng ký
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
