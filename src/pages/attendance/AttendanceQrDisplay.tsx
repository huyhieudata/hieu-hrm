import { confirmDialog } from "@/components/common/confirm-dialog";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCompany } from "@/lib/company-provider";
import { issueAttendanceQr, listLocations, rotateAttendanceQr, type AttendanceLocation } from "@/lib/attendance-verify";
import { getErrorMessage } from "@/lib/utils";

/** Màn hình treo tại điểm chấm công: QR đổi mỗi 15 giây, mỗi mã dùng 1 lần/người, hết hạn sau tối đa 60 giây. */
const AttendanceQrDisplay = () => {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const [locations, setLocations] = useState<AttendanceLocation[]>([]);
  const [locationId, setLocationId] = useState<string>("");
  const [img, setImg] = useState<string | null>(null);
  const [expires, setExpires] = useState<number>(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    listLocations(companyId)
      .then((rows) => {
        const active = rows.filter((r) => r.active);
        setLocations(active);
        setLocationId((cur) => cur || active[0]?.id || "");
      })
      .catch((e) => toast.error(getErrorMessage(e)));
  }, [companyId]);

  useEffect(() => {
    if (!locationId) return;
    let timer = 0;
    let cancelled = false;
    const refresh = async () => {
      try {
        const qr = await issueAttendanceQr(locationId);
        if (cancelled) return;
        setImg(await QRCode.toDataURL(qr.token, { width: 640, margin: 2, color: { dark: "#0e2d58" } }));
        const exp = new Date(qr.expires_at).getTime();
        setExpires(exp);
        setError(null);
        timer = window.setTimeout(refresh, Math.max(1000, exp - Date.now() + 500));
      } catch (e) {
        if (cancelled) return;
        setError(getErrorMessage(e));
        setImg(null);
        timer = window.setTimeout(refresh, 10000);
      }
    };
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [locationId]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <AppShell>
      <PageHeader title="Mã QR chấm công" description="Mở màn này trên máy tính bảng/màn hình tại điểm chấm công. Mã tự đổi mỗi 15 giây." />
      <Card className="mx-auto mt-4 max-w-lg space-y-4 p-5 text-center">
        <select className="h-11 w-full rounded-xl border bg-background px-3" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          {locations.length === 0 && <option value="">Chưa có điểm chấm công đang bật</option>}
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name} (bán kính {l.radius_m} m)</option>)}
        </select>
        {img ? <img src={img} alt="Mã QR chấm công" className="mx-auto w-full max-w-sm" /> : <div className="mx-auto aspect-square w-full max-w-sm rounded-2xl bg-muted" />}
        {img && <p className="text-sm text-muted-foreground">Đổi mã sau {Math.max(0, Math.ceil((expires - now) / 1000))} giây</p>}
        {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
        <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-left text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          QR chỉ là điều kiện thêm. Nhân viên vẫn phải dùng thiết bị đã duyệt, đứng trong bán kính của chính điểm này và chụp ảnh (theo chính sách) mới chấm được.
        </p>
        {locationId && (
          <Button variant="outline" className="gap-1.5" onClick={async () => {
            if (!(await confirmDialog("Đổi khoá QR? Mọi mã cũ (kể cả ảnh chụp màn hình) sẽ vô hiệu ngay."))) return;
            rotateAttendanceQr(locationId).then(() => toast.success("Đã đổi khoá. Mã mới hiển thị ở lần làm mới tiếp theo.")).catch((e) => toast.error(getErrorMessage(e)));
          }}>
            <RefreshCw className="h-4 w-4" /> Đổi khoá QR
          </Button>
        )}
      </Card>
    </AppShell>
  );
};

export default AttendanceQrDisplay;
