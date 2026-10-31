import { useCallback, useEffect, useState } from "react";
import { Loader2, MoreHorizontal, PackagePlus, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { getErrorMessage } from "@/lib/utils";
import {
  createServicePlan,
  deleteServicePlan,
  listServicePlans,
  updateServicePlan,
  usePlatformAdmin,
  type ServicePlan,
} from "@/lib/platform";

const currency = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} đ`;

const planFields: FieldDef[] = [
  { name: "name", label: "Tên gói", required: true, placeholder: "Doanh nghiệp" },
  { name: "code", label: "Mã gói", placeholder: "BUSINESS" },
  { name: "price_monthly", label: "Giá theo tháng", type: "number", placeholder: "2490000" },
  { name: "price_yearly", label: "Giá theo năm", type: "number", placeholder: "24900000" },
  { name: "max_members", label: "Số thành viên tối đa", type: "number", placeholder: "Để trống = không giới hạn" },
  { name: "max_workspaces", label: "Số workspace được tạo", type: "number", placeholder: "1" },
  { name: "duration_months", label: "Số tháng sử dụng", type: "number", placeholder: "12" },
  { name: "duration_days", label: "Số ngày (gói dùng thử)", type: "number", placeholder: "Để trống nếu tính theo tháng" },
  {
    name: "features",
    label: "Tính năng (phân cách bằng dấu phẩy)",
    type: "textarea",
    placeholder: "Quản lý nhân sự, Chấm công, Tuyển dụng",
  },
  {
    name: "active",
    label: "Trạng thái",
    type: "select",
    options: [
      { value: "true", label: "Đang bán" },
      { value: "false", label: "Tạm dừng" },
    ],
  },
];

const ServicePlans = () => {
  const { isPlatformAdmin, loading: checkingAccess } = usePlatformAdmin();
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServicePlan | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ServicePlan | null>(null);

  const load = useCallback(async () => {
    if (!isPlatformAdmin) return;
    setLoading(true);
    try {
      setPlans(await listServicePlans());
    } catch (error) {
      toast.error("Không tải được gói dịch vụ", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [isPlatformAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (values: Record<string, string | number | null>) => {
    const features = String(values.features ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const payload = {
      name: values.name,
      code: values.code,
      price_monthly: Number(values.price_monthly ?? 0),
      price_yearly: Number(values.price_yearly ?? 0),
      max_members: values.max_members === null ? null : Number(values.max_members),
      max_workspaces: Number(values.max_workspaces ?? 1),
      duration_months: Number(values.duration_months ?? 12),
      duration_days: values.duration_days === null ? null : Number(values.duration_days),
      features,
      active: String(values.active ?? "true") === "true",
    };

    try {
      if (editing) {
        await updateServicePlan(editing.id, payload);
        toast.success("Đã cập nhật gói dịch vụ");
      } else {
        await createServicePlan(payload);
        toast.success("Đã tạo gói dịch vụ");
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
      await deleteServicePlan(pendingDelete.id);
      toast.success("Đã xoá gói dịch vụ");
      setPendingDelete(null);
      await load();
    } catch (error) {
      toast.error("Không xoá được gói", { description: getErrorMessage(error) });
    }
  };

  if (checkingAccess) {
    return (
      <AppShell>
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang kiểm tra quyền…
        </Card>
      </AppShell>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <AppShell>
        <Card className="p-12 text-center">
          <ShieldAlert className="mx-auto h-7 w-7 text-destructive" />
          <p className="mt-2 text-[13.5px] font-semibold text-foreground">Không có quyền truy cập</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] leading-5 text-muted-foreground">
            Mô-đun này chỉ dành cho quản trị viên toàn hệ thống.
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Quản trị hệ thống"
        title="Gói dịch vụ"
        description="Tạo và quản lý các gói SaaS: giá, giới hạn thành viên và tính năng."
        actions={
          <Button
            className="h-9 gap-1.5 text-[12.5px]"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Thêm gói
          </Button>
        }
      />

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải gói dịch vụ…
        </Card>
      ) : plans.length === 0 ? (
        <Card className="p-12 text-center">
          <PackagePlus className="mx-auto h-6 w-6 text-muted-foreground/70" />
          <p className="mt-2 text-[13px] font-semibold text-foreground">Chưa có gói dịch vụ</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Tạo gói đầu tiên để gán cho workspace.</p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[14px] font-semibold text-foreground">{plan.name}</h3>
                  <p className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">{plan.code ?? "—"}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={plan.active ? "success" : "muted"}>{plan.active ? "Đang bán" : "Tạm dừng"}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Thao tác ${plan.name}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[180px]">
                      <DropdownMenuItem
                        className="gap-2 text-[12.5px]"
                        onSelect={() => {
                          setEditing(plan);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                        onSelect={() => setPendingDelete(plan)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Xoá gói
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="mt-3">
                <p className="font-display text-[24px] font-semibold text-foreground">{currency(plan.price_monthly)}</p>
                <p className="text-[11px] text-muted-foreground">
                  / tháng · {currency(plan.price_yearly)} / năm
                </p>
              </div>

              <p className="mt-2 text-[11px] text-muted-foreground">
                {plan.max_members ? `Tối đa ${plan.max_members} thành viên` : "Không giới hạn thành viên"}
                {` · ${plan.max_workspaces} workspace`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Thời hạn: {plan.duration_days ? `${plan.duration_days} ngày` : `${plan.duration_months} tháng`}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {plan.features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-md bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground"
                  >
                    {feature}
                  </span>
                ))}
              </div>
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
        title={editing ? "Sửa gói dịch vụ" : "Thêm gói dịch vụ"}
        fields={planFields}
        initial={
          editing
            ? {
                ...editing,
                features: editing.features.join(", "),
                active: editing.active ? "true" : "false",
              }
            : {
                price_monthly: 0,
                price_yearly: 0,
                max_workspaces: 1,
                duration_months: 12,
                active: "true",
              }
        }
        submitLabel={editing ? "Lưu thay đổi" : "Thêm gói"}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá gói dịch vụ?</AlertDialogTitle>
            <AlertDialogDescription>
              Gói {pendingDelete?.name} sẽ bị xoá; các workspace đang dùng gói này sẽ chuyển về “Chưa gán”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              Xoá gói
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default ServicePlans;
