import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, KeyRound, Loader2, MoreHorizontal, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/utils";
import { usePlatformAdmin } from "@/lib/platform";
import {
  CRUD_ACTIONS,
  PERMISSION_MODULES,
  createPermissionGroup,
  expandLegacyPermissions,
  modulePermissionKeys,
  permissionKey,
  permissionLabel,
  deletePermissionGroup,
  listPermissionGroups,
  updatePermissionGroup,
  type PermissionGroup,
} from "@/lib/permissions";
import type { Permission } from "@/lib/roles";

const PermissionGroups = () => {
  const { isPlatformAdmin, loading: checkingAccess } = usePlatformAdmin();
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PermissionGroup | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PermissionGroup | null>(null);

  const load = useCallback(async () => {
    if (!isPlatformAdmin) return;
    setLoading(true);
    try {
      setGroups(await listPermissionGroups());
    } catch (loadError) {
      toast.error("Không tải được nhóm quyền", { description: getErrorMessage(loadError) });
    } finally {
      setLoading(false);
    }
  }, [isPlatformAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEditor = (group: PermissionGroup | null) => {
    setEditing(group);
    setName(group?.name ?? "");
    setDescription(group?.description ?? "");
    setSelected(expandLegacyPermissions(group?.permissions ?? []));
    setError(null);
    setFormOpen(true);
  };

  const togglePermission = (permission: string) =>
    setSelected((prev) =>
      prev.includes(permission) ? prev.filter((item) => item !== permission) : [...prev, permission],
    );

  const toggleGroup = (permissions: string[]) => {
    const allSelected = permissions.every((permission) => selected.includes(permission));
    setSelected((prev) =>
      allSelected
        ? prev.filter((item) => !permissions.includes(item))
        : Array.from(new Set([...prev, ...permissions])),
    );
  };

  const save = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Vui lòng nhập tên nhóm quyền.");
      return;
    }
    if (selected.length === 0) {
      setError("Chọn ít nhất một quyền cho nhóm.");
      return;
    }

    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim() || null, permissions: selected };
      if (editing) {
        await updatePermissionGroup(editing.id, payload);
        toast.success("Đã cập nhật nhóm quyền");
      } else {
        await createPermissionGroup(payload);
        toast.success("Đã tạo nhóm quyền");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const removeGroup = async () => {
    if (!pendingDelete) return;
    try {
      await deletePermissionGroup(pendingDelete.id);
      toast.success("Đã xoá nhóm quyền");
      setPendingDelete(null);
      await load();
    } catch (deleteError) {
      toast.error("Không xoá được nhóm quyền", { description: getErrorMessage(deleteError) });
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
        title="Phân quyền"
        description="Tạo các nhóm quyền dùng chung và tích chọn quyền chi tiết cho từng nhóm."
        actions={
          <Button className="h-9 gap-1.5 text-[12.5px]" onClick={() => openEditor(null)}>
            <Plus className="h-4 w-4" /> Thêm nhóm quyền
          </Button>
        }
      />

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải nhóm quyền…
        </Card>
      ) : groups.length === 0 ? (
        <Card className="p-12 text-center">
          <KeyRound className="mx-auto h-6 w-6 text-muted-foreground/70" />
          <p className="mt-2 text-[13px] font-semibold text-foreground">Chưa có nhóm quyền</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Tạo nhóm đầu tiên để gán cho nhân sự.</p>
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">{group.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {group.description ?? `${group.permissions.length} quyền`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="muted">{group.permissions.length} quyền</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Thao tác ${group.name}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[180px]">
                      <DropdownMenuItem className="gap-2 text-[12.5px]" onSelect={() => openEditor(group)}>
                        <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                        onSelect={() => setPendingDelete(group)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Xoá nhóm
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {group.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-md bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground"
                  >
                    {permissionLabel(permission)}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa nhóm quyền" : "Thêm nhóm quyền"}</DialogTitle>
            <DialogDescription>Tích chọn các quyền áp dụng cho nhóm này.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[12px]">Tên nhóm</Label>
                <Input value={name} onChange={(event) => setName(event.target.value)} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Mô tả</Label>
                <Input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="h-10"
                  placeholder="Mô tả ngắn"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <span>Hạng mục</span>
                <div className="flex gap-3 pr-1">
                  {CRUD_ACTIONS.map((action) => (
                    <span key={action.key} className="w-9 text-center">
                      {action.label}
                    </span>
                  ))}
                </div>
              </div>

              {PERMISSION_MODULES.map((module) => {
                const keys = modulePermissionKeys(module.key);
                const allSelected = keys.every((key) => selected.includes(key));
                return (
                  <div
                    key={module.key}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(keys)}
                      className="flex min-w-0 items-center gap-2 text-left"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          allSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                        }`}
                      >
                        {allSelected && <Check className="h-3 w-3" />}
                      </span>
                      <span className="truncate text-[11.5px] font-medium text-foreground">{module.label}</span>
                    </button>

                    <div className="flex gap-3">
                      {CRUD_ACTIONS.map((action) => {
                        const key = permissionKey(module.key, action.key);
                        const checked = selected.includes(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => togglePermission(key)}
                            aria-label={`${module.label} · ${action.label}`}
                            className="flex w-9 justify-center"
                          >
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded border ${
                                checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                              }`}
                            >
                              {checked && <Check className="h-3 w-3" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-[11.5px] text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="h-9" onClick={() => setFormOpen(false)} disabled={saving}>
              Huỷ
            </Button>
            <Button className="h-9 gap-2" onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editing ? "Lưu thay đổi" : "Thêm nhóm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá nhóm quyền?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} sẽ bị xoá; nhân sự đang dùng nhóm này vẫn giữ quyền đã gán trước đó.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void removeGroup()}
            >
              Xoá nhóm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default PermissionGroups;
