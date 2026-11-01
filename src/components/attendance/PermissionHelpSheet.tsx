import { Camera, MapPin } from "lucide-react";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

interface PermissionHelpSheetProps {
  open: boolean;
  kind: "camera" | "location";
  onClose: () => void;
  onRetry?: () => void;
}

export const PermissionHelpSheet = ({ open, kind, onClose, onRetry }: PermissionHelpSheetProps) => {
  const label = kind === "camera" ? "Camera" : "Vị trí";
  const Icon = kind === "camera" ? Camera : MapPin;
  return (
    <Drawer open={open} onOpenChange={(value) => !value && onClose()}>
      <DrawerContent className="mx-auto max-w-md rounded-t-3xl px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <DrawerHeader className="px-0 text-left">
          <DrawerTitle className="flex items-center gap-2 font-display text-[16px]">
            <Icon className="h-4 w-4 text-primary" /> Chưa cấp quyền {label}
          </DrawerTitle>
          <DrawerDescription>Bật quyền trên điện thoại rồi quay lại. Không có nút chọn ảnh từ thư viện.</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-2 text-[13px] leading-5">
          <div className="rounded-2xl bg-primary-subtle px-3 py-2.5 text-primary-subtle-foreground">
            <p className="font-bold">iPhone (Safari / PWA)</p>
            <p>Cài đặt › Safari › {label} › Cho phép. Hoặc nút “aA” trên thanh địa chỉ › Cài đặt trang web.</p>
          </div>
          <div className="rounded-2xl bg-success-subtle px-3 py-2.5 text-success">
            <p className="font-bold">Android (Chrome)</p>
            <p>
              Biểu tượng ổ khoá cạnh địa chỉ › Quyền › {label} › Cho phép.
              {kind === "location" ? " Bật thêm “Vị trí chính xác”." : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="bg-gradient-primary touch-target mt-4 w-full rounded-2xl text-[14px] font-bold text-white"
          onClick={() => {
            onRetry?.();
            onClose();
          }}
        >
          Tôi đã bật, thử lại
        </button>
      </DrawerContent>
    </Drawer>
  );
};
