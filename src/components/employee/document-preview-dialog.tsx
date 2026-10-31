import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DOCUMENT_CATEGORY_LABELS,
  formatFileSize,
  getDocumentSignedUrl,
  type DocumentRecord,
} from "@/lib/employee-records";

interface DocumentPreviewDialogProps {
  document: DocumentRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const isPreviewable = (mime: string | null) => {
  if (!mime) return false;
  return mime.startsWith("image/") || mime === "application/pdf";
};

export const DocumentPreviewDialog = ({ document, open, onOpenChange }: DocumentPreviewDialogProps) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!document) return;
    setLoading(true);
    setError(null);
    try {
      setUrl(await getDocumentSignedUrl(document.file_path));
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Không mở được tài liệu.");
    } finally {
      setLoading(false);
    }
  }, [document]);

  useEffect(() => {
    if (!open) {
      setUrl(null);
      return;
    }
    void load();
  }, [load, open]);

  const handleDownload = async () => {
    if (!document) return;
    try {
      const downloadUrl = await getDocumentSignedUrl(document.file_path, document.name);
      const link = window.document.createElement("a");
      link.href = downloadUrl;
      link.download = document.name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      toast.success("Đang tải tài liệu", { description: document.name });
    } catch {
      toast.error("Không tải được tài liệu");
    }
  };

  const previewable = document ? isPreviewable(document.mime_type) : false;
  const isImage = document?.mime_type?.startsWith("image/") ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 truncate">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{document?.name ?? "Tài liệu"}</span>
          </DialogTitle>
          <DialogDescription>
            {document
              ? `${DOCUMENT_CATEGORY_LABELS[document.category] ?? document.category} · ${formatFileSize(
                  document.size_bytes,
                )}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30">
          {loading ? (
            <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang mở tài liệu…
            </span>
          ) : error ? (
            <p className="px-4 py-8 text-center text-[12.5px] text-destructive">{error}</p>
          ) : url && previewable ? (
            isImage ? (
              <img src={url} alt={document?.name ?? "Tài liệu"} className="max-h-[62vh] w-auto object-contain" />
            ) : (
              <iframe title={document?.name ?? "Tài liệu"} src={url} className="h-[62vh] w-full border-0" />
            )
          ) : (
            <div className="px-4 py-10 text-center">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground/70" />
              <p className="mt-2 text-[13px] font-semibold text-foreground">Không xem trước được định dạng này</p>
              <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-5 text-muted-foreground">
                Tệp Word/Excel cần tải về để mở. Bạn có thể mở trong tab mới hoặc tải xuống bên dưới.
              </p>
              {url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 h-8 gap-1.5 text-[11.5px]"
                  onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Mở trong tab mới
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {url && (
              <Button
                variant="ghost"
                className="h-9 gap-1.5 text-[12px]"
                onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Mở tab mới
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9 gap-1.5 text-[12px]" onClick={() => void handleDownload()}>
              <Download className="h-3.5 w-3.5" /> Tải về
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
