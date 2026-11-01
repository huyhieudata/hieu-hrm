import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Network,
  Pencil,
  Plus,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { FieldDialog, type FieldDef } from "@/components/employee/field-dialog";
import { SettingsShell } from "@/components/settings/settings-shell";
import { orgTabs } from "@/components/settings/settings-tabs";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/lib/company-provider";
import { JOB_LEVELS, listEmployees, type EmployeeRecord } from "@/lib/employee-records";
import {
  createSetting,
  deleteSetting,
  listDepartmentPositions,
  listDepartments,
  updateSetting,
  type DepartmentPosition,
  type DepartmentRecord,
} from "@/lib/settings";
import { cn } from "@/lib/utils";

const buildFields = (
  departments: DepartmentRecord[],
  employees: EmployeeRecord[],
  editing: DepartmentRecord | null,
): FieldDef[] => {
  const blocked = new Set<string>();
  if (editing) {
    blocked.add(editing.id);
    const collect = (parentId: string) => {
      departments
        .filter((department) => department.parent_id === parentId)
        .forEach((child) => {
          blocked.add(child.id);
          collect(child.id);
        });
    };
    collect(editing.id);
  }

  return [
    { name: "name", label: "Tên phòng ban", required: true, placeholder: "Kỹ thuật" },
    {
      name: "parent_id",
      label: "Phòng ban cấp trên",
      type: "select",
      options: departments
        .filter((department) => !blocked.has(department.id))
        .map((department) => ({ value: department.id, label: department.name })),
      hint: "Để trống nếu là phòng ban gốc.",
    },
    {
      name: "manager_employee_id",
      label: "Trưởng phòng / Quản lý",
      type: "select",
      options: employees.map((employee) => ({
        value: employee.id,
        label: `${employee.full_name}${employee.position ? ` · ${employee.position}` : ""}`,
      })),
      hint: "Người này tự hiện là quản lý khi tiếp nhận nhân sự mới thuộc phòng ban.",
    },
    { name: "description", label: "Mô tả chức năng", type: "textarea" },
    { name: "sort_order", label: "Thứ tự hiển thị", type: "number", placeholder: "1" },
  ];
};

const positionFields: FieldDef[] = [
  { name: "title", label: "Tên vị trí", required: true, span: 2, placeholder: "Backend Engineer" },
  {
    name: "level",
    label: "Cấp bậc",
    type: "select",
    options: JOB_LEVELS.map((level) => ({ value: level, label: level })),
  },
  {
    name: "is_management",
    label: "Vị trí quản lý bộ phận",
    type: "select",
    options: [
      { value: "true", label: "Có — là vị trí quản lý" },
      { value: "false", label: "Không" },
    ],
    hint: "Có thể đánh dấu nhiều vị trí quản lý trong cùng phòng ban.",
  },
  { name: "sort_order", label: "Thứ tự", type: "number", placeholder: "1" },
  { name: "description", label: "Mô tả", type: "textarea" },
];

interface PositionsDialogProps {
  department: DepartmentRecord | null;
  positions: DepartmentPosition[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  onChanged: () => void | Promise<void>;
}

const PositionsDialog = ({ department, positions, open, onOpenChange, canManage, onChanged }: PositionsDialogProps) => {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentPosition | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DepartmentPosition | null>(null);

  const handleSave = async (values: Record<string, string | number | null>) => {
    if (!department) return;
    const payload = {
      ...values,
      is_management: String(values.is_management ?? "false") === "true",
    };
    try {
      if (editing) {
        await updateSetting("department_positions", editing.id, payload);
        toast.success("Đã cập nhật vị trí");
      } else {
        await createSetting("department_positions", {
          ...payload,
          company_id: department.company_id,
          department_id: department.id,
        });
        toast.success("Đã thêm vị trí");
      }
      setFormOpen(false);
      setEditing(null);
      await onChanged();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Không lưu được vị trí.");
    }
  };

  const toggleManagement = async (position: DepartmentPosition, checked: boolean) => {
    try {
      await updateSetting("department_positions", position.id, { is_management: checked });
      toast.success(checked ? "Đã đánh dấu vị trí quản lý" : "Đã bỏ đánh dấu quản lý", {
        description: position.title,
      });
      await onChanged();
    } catch (error) {
      toast.error("Không cập nhật được", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteSetting("department_positions", pendingDelete.id);
      toast.success("Đã xoá vị trí");
      setPendingDelete(null);
      await onChanged();
    } catch (error) {
      toast.error("Không xoá được", { description: error instanceof Error ? error.message : undefined });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Vị trí — {department?.name}</DialogTitle>
            <DialogDescription>Các vị trí công việc thuộc phòng ban này.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                className="h-9 w-full gap-1.5 text-[12px]"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Thêm vị trí
              </Button>
            )}

            {positions.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-[12px] text-muted-foreground">
                Phòng ban chưa có vị trí nào.
              </p>
            ) : (
              <ul className="divide-y divide-border/60 rounded-md border border-border">
                {positions.map((position) => (
                  <li key={position.id} className="flex items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-[12.5px] font-medium text-foreground">
                        <span className="truncate">{position.title}</span>
                        {position.is_management && <Badge variant="subtle">Quản lý</Badge>}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {position.level ?? "Chưa xếp cấp bậc"}
                        {position.description ? ` · ${position.description}` : ""}
                      </p>
                    </div>
                    <label
                      className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${
                        position.is_management
                          ? "border-primary/30 bg-primary-subtle text-primary-subtle-foreground"
                          : "border-border bg-card text-muted-foreground"
                      } ${canManage ? "cursor-pointer" : ""}`}
                      title="Đánh dấu là vị trí quản lý bộ phận"
                    >
                      <Checkbox
                        checked={position.is_management}
                        disabled={!canManage}
                        onCheckedChange={(checked) => void toggleManagement(position, checked === true)}
                        className="h-3.5 w-3.5"
                      />
                      Quản lý
                    </label>
                    {canManage && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Sửa ${position.title}`}
                          onClick={() => {
                            setEditing(position);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Xoá ${position.title}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setPendingDelete(position)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FieldDialog
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditing(null);
        }}
        title={editing ? "Sửa vị trí" : "Thêm vị trí"}
        description={`Phòng ban: ${department?.name ?? ""}`}
        fields={positionFields}
        initial={
          editing
            ? { ...editing, is_management: editing.is_management ? "true" : "false" }
            : { sort_order: positions.length + 1, is_management: "false" }
        }
        submitLabel={editing ? "Lưu thay đổi" : "Thêm vị trí"}
        onSubmit={handleSave}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(next) => !next && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá vị trí?</AlertDialogTitle>
            <AlertDialogDescription>
              Vị trí {pendingDelete?.title} sẽ bị xoá khỏi phòng ban {department?.name}.
            </AlertDialogDescription>
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
    </>
  );
};

const OrgStructure = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("settings");

  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [positions, setPositions] = useState<DepartmentPosition[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"tree" | "list">("tree");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DepartmentRecord | null>(null);
  const [positionsFor, setPositionsFor] = useState<DepartmentRecord | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [deptRows, positionRows, employeeRows] = await Promise.all([
        listDepartments(companyId),
        listDepartmentPositions(companyId),
        listEmployees(companyId),
      ]);
      setDepartments(deptRows);
      setPositions(positionRows);
      setEmployees(employeeRows);
    } catch (error) {
      toast.error("Không tải được cơ cấu tổ chức", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const headcounts = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach((employee) => {
      if (employee.department) counts[employee.department] = (counts[employee.department] ?? 0) + 1;
    });
    return counts;
  }, [employees]);

  const positionsByDepartment = useMemo(() => {
    const grouped: Record<string, DepartmentPosition[]> = {};
    positions.forEach((position) => {
      grouped[position.department_id] = [...(grouped[position.department_id] ?? []), position];
    });
    return grouped;
  }, [positions]);

  const childrenOf = useCallback(
    (parentId: string | null) =>
      departments
        .filter((department) => (department.parent_id ?? null) === parentId)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [departments],
  );

  const roots = useMemo(
    () =>
      departments.filter(
        (department) => !department.parent_id || !departments.some((item) => item.id === department.parent_id),
      ),
    [departments],
  );

  const handleSubmit = async (values: Record<string, string | number | null>) => {
    if (!companyId) throw new Error("Chưa chọn công ty.");
    const managerId = values.manager_employee_id ? String(values.manager_employee_id) : null;
    const manager = employees.find((employee) => employee.id === managerId);

    const payload = {
      name: values.name,
      manager_employee_id: managerId,
      manager_name: manager?.full_name ?? null,
      parent_id: values.parent_id ? String(values.parent_id) : null,
      description: values.description,
      sort_order: Number(values.sort_order ?? 0),
    };

    try {
      if (editing) {
        await updateSetting("departments", editing.id, payload);
        toast.success("Đã cập nhật phòng ban");
      } else {
        await createSetting("departments", { ...payload, company_id: companyId });
        toast.success("Đã thêm phòng ban");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không lưu được.";
      throw new Error(message.includes("duplicate key") ? "Phòng ban này đã tồn tại." : message);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteSetting("departments", pendingDelete.id);
      toast.success("Đã xoá phòng ban");
      setPendingDelete(null);
      await load();
    } catch (error) {
      toast.error("Không xoá được", { description: error instanceof Error ? error.message : undefined });
    }
  };

  const parentName = (department: DepartmentRecord) =>
    departments.find((item) => item.id === department.parent_id)?.name ?? null;

  const renderNode = (department: DepartmentRecord, depth: number) => {
    const children = childrenOf(department.id);
    const positionsOfDepartment = positionsByDepartment[department.id] ?? [];

    return (
      <li key={department.id} className="relative">
        <div
          className={cn(
            "group rounded-lg border border-border bg-card p-3.5 shadow-xs transition-colors hover:border-primary/30",
            depth > 0 && "ml-5",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-subtle text-primary-subtle-foreground">
                <Network className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-foreground">{department.name}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <UserCog className="h-3 w-3" /> {department.manager_name ?? "Chưa gán quản lý"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> {headcounts[department.name] ?? 0} nhân sự
                  </span>
                  <span>{positionsOfDepartment.length} vị trí</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-[11px]"
                onClick={() => setPositionsFor(department)}
              >
                Vị trí
              </Button>
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Thao tác ${department.name}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[200px]">
                    <DropdownMenuItem
                      className="gap-2 text-[12.5px]"
                      onSelect={() => {
                        setEditing(department);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2 text-[12.5px]"
                      onSelect={() => setPositionsFor(department)}
                    >
                      <Network className="h-3.5 w-3.5" /> Quản lý vị trí
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                      onSelect={() => setPendingDelete(department)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Xoá phòng ban
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {positionsOfDepartment.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {positionsOfDepartment.slice(0, 4).map((position) => (
                <span
                  key={position.id}
                  className={
                    position.is_management
                      ? "inline-flex items-center gap-1 rounded-full bg-primary-subtle px-2 py-0.5 text-[11px] font-semibold text-primary-subtle-foreground"
                      : "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  }
                >
                  {position.title}
                </span>
              ))}
              {positionsOfDepartment.length > 4 && (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  +{positionsOfDepartment.length - 4}
                </span>
              )}
            </div>
          )}
        </div>

        {children.length > 0 && (
          <ul className="relative mt-2 space-y-2 border-l border-border pl-4">
            {children.map((child) => renderNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <SettingsShell
      tabs={orgTabs}
      title="Cơ cấu tổ chức"
      description="Phòng ban, phòng ban cấp trên, người quản lý và danh sách vị trí — dùng tự động khi tiếp nhận nhân sự."
      actions={
        canManage && (
          <Button
            className="h-9 gap-1.5 text-[12.5px]"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Thêm phòng ban
          </Button>
        )
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-md border border-border bg-card p-1 shadow-xs">
          {[
            { id: "tree", label: "Sơ đồ tổ chức" },
            { id: "list", label: "Danh sách" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id as "tree" | "list")}
              className={cn(
                "rounded px-3 py-1.5 text-[11.5px] font-medium transition-colors",
                view === item.id
                  ? "bg-primary-subtle text-primary-subtle-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[11.5px] text-muted-foreground">
          <span>{departments.length} phòng ban</span>
          <span>·</span>
          <span>{positions.length} vị trí</span>
        </div>
      </div>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-12 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải cơ cấu tổ chức…
        </Card>
      ) : departments.length === 0 ? (
        <Card className="p-12 text-center">
          <Network className="mx-auto h-6 w-6 text-muted-foreground/70" />
          <p className="mt-2 text-[13px] font-semibold text-foreground">Chưa có phòng ban</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Thêm phòng ban đầu tiên để bắt đầu sơ đồ tổ chức.</p>
        </Card>
      ) : view === "tree" ? (
        <Card className="p-4 sm:p-5">
          <ul className="space-y-3">{roots.map((root) => renderNode(root, 0))}</ul>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {departments.map((department) => (
            <Card key={department.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[14px] font-semibold text-foreground">{department.name}</h3>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {headcounts[department.name] ?? 0} nhân sự · {(positionsByDepartment[department.id] ?? []).length} vị trí
                  </p>
                  {parentName(department) && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <ChevronRight className="h-2.5 w-2.5" /> Thuộc {parentName(department)}
                    </p>
                  )}
                </div>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Thao tác ${department.name}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[200px]">
                      <DropdownMenuItem
                        className="gap-2 text-[12.5px]"
                        onSelect={() => {
                          setEditing(department);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 text-[12.5px]" onSelect={() => setPositionsFor(department)}>
                        <Network className="h-3.5 w-3.5" /> Quản lý vị trí
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                        onSelect={() => setPendingDelete(department)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Xoá phòng ban
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                <UserCog className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Người quản lý
                  </p>
                  <p className="truncate text-[12px] font-medium text-foreground">
                    {department.manager_name ?? "Chưa gán"}
                  </p>
                </div>
                {!department.manager_name && <Badge variant="warning">Chưa gán</Badge>}
              </div>

              {(positionsByDepartment[department.id] ?? []).length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {(positionsByDepartment[department.id] ?? []).map((position) => (
                    <span
                      key={position.id}
                      className={
                        position.is_management
                          ? "inline-flex items-center rounded-full bg-primary-subtle px-2 py-0.5 text-[11px] font-semibold text-primary-subtle-foreground"
                          : "inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                      }
                    >
                      {position.title}
                    </span>
                  ))}
                </div>
              )}

              {department.description && (
                <p className="mt-3 text-[11.5px] leading-5 text-muted-foreground">{department.description}</p>
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
        title={editing ? "Sửa phòng ban" : "Thêm phòng ban"}
        description="Có thể gán phòng ban cấp trên để tạo sơ đồ tổ chức nhiều tầng."
        fields={buildFields(departments, employees, editing)}
        initial={editing ?? { sort_order: departments.length + 1 }}
        submitLabel={editing ? "Lưu thay đổi" : "Thêm phòng ban"}
        onSubmit={handleSubmit}
      />

      <PositionsDialog
        department={positionsFor}
        positions={positionsFor ? positionsByDepartment[positionsFor.id] ?? [] : []}
        open={!!positionsFor}
        onOpenChange={(open) => !open && setPositionsFor(null)}
        canManage={canManage}
        onChanged={load}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá phòng ban?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} và các vị trí của phòng ban sẽ bị xoá. Nhân sự và phòng ban con vẫn giữ nguyên
              (phòng ban con trở thành phòng ban gốc).
            </AlertDialogDescription>
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
    </SettingsShell>
  );
};

export default OrgStructure;
