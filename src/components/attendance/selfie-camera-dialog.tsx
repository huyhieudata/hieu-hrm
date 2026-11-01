import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { captureFrame } from "@/lib/attendance-verify";

interface Props {
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: (photo: Blob) => void;
}

/** Chụp selfie trực tiếp bằng camera trước (không cho chọn ảnh có sẵn). */
export const SelfieCameraDialog = ({ open, title, onCancel, onConfirm }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setReady(false);
    setShot(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Trình duyệt không hỗ trợ camera. Hãy mở bằng Chrome/Safari mới trên điện thoại.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 960 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      })
      .catch((err: DOMException) =>
        setError(
          err?.name === "NotAllowedError"
            ? "Bạn chưa cho phép dùng camera. Hãy bật quyền Camera cho trang này rồi thử lại."
            : "Không mở được camera trước.",
        ),
      );
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open]);

  useEffect(() => () => {
    if (shot) URL.revokeObjectURL(shot.url);
  }, [shot]);

  const take = async () => {
    if (!videoRef.current) return;
    try {
      const blob = await captureFrame(videoRef.current);
      setShot({ blob, url: URL.createObjectURL(blob) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không chụp được ảnh.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Nhìn thẳng vào camera, đủ sáng, rồi bấm Chụp.</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-square overflow-hidden rounded-lg bg-black">
          {shot ? (
            <img src={shot.url} alt="Ảnh vừa chụp" className="h-full w-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              onLoadedData={() => setReady(true)}
              className="h-full w-full -scale-x-100 object-cover"
            />
          )}
          {!shot && !ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-white/80">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>
        {error && <p className="text-[12px] text-destructive">{error}</p>}
        <div className="flex gap-2">
          {shot ? (
            <>
              <Button variant="outline" className="flex-1 gap-1.5" onClick={() => setShot(null)}>
                <RotateCcw className="h-4 w-4" /> Chụp lại
              </Button>
              <Button className="flex-1" onClick={() => onConfirm(shot.blob)}>
                Dùng ảnh này
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="flex-1" onClick={onCancel}>
                Huỷ
              </Button>
              <Button className="flex-1 gap-1.5" disabled={!ready} onClick={() => void take()}>
                <Camera className="h-4 w-4" /> Chụp
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
