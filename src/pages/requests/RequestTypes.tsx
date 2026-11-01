import { useCallback, useEffect, useState } from "react";
import { FileCog, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
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
import { useCompany } from "@/lib/company-provider";
import { getErrorMessage } from "@/lib/utils";
import {
  createRequestType,
  deleteRequestType,
  listRequestTypes,
  REQUEST_CATEGORY_LABELS,
  updateRequestType,
  type RequestType,
} from "@/lib/requests";

const typeFields: FieldDef[] = [
  { name: "name", label: "Tên loại đơn", required: true, placeholder: "Nghỉ phép năm" },
  {
    name: "category",
    label: "Nhóm xử lý bảng công",
    type: "select",
    options: Object.entries(REQUEST_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
    hint: "Nhóm quyết định cách cập nhật bảng công khi đơn được duyệt.",
  },
  {
    name: "requires_attachment",
    label: "Yêu cầu hồ sơ đính kèm",
    type: "select",
    options: [
      { value: "false", label: "Không" },
      { value: "true", label: "Có" },
    ],
  },
  {
    name: "deduct_leave",
    label: "Trừ ngày phép năm",
    type: "select",
    options: [
      { value: "false", label: "Không trừ" },
      { value: "true", label: "Có trừ" },
    ],
  },
  { name: "max_days", label: "Số ngày tối đa", type: "number", placeholder: "Không giới hạn" },
  { name: "sort_order", label: "Thứ tự hiển thị", type: "number", placeholder: "1" },
  {
    name: "active",
    label: "Trạng thái",
    type: "select",
    options: [
      { value: "true", label: "Đang dùng" },
      { value: "false", label: "Tạm dừng" },
    ],
  },
];

const RequestTypes = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("requests");

  const [types, setTypes] = useState<RequestType[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RequestType | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RequestType | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setTypes(await listRequestTypes(companyId));
    } catch (error) {
      toast.error("Không tải được loại đơn", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (values: Record<string, string | number | null>) => {
    if (!companyId) throw new Error("Chưa chọn công ty.");
    const payload = {
      name: values.name,
      category: values.category ?? "other",
      deduct_leave: String(values.deduct_leave ?? "false") === "true",
      requires_attachment: String(values.requires_attachment ?? "false") === "true",
      max_days: values.max_days === null ? null : Number(values.max_days),
      sort_order: Number(values.sort_order ?? types.length + 1),
      active: String(values.active ?? "true") === "true",
    };

    try {
      if (editing) {
        await updateRequestType(editing.id, payload);
        toast.success("Đã cập nhật loại đơn");
      } else {
        await createRequestType({ ...payload, company_id: companyId });
        toast.success("Đã thêm loại đơn");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const hasOvertime = types.some((type) => type.category === "overtime");
  const [addingOt, setAddingOt] = useState(false);
  const handleAddOvertime = async () => {
    if (!companyId || hasOvertime) return;
    setAddingOt(true);
    try {
      await createRequestType({
        company_id: companyId,
        name: "Tăng ca",
        category: "overtime",
        deduct_leave: false,
        requires_attachment: false,
        max_days: null,
        sort_order: types.length + 1,
        active: true,
      });
      toast.success("Đã thêm loại đơn Tăng ca", {
        description: "Nhân viên có thể gửi đơn tăng ca; đơn đã duyệt được tính tiền OT trong bảng lương.",
      });
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAddingOt(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteRequestType(pendingDelete.id);
      toast.success("Đã xoá loại đơn");
      setPendingDelete(null);
      await load();
    } catch (error) {
      toast.error("Không xoá được", {
        description: "Loại đơn đã được dùng trong đơn từ nên không thể xoá; hãy tạm dừng thay vì xoá.",
      });
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Đơn từ"
        title="Loại đơn"
        description="Thiết lập các loại đơn và cách cập nhật bảng công khi đơn được duyệt."
        actions={
          canManage && (
            <div className="flex flex-wrap gap-2">
            {!loading && !hasOvertime && (
              <Button
                variant="outline"
                className="h-9 gap-1.5 text-[12.5px]"
                disabled={addingOt}
                onClick={() => void handleAddOvertime()}
              >
                {addingOt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Thêm loại đơn Tăng ca
              </Button>
            )}
            <Button
              className="h-9 gap-1.5 text-[12.5px]"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Thêm loại đơn
            </Button>
            </div>
          )
        }
      />

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải loại đơn…
        </Card>
      ) : types.length === 0 ? (
        <Card className="p-12 text-center">
          <FileCog className="mx-auto h-6 w-6 text-muted-foreground/70" />
          <p className="mt-2 text-[13px] font-semibold text-foreground">Chưa có loại đơn</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Thêm loại đơn để nhân sự có thể gửi đơn.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border/60">
            {types.map((type) => (
              <li key={type.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-subtle text-primary-subtle-foreground">
                  <FileCog className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-foreground">{type.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {REQUEST_CATEGORY_LABELS[type.category] ?? type.category}
                    {type.max_days ? ` · tối đa ${type.max_days} ngày` : ""}
                    {type.deduct_leave ? " · trừ ngày phép" : ""}
                    {type.requires_attachment ? " · cần hồ sơ đính kèm" : ""}
                  </p>
                </div>
                <Badge variant={type.active ? "success" : "muted"}>{type.active ? "Đang dùng" : "Tạm dừng"}</Badge>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Thao tác ${type.name}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[190px]">
                      <DropdownMenuItem
                        className="gap-2 text-[12.5px]"
                        onSelect={() => {
                          setEditing(type);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                        onSelect={() => setPendingDelete(type)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Xoá loại đơn
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <FieldDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? "Sửa loại đơn" : "Thêm loại đơn"}
        description="Nhóm xử lý quyết định đơn duyệt xong sẽ ghi gì vào bảng công."
        fields={typeFields}
        initial={
          editing
            ? {
                ...editing,
                deduct_leave: editing.deduct_leave ? "true" : "false",
                requires_attachment: editing.requires_attachment ? "true" : "false",
                active: editing.active ? "true" : "false",
              }
            : {
                category: "leave",
                deduct_leave: "false",
                requires_attachment: "false",
                active: "true",
                sort_order: types.length + 1,
              }
        }
        submitLabel={editing ? "Lưu thay đổi" : "Thêm loại đơn"}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá loại đơn?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} sẽ bị xoá. Loại đơn đã dùng trong đơn từ không thể xoá — hãy tạm dừng thay thế.
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
    </AppShell>
  );
};

export default RequestTypes;
