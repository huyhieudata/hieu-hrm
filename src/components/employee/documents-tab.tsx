import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Loader2,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DOCUMENT_CATEGORY_LABELS,
  EMPLOYEE_DOCUMENT_MAX_BYTES,
  deleteEmployeeDocument,
  fetchRecords,
  formatDate,
  formatFileSize,
  getDocumentSignedUrl,
  toOptions,
  updateRecord,
  uploadEmployeeDocument,
  type DocumentRecord,
} from "@/lib/employee-records";
import { listDocumentChecklist } from "@/lib/settings";
import { DocumentPreviewDialog } from "@/components/employee/document-preview-dialog";
import { cn } from "@/lib/utils";

interface DocumentsTabProps {
  employeeId: string;
  companyId: string;
  canManage: boolean;
}

const categoryOptions = toOptions(DOCUMENT_CATEGORY_LABELS);

/** Fallback checklist when the company has not configured one in Settings. */
const DEFAULT_CHECKLIST: { key: string; category: string; label: string }[] = [
  { key: "contract", category: "contract", label: "Hợp đồng lao động" },
  { key: "identity", category: "identity", label: "CCCD / CMND" },
  { key: "degree", category: "degree", label: "Bằng cấp" },
  { key: "certificate", category: "certificate", label: "Chứng chỉ / Bằng nghề" },
  { key: "insurance", category: "insurance", label: "Sổ bảo hiểm xã hội" },
  { key: "medical", category: "medical", label: "Giấy khám sức khoẻ" },
  { key: "other", category: "other", label: "Ảnh thẻ / Giấy tờ khác" },
];

export const DocumentsTab = ({ employeeId, companyId, canManage }: DocumentsTabProps) => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST);
  const [loading, setLoading] = useState(true);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [category, setCategory] = useState("contract");
  const [preset, setPreset] = useState<{ category: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentRecord | null>(null);
  const [renameTarget, setRenameTarget] = useState<DocumentRecord | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [documentRows, templates] = await Promise.all([
        fetchRecords<DocumentRecord>("employee_documents", employeeId, "created_at"),
        listDocumentChecklist(companyId).catch(() => []),
      ]);
      setDocuments(documentRows);
      if (templates.length > 0) {
        setChecklist(
          templates.map((template) => ({
            key: template.id,
            category: template.category,
            label: template.label,
          })),
        );
      } else {
        setChecklist(DEFAULT_CHECKLIST);
      }
    } catch (loadError) {
      console.error(loadError);
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const byCategory = useMemo(() => {
    const grouped: Record<string, DocumentRecord[]> = {};
    documents.forEach((document) => {
      grouped[document.category] = [...(grouped[document.category] ?? []), document];
    });
    return grouped;
  }, [documents]);

  const completedCount = checklist.filter((item) => (byCategory[item.category] ?? []).length > 0).length;
  const progress = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;

  const triggerUpload = (item?: { category: string; label: string }) => {
    setPreset(item ? { category: item.category, name: item.label } : null);
    inputRef.current?.click();
  };

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    if (file.size > EMPLOYEE_DOCUMENT_MAX_BYTES) {
      toast.error("Tệp quá lớn", { description: "Giới hạn 15MB mỗi tệp." });
      return;
    }
    setPendingFile(file);
    setDocumentName(preset?.name ?? file.name.replace(/\.[^.]+$/, ""));
    setCategory(preset?.category ?? "contract");
    setError(null);
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    if (!documentName.trim()) {
      setError("Vui lòng nhập tên tài liệu.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      await uploadEmployeeDocument({
        companyId,
        employeeId,
        file: pendingFile,
        name: documentName.trim(),
        category,
      });
      toast.success("Đã tải lên tài liệu");
      setPendingFile(null);
      setPreset(null);
      await load();
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Không tải được tệp.";
      setError(message.includes("row-level security") ? "Bạn không có quyền tải tài liệu cho nhân viên này." : message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (documentRecord: DocumentRecord) => {
    setDownloadingId(documentRecord.id);
    try {
      const url = await getDocumentSignedUrl(documentRecord.file_path, documentRecord.name);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = documentRecord.name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    } catch (downloadError) {
      toast.error("Không tải được tài liệu", {
        description: downloadError instanceof Error ? downloadError.message : undefined,
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteEmployeeDocument({ id: pendingDelete.id, file_path: pendingDelete.file_path });
      toast.success("Đã xoá tài liệu");
      setPendingDelete(null);
      await load();
    } catch (deleteError) {
      toast.error("Không xoá được tài liệu", {
        description: deleteError instanceof Error ? deleteError.message : undefined,
      });
    }
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    if (!renameValue.trim()) {
      toast.error("Tên tài liệu không được để trống.");
      return;
    }
    try {
      await updateRecord("employee_documents", renameTarget.id, { name: renameValue.trim() });
      toast.success("Đã đổi tên tài liệu");
      setRenameTarget(null);
      await load();
    } catch (renameError) {
      toast.error("Không đổi tên được", {
        description: renameError instanceof Error ? renameError.message : undefined,
      });
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
        onChange={(event) => {
          handleFileChange(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[13.5px] font-semibold text-foreground">Mức độ hoàn thành hồ sơ</h3>
            <p className="text-[11.5px] text-muted-foreground">
              {completedCount}/{checklist.length} hạng mục giấy tờ đã có tệp đính kèm
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              progress === 100 ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning",
            )}
          >
            {progress}%
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all duration-500", progress === 100 ? "bg-success" : "bg-primary")}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Mỗi hạng mục tự động được tích khi có ít nhất một tệp được tải lên.
        </p>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border/70 px-5 py-4">
          <h3 className="text-[13.5px] font-semibold text-foreground">Checklist hồ sơ nhân sự</h3>
          <p className="text-[11.5px] text-muted-foreground">
            Giấy tờ mặc định — tải lên, thay thế hoặc đổi tên tuỳ ý
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-[12.5px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải tài liệu…
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {checklist.map((item) => {
              const files = byCategory[item.category] ?? [];
              const primary = files[0] ?? null;
              const done = files.length > 0;
              return (
                <li key={item.key} className="flex flex-wrap items-center gap-2.5 px-5 py-3">
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-foreground">{item.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {primary
                        ? `${primary.name} · ${formatFileSize(primary.size_bytes)} · ${formatDate(primary.created_at)}`
                        : "Chưa có tệp đính kèm"}
                      {files.length > 1 ? ` · ${files.length} tệp` : ""}
                    </p>
                  </div>

                  <Badge variant={done ? "success" : "muted"}>{done ? "Đã có" : "Chưa có"}</Badge>

                  {primary && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Xem ${primary.name}`}
                        title="Xem trực tiếp"
                        onClick={() => setPreviewDoc(primary)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Đổi tên ${primary.name}`}
                          onClick={() => {
                            setRenameTarget(primary);
                            setRenameValue(primary.name);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </>
                  )}

                  {canManage && (
                    <Button
                      size="sm"
                      variant={done ? "outline" : "default"}
                      className="h-8 gap-1.5 text-[11.5px]"
                      onClick={() => triggerUpload(item)}
                    >
                      <Upload className="h-3.5 w-3.5" /> {done ? "Tải thêm" : "Tải lên"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div>
            <h3 className="text-[13.5px] font-semibold text-foreground">Tất cả tài liệu</h3>
            <p className="text-[11.5px] text-muted-foreground">{documents.length} tệp trong hồ sơ</p>
          </div>
          {canManage && (
            <Button size="sm" variant="outline" className="h-9 gap-1.5 text-[12px]" onClick={() => triggerUpload()}>
              <Upload className="h-3.5 w-3.5" /> Tải tài liệu khác
            </Button>
          )}
        </div>

        {canManage && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => triggerUpload()}
            onKeyDown={(event) => event.key === "Enter" && triggerUpload()}
            className="mx-5 mt-4 cursor-pointer rounded-lg border border-dashed border-border bg-muted/30 px-4 py-4 text-center transition-colors hover:border-primary/35 hover:bg-primary-subtle/40"
          >
            <FolderOpen className="mx-auto h-4 w-4 text-primary" />
            <p className="mt-1 text-[12px] font-medium text-foreground">Kéo tệp vào đây hoặc bấm để chọn</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">PDF, ảnh, Word, Excel · tối đa 15MB mỗi tệp</p>
          </div>
        )}

        {loading ? null : documents.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <FileText className="mx-auto h-5 w-5 text-muted-foreground/70" />
            <p className="mt-2 text-[12.5px] text-muted-foreground">Chưa có tài liệu nào trong hồ sơ.</p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/25">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground">
                  <FileText className="h-[17px] w-[17px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-foreground">{document.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {DOCUMENT_CATEGORY_LABELS[document.category] ?? document.category} ·{" "}
                    {formatFileSize(document.size_bytes)} · {formatDate(document.created_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Xem ${document.name}`}
                  title="Xem trực tiếp"
                  onClick={() => setPreviewDoc(document)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Tải ${document.name}`}
                  title="Tải về"
                  onClick={() => void handleDownload(document)}
                  disabled={downloadingId === document.id}
                >
                  {downloadingId === document.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
                {canManage && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Đổi tên ${document.name}`}
                      onClick={() => {
                        setRenameTarget(document);
                        setRenameValue(document.name);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Xoá ${document.name}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setPendingDelete(document)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={!!pendingFile} onOpenChange={(open) => !open && setPendingFile(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Tải tài liệu lên hồ sơ</DialogTitle>
            <DialogDescription>{pendingFile?.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="document-name" className="text-[12.5px]">
                Tên tài liệu
              </Label>
              <Input
                id="document-name"
                value={documentName}
                onChange={(event) => setDocumentName(event.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Loại tài liệu</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
              {formatFileSize(pendingFile?.size ?? null)} · chỉ thành viên có quyền nhân sự của công ty mới xem được
              tệp này.
            </p>
            {error && (
              <p className="rounded-md border border-destructive/25 bg-destructive-subtle px-3 py-2 text-[11.5px] leading-5 text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPendingFile(null)}>
              Huỷ
            </Button>
            <Button onClick={() => void handleUpload()} disabled={uploading} className="gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Đang tải…" : "Tải lên"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Đổi tên tài liệu</DialogTitle>
            <DialogDescription>Tên mới sẽ hiển thị trong checklist và danh sách tài liệu.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="rename-document" className="text-[12.5px]">
              Tên tài liệu
            </Label>
            <Input
              id="rename-document"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              className="h-10"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              Huỷ
            </Button>
            <Button onClick={() => void handleRename()}>Lưu tên mới</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentPreviewDialog
        document={previewDoc}
        open={!!previewDoc}
        onOpenChange={(next) => !next && setPreviewDoc(null)}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá tài liệu này?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} sẽ bị xoá khỏi kho lưu trữ và hồ sơ nhân viên.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              Xoá tài liệu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
