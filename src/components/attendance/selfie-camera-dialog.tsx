import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw } from "lucide-react";

import { PermissionHelpSheet } from "@/components/attendance/PermissionHelpSheet";
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

  const denied = !!error && /cho phép|quyền|NotAllowed|camera/i.test(error);

  return (
    <>
      <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
        <DialogContent className="max-w-sm max-sm:bottom-0 max-sm:top-auto max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-3xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Đặt khuôn mặt vào khung, đủ sáng. Ảnh chụp trực tiếp từ camera trước.</DialogDescription>
          </DialogHeader>
          <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-[#0b1a33]">
            {shot ? (
              <img src={shot.url} alt="Ảnh vừa chụp" className="h-full w-full -scale-x-100 object-cover" />
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                onLoadedData={() => setReady(true)}
                className="h-full w-full -scale-x-100 object-cover"
              />
            )}
            {!shot && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[58%] w-[62%] rounded-[50%] border-[3px] border-white/85 shadow-[0_0_0_8px_rgba(14,45,88,.35)]" />
              </div>
            )}
            {!shot && !ready && !error && (
              <div className="absolute inset-0 flex items-center justify-center text-white/80">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </div>
          <p className="text-center text-[12px] text-muted-foreground">Đặt khuôn mặt vào khung · đủ sáng · không chọn ảnh từ thư viện</p>
          {error && !denied ? <p className="text-[12px] text-destructive">{error}</p> : null}
          <div className="flex flex-col items-center gap-2">
            {shot ? (
              <div className="flex w-full gap-2">
                <Button variant="outline" className="h-11 flex-1 gap-1.5 rounded-2xl" onClick={() => setShot(null)}>
                  <RotateCcw className="h-4 w-4" /> Chụp lại
                </Button>
                <Button className="h-11 flex-1 rounded-2xl" onClick={() => onConfirm(shot.blob)}>
                  Dùng ảnh này
                </Button>
              </div>
            ) : (
              <button
                type="button"
                aria-label="Chụp"
                disabled={!ready}
                onClick={() => void take()}
                className="bg-gradient-primary flex h-16 w-16 items-center justify-center rounded-full p-1 disabled:opacity-50"
              >
                <span className="flex h-full w-full items-center justify-center rounded-full border-[3px] border-white/80 bg-white">
                  <Camera className="h-5 w-5 text-primary" />
                </span>
              </button>
            )}
            <Button variant="ghost" className="h-11" onClick={onCancel}>
              Huỷ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <PermissionHelpSheet open={open && denied} kind="camera" onClose={onCancel} onRetry={onCancel} />
    </>
  );
};
