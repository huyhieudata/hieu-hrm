import { useCallback, useEffect, useState } from "react";
import { Loader2, MapPin, MoreHorizontal, Pencil, Plus, Settings2, Smartphone, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";

import { VerificationSettings } from "@/components/attendance/verification-settings";
import { FieldDialog, type FieldDef } from "@/components/employee/field-dialog";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompany } from "@/lib/company-provider";
import { getErrorMessage } from "@/lib/utils";
import {
  ATTENDANCE_METHOD_LABELS,
  SCOPE_TYPE_LABELS,
  createRow,
  deleteRow,
  listRows,
  scopeLabel,
  updateRow,
  type AttendanceSetting,
} from "@/lib/attendance";

const yesNo = [
  { value: "true", label: "Có" },
  { value: "false", label: "Không" },
];

const settingFields: FieldDef[] = [
  { name: "name", label: "Tên cấu hình", required: true, span: 2, placeholder: "Chấm công văn phòng Hà Nội" },
  { name: "method_gps", label: "Cho phép chấm bằng GPS", type: "select", options: yesNo },
  { name: "method_wifi", label: "Cho phép chấm bằng Wi-Fi", type: "select", options: yesNo },
  { name: "method_phone", label: "Cho phép chấm bằng điện thoại", type: "select", options: yesNo },
  {
    name: "scope_type",
    label: "Áp dụng cho",
    type: "select",
    options: Object.entries(SCOPE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
  },
  {
    name: "scope_value",
    label: "Giá trị phạm vi",
    placeholder: "Tên phòng ban / chức danh / mã nhân viên",
    hint: "Bỏ trống nếu áp dụng toàn công ty.",
  },
  { name: "wifi_ssid", label: "Tên Wi-Fi công ty", placeholder: "VanPhong_5G" },
  { name: "gps_latitude", label: "Vĩ độ văn phòng", type: "number", placeholder: "21.027764" },
  { name: "gps_longitude", label: "Kinh độ văn phòng", type: "number", placeholder: "105.834160" },
  { name: "gps_radius_meters", label: "Bán kính cho phép (m)", type: "number", placeholder: "200" },
  {
    name: "active",
    label: "Trạng thái",
    type: "select",
    options: [
      { value: "true", label: "Đang áp dụng" },
      { value: "false", label: "Tạm dừng" },
    ],
  },
];

const methodIcon = (method: string) => (method === "gps" ? MapPin : method === "wifi" ? Wifi : Smartphone);

const AttendanceSettings = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("attendance");

  const [settings, setSettings] = useState<AttendanceSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AttendanceSetting | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AttendanceSetting | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setSettings(await listRows<AttendanceSetting>("attendance_settings", companyId, "created_at"));
    } catch (error) {
      toast.error("Không tải được cấu hình chấm công", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (values: Record<string, string | number | null>) => {
    if (!companyId) throw new Error("Chưa chọn công ty.");
    const methods: string[] = [];
    if (String(values.method_gps ?? "false") === "true") methods.push("gps");
    if (String(values.method_wifi ?? "false") === "true") methods.push("wifi");
    if (String(values.method_phone ?? "true") === "true") methods.push("phone");
    if (methods.length === 0) throw new Error("Chọn ít nhất một hình thức chấm công.");

    const payload = {
      name: values.name,
      methods,
      scope_type: values.scope_type ?? "company",
      scope_value: values.scope_value,
      wifi_ssid: values.wifi_ssid,
      gps_latitude: values.gps_latitude === null ? null : Number(values.gps_latitude),
      gps_longitude: values.gps_longitude === null ? null : Number(values.gps_longitude),
      gps_radius_meters: Number(values.gps_radius_meters ?? 200),
      active: String(values.active ?? "true") === "true",
    };

    try {
      if (editing) {
        await updateRow("attendance_settings", editing.id, payload);
        toast.success("Đã cập nhật cấu hình chấm công");
      } else {
        await createRow("attendance_settings", { ...payload, company_id: companyId });
        toast.success("Đã thêm cấu hình chấm công");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteRow("attendance_settings", pendingDelete.id);
      toast.success("Đã xoá cấu hình");
      setPendingDelete(null);
      await load();
    } catch (error) {
      toast.error("Không xoá được", { description: getErrorMessage(error) });
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Chấm công"
        title="Cài đặt chấm công"
        description="Kết hợp GPS, Wi-Fi, điện thoại và áp dụng theo toàn công ty, bộ phận, vị trí hoặc cá nhân."
        actions={
          canManage && (
            <Button
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Thêm cấu hình
            </Button>
          )
        }
      />

      {companyId && <VerificationSettings companyId={companyId} canManage={canManage} />}

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải cấu hình…
        </Card>
      ) : settings.length === 0 ? (
        <Card className="p-12 text-center">
          <Settings2 className="mx-auto h-6 w-6 text-muted-foreground/70" />
          <p className="mt-2 text-[13px] font-semibold text-foreground">Chưa có cấu hình chấm công</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Tạo cấu hình để quy định hình thức chấm công cho từng phạm vi.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {settings.map((setting) => (
            <Card key={setting.id} className="flex flex-wrap items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-primary-subtle text-primary-subtle-foreground">
                <Settings2 className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">{setting.name}</p>
                <p className="truncate text-[11.5px] text-muted-foreground">
                  {scopeLabel(setting.scope_type, setting.scope_value)}
                  {setting.wifi_ssid ? ` · Wi-Fi ${setting.wifi_ssid}` : ""}
                  {setting.gps_radius_meters ? ` · GPS ±${setting.gps_radius_meters}m` : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {setting.methods.map((method) => {
                  const Icon = methodIcon(method);
                  return (
                    <span
                      key={method}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      <Icon className="h-2.5 w-2.5" />
                      {ATTENDANCE_METHOD_LABELS[method] ?? method}
                    </span>
                  );
                })}
              </div>

              <Badge variant={setting.active ? "success" : "muted"}>
                {setting.active ? "Đang áp dụng" : "Tạm dừng"}
              </Badge>

              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Thao tác ${setting.name}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[190px]">
                    <DropdownMenuItem
                      className="gap-2 text-[12.5px]"
                      onSelect={() => {
                        setEditing(setting);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                      onSelect={() => setPendingDelete(setting)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Xoá cấu hình
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </Card>
          ))}
        </div>
      )}

      <FieldDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? "Sửa cấu hình chấm công" : "Thêm cấu hình chấm công"}
        description="Có thể kết hợp nhiều hình thức; phạm vi hẹp hơn sẽ được ưu tiên áp dụng."
        fields={settingFields}
        initial={
          editing
            ? {
                ...editing,
                method_gps: editing.methods.includes("gps") ? "true" : "false",
                method_wifi: editing.methods.includes("wifi") ? "true" : "false",
                method_phone: editing.methods.includes("phone") ? "true" : "false",
                active: editing.active ? "true" : "false",
              }
            : {
                method_gps: "true",
                method_wifi: "true",
                method_phone: "true",
                scope_type: "company",
                gps_radius_meters: 200,
                active: "true",
              }
        }
        submitLabel={editing ? "Lưu thay đổi" : "Thêm cấu hình"}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá cấu hình chấm công?</AlertDialogTitle>
            <AlertDialogDescription>{pendingDelete?.name} sẽ bị xoá khỏi danh sách áp dụng.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default AttendanceSettings;
