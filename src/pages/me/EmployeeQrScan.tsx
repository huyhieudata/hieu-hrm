import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsQR from "jsqr";
import { Camera } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { isAttendanceQr } from "@/lib/attendance-verify";

/** Quét QR điểm chấm công rồi chuyển sang màn chấm công (vẫn kiểm đủ thiết bị/GPS/ảnh). */
const EmployeeQrScan = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const tick = () => {
      const video = videoRef.current;
      if (stopped || !video || !ctx) return;
      if (video.readyState >= 2 && video.videoWidth) {
        const scale = Math.min(1, 640 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          if (isAttendanceQr(code.data)) {
            stopped = true;
            navigate("/toi/cham-cong", { replace: true, state: { qrToken: code.data.trim(), qrAt: Date.now() } });
            return;
          }
          setHint("Đây không phải mã QR chấm công của hệ thống.");
        }
      }
      raf = requestAnimationFrame(tick);
    };
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        raf = requestAnimationFrame(tick);
      } catch {
        setError("Không mở được camera. Hãy cấp quyền camera cho trình duyệt rồi thử lại.");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [navigate, attempt]);

  return (
    <AppShell>
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-[24px] bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-brand-orange" />
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Đưa mã QR tại điểm chấm công vào khung. Sau khi quét, bạn vẫn cần đúng thiết bị, trong bán kính và chụp ảnh như bình thường.
      </p>
      {hint && <p className="mt-2 text-center text-sm font-semibold text-destructive">{hint}</p>}
      {error && (
        <div className="mt-4 space-y-2 text-center">
          <p className="text-sm font-semibold text-destructive">{error}</p>
          <Button variant="outline" className="gap-1.5" onClick={() => { setError(null); setAttempt((n) => n + 1); }}>
            <Camera className="h-4 w-4" /> Thử lại
          </Button>
        </div>
      )}
    </AppShell>
  );
};

export default EmployeeQrScan;
