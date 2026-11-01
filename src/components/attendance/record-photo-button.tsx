import { useState } from "react";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { signedPhotoUrl } from "@/lib/attendance-verify";
import { getErrorMessage } from "@/lib/utils";

/** Mở ảnh chấm công riêng tư bằng signed URL (hết hạn sau 10 phút). */
export const RecordPhotoButton = ({ path, label }: { path: string; label: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const open = async () => {
    setLoading(true);
    try {
      setUrl(await signedPhotoUrl(path));
    } catch (error) {
      toast.error("Không mở được ảnh", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void open()}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />} {label}
      </button>
      <Dialog open={!!url} onOpenChange={(value) => !value && setUrl(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          {url && <img src={url} alt={label} className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </>
  );
};
