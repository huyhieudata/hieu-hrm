import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { FieldDialog, type FieldDef } from "@/components/employee/field-dialog";
import { SettingsShell } from "@/components/settings/settings-shell";
import { checklistTabs } from "@/components/settings/settings-tabs";
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
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/employee-records";
import {
  createSetting,
  deleteSetting,
  listDocumentChecklist,
  updateSetting,
  type DocumentChecklistTemplate,
} from "@/lib/settings";

const fields: FieldDef[] = [
  { name: "label", label: "Tên hạng mục", required: true, span: 2, placeholder: "Sổ bảo hiểm xã hội" },
  {
    name: "category",
    label: "Loại tài liệu",
    type: "select",
    options: Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
    hint: "Hạng mục tự động được tích khi có tệp cùng loại tài liệu.",
  },
  {
    name: "required",
    label: "Bắt buộc",
    type: "select",
    options: [
      { value: "true", label: "Bắt buộc" },
      { value: "false", label: "Tuỳ chọn" },
    ],
  },
  { name: "sort_order", label: "Thứ tự", type: "number", placeholder: "1" },
];

const DocumentChecklist = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("settings");

  const [items, setItems] = useState<DocumentChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentChecklistTemplate | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentChecklistTemplate | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setItems(await listDocumentChecklist(companyId));
    } catch (error) {
      toast.error("Không tải được checklist hồ sơ", {
        description: error instanceof Error ? error.message : undefined,
      });
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
      label: values.label,
      category: values.category ?? "other",
      required: String(values.required ?? "true") === "true",
      sort_order: Number(values.sort_order ?? 0),
    };

    try {
      if (editing) {
        await updateSetting("document_checklist_templates", editing.id, payload);
        toast.success("Đã cập nhật hạng mục");
      } else {
        await createSetting("document_checklist_templates", { ...payload, company_id: companyId });
        toast.success("Đã thêm hạng mục");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Không lưu được.");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteSetting("document_checklist_templates", pendingDelete.id);
      toast.success("Đã xoá hạng mục");
      setPendingDelete(null);
      await load();
    } catch (error) {
      toast.error("Không xoá được", { description: error instanceof Error ? error.message : undefined });
    }
  };

  return (
    <SettingsShell
      eyebrow="Cài đặt check list"
      tabs={checklistTabs}
      title="Checklist hồ sơ nhân sự"
      description="Tuỳ chỉnh danh sách giấy tờ bắt buộc — hiển thị trong tab Tài liệu của hồ sơ nhân viên."
      actions={
        canManage && (
          <Button
            className="h-9 gap-1.5 text-[12.5px]"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Thêm hạng mục
          </Button>
        )
      }
    >
      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-12 text-[12.5px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải checklist…
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <FolderOpen className="mx-auto h-6 w-6 text-muted-foreground/70" />
            <p className="mt-2.5 text-[13.5px] font-semibold text-foreground">Chưa có hạng mục nào</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Thêm hạng mục giấy tờ như hợp đồng, CCCD, bằng cấp…
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((item, index) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-[11px] font-semibold text-primary-subtle-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-foreground">{item.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {DOCUMENT_CATEGORY_LABELS[item.category] ?? item.category}
                  </p>
                </div>
                <Badge variant={item.required ? "warning" : "muted"}>
                  {item.required ? "Bắt buộc" : "Tuỳ chọn"}
                </Badge>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Thao tác ${item.label}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[190px]">
                      <DropdownMenuItem
                        className="gap-2 text-[12.5px]"
                        onSelect={() => {
                          setEditing(item);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                        onSelect={() => setPendingDelete(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Xoá hạng mục
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <FieldDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? "Sửa hạng mục hồ sơ" : "Thêm hạng mục hồ sơ"}
        description="Mỗi hạng mục gắn với một loại tài liệu để tự động tích khi đã tải tệp."
        fields={fields}
        initial={
          editing
            ? { ...editing, required: editing.required ? "true" : "false" }
            : { required: "true", category: "contract", sort_order: items.length + 1 }
        }
        submitLabel={editing ? "Lưu thay đổi" : "Thêm hạng mục"}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá hạng mục?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.label} sẽ không còn hiển thị trong checklist hồ sơ nhân viên.
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

export default DocumentChecklist;
