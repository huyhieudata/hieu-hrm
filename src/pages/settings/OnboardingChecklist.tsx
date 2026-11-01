import { useCallback, useEffect, useState } from "react";
import { ListChecks, Loader2, MoreHorizontal, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  getOnboardingFormUrl,
  removeOnboardingForm,
  uploadOnboardingForm,
  createSetting,
  deleteSetting,
  listOnboardingTemplates,
  updateSetting,
  type OnboardingTemplate,
} from "@/lib/settings";

const fields: FieldDef[] = [
  { name: "label", label: "Tên bước", required: true, span: 2, placeholder: "Bàn giao thiết bị" },
  { name: "description", label: "Mô tả", type: "textarea" },
  {
    name: "required",
    label: "Bắt buộc",
    type: "select",
    options: [
      { value: "true", label: "Bắt buộc" },
      { value: "false", label: "Không bắt buộc" },
    ],
  },
  { name: "sort_order", label: "Thứ tự", type: "number", placeholder: "1" },
];

const OnboardingChecklist = () => {
  const { activeCompany, can, canManageModule } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canManage = canManageModule("settings");

  const [items, setItems] = useState<OnboardingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OnboardingTemplate | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OnboardingTemplate | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setItems(await listOnboardingTemplates(companyId));
    } catch (error) {
      toast.error("Không tải được checklist", {
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
      description: values.description,
      required: String(values.required ?? "true") === "true",
      sort_order: Number(values.sort_order ?? 0),
    };

    try {
      if (editing) {
        await updateSetting("onboarding_checklist_templates", editing.id, payload);
        toast.success("Đã cập nhật bước hội nhập");
      } else {
        await createSetting("onboarding_checklist_templates", { ...payload, company_id: companyId });
        toast.success("Đã thêm bước hội nhập");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Không lưu được.");
    }
  };

  const handleUploadAttachment = async (item: OnboardingTemplate, file: File | undefined) => {
    if (!file || !companyId) return;
    try {
      const { path, name } = await uploadOnboardingForm(companyId, file);
      if (item.attachment_path) await removeOnboardingForm(item.attachment_path);
      await updateSetting("onboarding_checklist_templates", item.id, {
        attachment_path: path,
        attachment_name: name,
      });
      toast.success("Đã đính kèm tài liệu", { description: name });
      await load();
    } catch (uploadError) {
      toast.error("Không tải được tài liệu", {
        description: uploadError instanceof Error ? uploadError.message : undefined,
      });
    }
  };

  const handleOpenAttachment = async (path: string) => {
    try {
      const url = await getOnboardingFormUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Không mở được tài liệu");
    }
  };

  const handleRemoveAttachment = async (item: OnboardingTemplate) => {
    try {
      if (item.attachment_path) await removeOnboardingForm(item.attachment_path);
      await updateSetting("onboarding_checklist_templates", item.id, {
        attachment_path: null,
        attachment_name: null,
      });
      toast.success("Đã xoá tài liệu đính kèm");
      await load();
    } catch {
      toast.error("Không xoá được tài liệu");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteSetting("onboarding_checklist_templates", pendingDelete.id);
      toast.success("Đã xoá bước hội nhập");
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
      title="Checklist hội nhập"
      description="Các bước chuẩn khi tiếp nhận nhân sự mới — hiển thị tự động trong form Tiếp nhận."
      actions={
        canManage && (
          <Button
            className="h-9 gap-1.5 text-[12.5px]"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Thêm bước
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
            <ListChecks className="mx-auto h-6 w-6 text-muted-foreground/70" />
            <p className="mt-2.5 text-[13.5px] font-semibold text-foreground">Chưa có bước hội nhập</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Thêm các bước như ký hợp đồng, bàn giao thiết bị, tạo tài khoản…
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
                    {item.description ?? "Không có mô tả"}
                  </p>
                </div>
                <Badge variant={item.required ? "warning" : "muted"}>
                  {item.required ? "Bắt buộc" : "Tuỳ chọn"}
                </Badge>
                {item.attachment_path && (
                  <button
                    type="button"
                    onClick={() => void handleOpenAttachment(item.attachment_path as string)}
                    className="inline-flex max-w-[160px] items-center gap-1 truncate text-[11px] text-primary hover:underline"
                    title={item.attachment_name ?? "Tài liệu đính kèm"}
                  >
                    <Paperclip className="h-3 w-3 shrink-0" />
                    <span className="truncate">{item.attachment_name ?? "Tài liệu"}</span>
                  </button>
                )}
                {canManage && (
                  <label
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    title="Đính kèm tài liệu / biểu mẫu"
                  >
                    <Paperclip className="h-3 w-3" />
                    {item.attachment_path ? "Thay" : "Đính kèm"}
                    <input
                      type="file"
                      className="hidden"
                      onChange={(event) => {
                        void handleUploadAttachment(item, event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                )}
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
                      {item.attachment_path && (
                        <DropdownMenuItem
                          className="gap-2 text-[12.5px]"
                          onSelect={() => void handleRemoveAttachment(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Xoá tài liệu đính kèm
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="gap-2 text-[12.5px] text-destructive focus:bg-destructive-subtle focus:text-destructive"
                        onSelect={() => setPendingDelete(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Xoá bước
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
        title={editing ? "Sửa bước hội nhập" : "Thêm bước hội nhập"}
        fields={fields}
        initial={
          editing
            ? { ...editing, required: editing.required ? "true" : "false" }
            : { required: "true", sort_order: items.length + 1 }
        }
        submitLabel={editing ? "Lưu thay đổi" : "Thêm bước"}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá bước hội nhập?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.label} sẽ không còn hiển thị trong form tiếp nhận nhân sự mới.
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

export default OnboardingChecklist;
