import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, Copy, Loader2, MoreHorizontal, Pencil, Plus, Search, ShieldAlert, Trash2, UserPlus } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-provider";
import { getErrorMessage } from "@/lib/utils";
import {
  WORKSPACE_STATUS_LABELS,
  createWorkspace,
  provisionWorkspaceAdmin,
  deleteWorkspace,
  listServicePlans,
  listWorkspaces,
  updateWorkspace,
  usePlatformAdmin,
  workspaceDaysLeft,
  type PlatformWorkspace,
  type ServicePlan,
} from "@/lib/platform";

const formatDate = (value: string | null) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN") : "—");

const statusTone = (workspace: PlatformWorkspace) => {
  const days = workspaceDaysLeft(workspace.subscription_expires_at);
  if (workspace.workspace_status === "suspended") return "muted" as const;
  if (days !== null && days < 0) return "destructive" as const;
  if (days !== null && days <= 30) return "warning" as const;
  return workspace.workspace_status === "trial" ? "info" : "success";
};

const Workspaces = () => {
  const { user } = useAuth();
  const { isPlatformAdmin, loading: checkingAccess } = usePlatformAdmin();

  const [workspaces, setWorkspaces] = useState<PlatformWorkspace[]>([]);
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformWorkspace | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlatformWorkspace | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [adminInfo, setAdminInfo] = useState<{
    name: string;
    email: string;
    phone: string;
    password: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    if (!isPlatformAdmin) return;
    setLoading(true);
    try {
      const [workspaceRows, planRows] = await Promise.all([listWorkspaces(), listServicePlans()]);
      setWorkspaces(workspaceRows);
      setPlans(planRows);
    } catch (error) {
      toast.error("Không tải được dữ liệu quản trị", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [isPlatformAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const planOptions = useMemo(
    () => plans.map((plan) => ({ value: plan.id, label: `${plan.name}${plan.active ? "" : " (tạm dừng)"}` })),
    [plans],
  );

  const statusOptions = useMemo(
    () => Object.entries(WORKSPACE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );

  const fields: FieldDef[] = useMemo(
    () => [
      { name: "name", label: "Tên workspace", required: true, span: 2, placeholder: "Công ty TNHH An Phát" },
      { name: "plan_id", label: "Gói dịch vụ", type: "select", required: true, options: planOptions },
      { name: "workspace_status", label: "Trạng thái", type: "select", options: statusOptions },
      { name: "subscription_expires_at", label: "Ngày hết hạn", type: "date" },
      {
        name: "unlimited",
        label: "Không thời hạn",
        type: "select",
        options: [
          { value: "false", label: "Không — tính theo thời hạn gói" },
          { value: "true", label: "Có — không giới hạn thời gian" },
        ],
        hint: "Bỏ trống ngày hết hạn để hệ thống tự tính theo thời hạn gói kể từ hôm nay.",
      },
      ...(editing
        ? []
        : [
            {
              name: "admin_name",
              label: "Tên quản trị viên",
              placeholder: "Nguyễn Văn A",
            },
            {
              name: "admin_email",
              label: "Email quản trị viên",
              type: "email" as const,
              required: true,
              placeholder: "admin@congty.vn",
            },
            {
              name: "admin_phone",
              label: "Số điện thoại quản trị viên",
              type: "tel" as const,
              required: true,
              placeholder: "0901234567",
            },
          ]),
    ],
    [editing, planOptions, statusOptions],
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return workspaces.filter((workspace) => {
      if (statusFilter !== "all" && workspace.workspace_status !== statusFilter) return false;
      if (planFilter !== "all" && workspace.plan_id !== planFilter) return false;
      if (!keyword) return true;
      return `${workspace.name} ${workspace.plan_name ?? ""}`.toLowerCase().includes(keyword);
    });
  }, [planFilter, query, statusFilter, workspaces]);

  const stats = useMemo(() => {
    const expiring = workspaces.filter((workspace) => {
      const days = workspaceDaysLeft(workspace.subscription_expires_at);
      return days !== null && days >= 0 && days <= 30 && workspace.workspace_status !== "suspended";
    });
    return {
      total: workspaces.length,
      active: workspaces.filter((workspace) => workspace.workspace_status === "active").length,
      expiring: expiring.length,
      suspended: workspaces.filter((workspace) => workspace.workspace_status === "suspended").length,
    };
  }, [workspaces]);

  const handleSubmit = async (values: Record<string, string | number | null>) => {
    if (!values.name) throw new Error("Vui lòng nhập tên workspace.");
    const plan = plans.find((item) => item.id === values.plan_id) ?? null;
    const computedExpiry = (() => {
      if (String(values.unlimited ?? "false") === "true") return null;
      if (values.subscription_expires_at) return String(values.subscription_expires_at);
      if (!plan) return null;
      const date = new Date();
      if (plan.duration_days) date.setDate(date.getDate() + plan.duration_days);
      else date.setMonth(date.getMonth() + (plan.duration_months ?? 12));
      return date.toISOString().slice(0, 10);
    })();

    const payload = {
      name: String(values.name),
      plan_id: values.plan_id ? String(values.plan_id) : null,
      subscription_expires_at: computedExpiry,
      workspace_status: String(values.workspace_status ?? "active"),
    };

    if (editing) {
      await updateWorkspace(editing.id, payload);
      toast.success("Đã cập nhật workspace");
      setFormOpen(false);
      setEditing(null);
      await load();
      return;
    }

    const workspaceId = await createWorkspace({ ...payload, created_by: user?.id ?? null });
    const email = String(values.admin_email ?? "");
    const phone = String(values.admin_phone ?? "");
    const adminName = String(values.admin_name ?? "") || email.split("@")[0];

    const account = await provisionWorkspaceAdmin({
      company_id: workspaceId,
      full_name: adminName,
      email,
      phone,
    });

    setAdminInfo({
      name: String(values.name),
      email: account.email,
      phone: account.phone,
      password: account.temporary_password,
    });
    setFormOpen(false);
    await load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteConfirm.trim() !== deleteTarget.name.trim()) {
      toast.error("Tên workspace không khớp, chưa xoá.");
      return;
    }
    try {
      await deleteWorkspace(deleteTarget.id);
      toast.success("Đã xoá workspace");
      setDeleteTarget(null);
      setDeleteConfirm("");
      await load();
    } catch (error) {
      toast.error("Không xoá được workspace", { description: getErrorMessage(error) });
    }
  };

  const copyCredentials = async () => {
    if (!adminInfo) return;
    const text = `Workspace: ${adminInfo.name}\nEmail: ${adminInfo.email}\nĐiện thoại: ${adminInfo.phone}\nMật khẩu: ${adminInfo.password ?? "(dùng mật khẩu hiện có của tài khoản)"}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Đã sao chép thông tin tài khoản");
    } catch {
      toast.error("Không sao chép được, hãy chọn và sao chép thủ công.");
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
        title="Workspace"
        description="Tạo và quản lý workspace khách hàng, gói dịch vụ và ngày hết hạn."
        actions={
          <Button
            className="h-9 gap-1.5 text-[12.5px]"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Tạo workspace
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tổng workspace</p>
          <p className="mt-1 font-display text-[22px] font-semibold text-foreground">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Đang hoạt động</p>
          <p className="mt-1 font-display text-[22px] font-semibold text-success">{stats.active}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Sắp hết hạn 30 ngày</p>
          <p className="mt-1 font-display text-[22px] font-semibold text-warning">{stats.expiring}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tạm dừng</p>
          <p className="mt-1 font-display text-[22px] font-semibold text-foreground">{stats.suspended}</p>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm workspace, gói dịch vụ…"
              className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[12.5px] text-foreground shadow-xs outline-none placeholder:text-muted-foreground/80 focus:border-primary sm:w-[250px]"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground shadow-xs outline-none focus:border-primary"
          >
            <option value="all">Tất cả trạng thái</option>
            {Object.entries(WORKSPACE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={planFilter}
            onChange={(event) => setPlanFilter(event.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground shadow-xs outline-none focus:border-primary"
          >
            <option value="all">Tất cả gói</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>
        <span className="text-[11.5px] text-muted-foreground">{filtered.length} workspace</span>
      </Card>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải workspace…
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="mx-auto h-6 w-6 text-muted-foreground/70" />
          <p className="mt-2 text-[13px] font-semibold text-foreground">Chưa có workspace phù hợp</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Workspace</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Gói dịch vụ</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Thành viên</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Hết hạn</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Trạng thái</th>
                  <th className="w-[48px] px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((workspace) => {
                  const days = workspaceDaysLeft(workspace.subscription_expires_at);
                  return (
                    <tr key={workspace.id} className="border-t border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <p className="text-[12px] font-medium text-foreground">{workspace.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Tạo {new Date(workspace.created_at).toLocaleDateString("vi-VN")}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] text-foreground">{workspace.plan_name ?? "Chưa gán"}</td>
                      <td className="px-3 py-2.5 text-center text-[11.5px] text-muted-foreground">
                        {workspace.member_count}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-[11.5px] text-foreground">{formatDate(workspace.subscription_expires_at)}</p>
                        {days !== null && (
                          <p
                            className={`text-[10px] ${
                              days < 0 ? "text-destructive" : days <= 30 ? "text-warning" : "text-muted-foreground"
                            }`}
                          >
                            {days < 0 ? `Đã hết hạn ${-days} ngày` : `Còn ${days} ngày`}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge variant={statusTone(workspace)}>
                          {WORKSPACE_STATUS_LABELS[workspace.workspace_status] ?? workspace.workspace_status}
                        </Badge>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Thao tác workspace">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[210px]">
                            <DropdownMenuItem
                              className="gap-2 text-[12.5px]"
                              onSelect={() => {
                                setEditing(workspace);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                              onSelect={() => {
                                setDeleteTarget(workspace);
                                setDeleteConfirm("");
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Xoá workspace
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <FieldDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? "Sửa workspace" : "Tạo workspace mới"}
        description={
          editing
            ? "Cập nhật tên, gói dịch vụ và ngày hết hạn của workspace."
            : "Bắt buộc nhập email và số điện thoại để tạo hồ sơ nhân sự đầu tiên và lời mời tài khoản quản trị viên."
        }
        fields={fields}
        initial={
          editing
            ? {
                name: editing.name,
                plan_id: editing.plan_id ?? "",
                workspace_status: editing.workspace_status,
                subscription_expires_at: editing.subscription_expires_at ?? "",
                unlimited: editing.subscription_expires_at ? "false" : "true",
              }
            : { workspace_status: "active", plan_id: plans[0]?.id ?? "", unlimited: "false" }
        }
        submitLabel={editing ? "Lưu thay đổi" : "Tạo workspace"}
        onSubmit={handleSubmit}
      />

      <Dialog open={!!adminInfo} onOpenChange={(open) => !open && setAdminInfo(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Tạo tài khoản quản trị viên</DialogTitle>
            <DialogDescription>
              Workspace <span className="font-semibold text-foreground">{adminInfo?.name}</span>{" "}
              đã được tạo. Tài khoản quản trị viên đã được cấp và gắn vào vị trí “Quản lý” trong sơ đồ tổ chức.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-border bg-muted/25 px-3 py-2 text-[11.5px]">
                <p className="text-muted-foreground">Email đăng nhập</p>
                <p className="font-medium text-foreground">{adminInfo?.email}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/25 px-3 py-2 text-[11.5px]">
                <p className="text-muted-foreground">Số điện thoại</p>
                <p className="font-medium text-foreground">{adminInfo?.phone}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/25 px-3 py-2 text-[11.5px] sm:col-span-2">
                <p className="text-muted-foreground">Mật khẩu tạm (chỉ hiển thị một lần)</p>
                <p className="font-mono text-[15px] font-semibold text-foreground">
                  {adminInfo?.password ?? "Email đã có tài khoản, dùng mật khẩu hiện có"}
                </p>
              </div>
            </div>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Quản trị viên đăng nhập bằng email hoặc số điện thoại với mật khẩu trên. Mật khẩu được sinh ngẫu nhiên và
              không lưu lại, hãy sao chép ngay và gửi riêng cho quản trị viên; họ nên đổi mật khẩu sau lần đăng nhập đầu.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" className="h-9 gap-1.5" onClick={() => void copyCredentials()}>
              <Copy className="h-3.5 w-3.5" /> Sao chép thông tin
            </Button>
            <Button className="h-9" onClick={() => setAdminInfo(null)}>
              Xong
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ dữ liệu của workspace sẽ bị xoá vĩnh viễn. Nhập đúng tên workspace để xác nhận.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(event) => setDeleteConfirm(event.target.value)}
            placeholder={deleteTarget?.name}
            className="h-10"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              Xoá workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default Workspaces;
