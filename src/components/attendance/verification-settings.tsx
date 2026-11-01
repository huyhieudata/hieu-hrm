import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Crosshair, Loader2, MapPin, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  deleteLocation,
  getGpsFix,
  getPolicy,
  listLocations,
  mapsUrl,
  saveLocation,
  savePolicy,
  type AttendanceLocation,
  type AttendancePolicy,
} from "@/lib/attendance-verify";
import { getErrorMessage } from "@/lib/utils";

type Draft = { id?: string; name: string; latitude: string; longitude: string; radius_m: string; active: boolean };
const emptyDraft: Draft = { name: "", latitude: "", longitude: "", radius_m: "200", active: true };

const Row = ({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4 py-2.5">
    <div>
      <p className="text-[12.5px] font-medium text-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
    {children}
  </div>
);

/** Cấu hình xác thực chấm công: ảnh, GPS + vùng chấm, thiết bị đã đăng ký. */
export const VerificationSettings = ({ companyId, canManage }: { companyId: string; canManage: boolean }) => {
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [locations, setLocations] = useState<AttendanceLocation[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [policyRow, locationRows] = await Promise.all([getPolicy(companyId), listLocations(companyId)]);
      setPolicy(policyRow);
      setLocations(locationRows);
    } catch (error) {
      toast.error("Không tải được cấu hình xác thực", { description: getErrorMessage(error) });
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!policy) {
    return (
      <Card className="mb-4 flex items-center gap-2 p-5 text-[12.5px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải cấu hình xác thực…
      </Card>
    );
  }

  const set = <K extends keyof AttendancePolicy>(key: K, value: AttendancePolicy[K]) =>
    setPolicy({ ...policy, [key]: value });

  const persist = async () => {
    setSaving(true);
    try {
      await savePolicy(policy);
      toast.success("Đã lưu cấu hình xác thực chấm công");
    } catch (error) {
      toast.error("Không lưu được", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const fillCurrentLocation = async () => {
    setLocating(true);
    try {
      const fix = await getGpsFix();
      setDraft((current) => ({
        ...(current ?? emptyDraft),
        latitude: fix.latitude.toFixed(6),
        longitude: fix.longitude.toFixed(6),
      }));
      toast.success(`Đã lấy vị trí (±${Math.round(fix.accuracy)} m)`);
    } catch (error) {
      toast.error("Không lấy được vị trí", { description: getErrorMessage(error) });
    } finally {
      setLocating(false);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    const latitude = Number(draft.latitude);
    const longitude = Number(draft.longitude);
    const radius = Number(draft.radius_m);
    if (!draft.name.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      toast.error("Nhập tên và toạ độ hợp lệ.");
      return;
    }
    if (!Number.isFinite(radius) || radius < 20) {
      toast.error("Bán kính tối thiểu 20 m.");
      return;
    }
    try {
      await saveLocation({
        id: draft.id,
        company_id: companyId,
        name: draft.name.trim(),
        latitude,
        longitude,
        radius_m: Math.round(radius),
        active: draft.active,
      });
      toast.success("Đã lưu địa điểm");
      setDraft(null);
      await load();
    } catch (error) {
      toast.error("Không lưu được địa điểm", { description: getErrorMessage(error) });
    }
  };

  const remove = async (location: AttendanceLocation) => {
    if (!window.confirm(`Xoá địa điểm "${location.name}"?`)) return;
    try {
      await deleteLocation(location.id);
      await load();
    } catch (error) {
      toast.error("Không xoá được", { description: getErrorMessage(error) });
    }
  };

  return (
    <div className="mb-5 grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="text-[13px] font-semibold text-foreground">Xác thực khi chấm công</h3>
        <p className="mb-2 text-[11.5px] text-muted-foreground">Áp dụng cho toàn công ty. Máy chủ kiểm tra lại mọi điều kiện.</p>
        <div className="mt-1 rounded-lg bg-muted/60 p-3 text-[11.5px] text-foreground">
          <p className="font-medium">Luôn bắt buộc (chặn cứng):</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
            <li>Đúng điện thoại đã đăng ký và được HR duyệt (máy lạ, chờ duyệt, bị thu hồi đều bị từ chối).</li>
            <li>Có GPS với sai số không vượt ngưỡng bên dưới.</li>
            <li>Đứng trong bán kính một địa điểm chấm công đang dùng.</li>
          </ul>
        </div>
        <div className="divide-y divide-border/60">
          <Row title="Bắt buộc ảnh selfie" hint="Chụp bằng camera trước tại thời điểm chấm.">
            <Switch disabled={!canManage} checked={policy.require_photo} onCheckedChange={(value) => set("require_photo", value)} />
          </Row>
          <Row title="Sai số GPS tối đa (m)" hint="Khuyến nghị 100–200 m.">
            <Input
              type="number"
              disabled={!canManage}
              className="h-8 w-24 text-right"
              value={policy.max_accuracy_m}
              onChange={(event) => set("max_accuracy_m", Number(event.target.value) || 0)}
            />
          </Row>
          <Row title="Số thiết bị tối đa / người" hint="Thường là 1.">
            <Input
              type="number"
              min={1}
              disabled={!canManage}
              className="h-8 w-24 text-right"
              value={policy.max_devices}
              onChange={(event) => set("max_devices", Math.max(1, Number(event.target.value) || 1))}
            />
          </Row>
          <Row title="Tự duyệt máy đầu tiên" hint="Máy đăng ký lần đầu được duyệt ngay; đổi máy cần HR duyệt.">
            <Switch
              disabled={!canManage}
              checked={policy.auto_approve_first_device}
              onCheckedChange={(value) => set("auto_approve_first_device", value)}
            />
          </Row>
        </div>
        {canManage && (
          <Button className="mt-3 h-9 gap-1.5 text-[12.5px]" disabled={saving} onClick={() => void persist()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu cấu hình
          </Button>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">Địa điểm chấm công</h3>
            <p className="text-[11.5px] text-muted-foreground">Nhân viên phải đứng trong bán kính một địa điểm đang dùng mới chấm được.</p>
          </div>
          {canManage && !draft && (
            <Button size="sm" variant="outline" className="h-8 gap-1 text-[11.5px]" onClick={() => setDraft({ ...emptyDraft })}>
              <Plus className="h-3.5 w-3.5" /> Thêm
            </Button>
          )}
        </div>

        {locations.filter((location) => location.active).length === 0 && (
          <div className="mt-3 flex gap-2 rounded-lg border border-destructive/40 bg-destructive-subtle p-3 text-[11.5px] text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-semibold">Chưa có địa điểm chấm công đang dùng.</span> Toàn bộ nhân viên sẽ bị từ chối khi chấm
              công cho tới khi bạn thêm ít nhất một địa điểm.
            </p>
          </div>
        )}

        {draft && (
          <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
            <Input placeholder="Tên (VD: Văn phòng chính)" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Vĩ độ" value={draft.latitude} onChange={(event) => setDraft({ ...draft, latitude: event.target.value })} />
              <Input placeholder="Kinh độ" value={draft.longitude} onChange={(event) => setDraft({ ...draft, longitude: event.target.value })} />
              <Input placeholder="Bán kính (m)" type="number" value={draft.radius_m} onChange={(event) => setDraft({ ...draft, radius_m: event.target.value })} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 gap-1 text-[11.5px]" disabled={locating} onClick={() => void fillCurrentLocation()}>
                {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />} Lấy vị trí hiện tại
              </Button>
              <label className="flex items-center gap-1.5 text-[11.5px]">
                <Switch checked={draft.active} onCheckedChange={(value) => setDraft({ ...draft, active: value })} /> Đang dùng
              </label>
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" variant="ghost" className="h-8 text-[11.5px]" onClick={() => setDraft(null)}>
                  Huỷ
                </Button>
                <Button size="sm" className="h-8 text-[11.5px]" onClick={() => void saveDraft()}>
                  Lưu
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 divide-y divide-border/60">
          {locations.length === 0 && !draft && (
            <p className="py-6 text-center text-[12px] text-muted-foreground">Chưa có địa điểm.</p>
          )}
          {locations.map((location) => (
            <div key={location.id} className="flex items-center gap-3 py-2.5">
              <MapPin className={`h-4 w-4 ${location.active ? "text-primary" : "text-muted-foreground"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-foreground">
                  {location.name} {!location.active && <span className="text-[11px] text-muted-foreground">(tạm tắt)</span>}
                </p>
                <a href={mapsUrl(location.latitude, location.longitude)} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline">
                  {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} · bán kính {location.radius_m} m
                </a>
              </div>
              {canManage && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-[11.5px]"
                    onClick={() =>
                      setDraft({
                        id: location.id,
                        name: location.name,
                        latitude: String(location.latitude),
                        longitude: String(location.longitude),
                        radius_m: String(location.radius_m),
                        active: location.active,
                      })
                    }
                  >
                    Sửa
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => void remove(location)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
