import { useState, type FormEvent } from "react";
import { KeyRound, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-provider";
import { clearMustChangePassword } from "@/lib/employee-accounts";
import { passwordProblem, withTimeout } from "@/lib/password-rules";

/** Màn hình bắt buộc đổi mật khẩu tạm (tài khoản do quản trị tạo). Chặn toàn bộ ứng dụng tới khi đổi xong. */
export const ForcePasswordChange = ({ onDone }: { onDone: () => void }) => {
  const { updatePassword, signOut, user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const weak = passwordProblem(password);
    if (weak) return setError(weak);
    if (password !== confirm) return setError("Mật khẩu nhập lại không khớp.");
    setSaving(true);
    try {
      await withTimeout(updatePassword(password), 20000, "Máy chủ phản hồi chậm khi đổi mật khẩu. Thử lại sau giây lát.");
      await withTimeout(clearMustChangePassword(), 15000, "Đã đổi mật khẩu nhưng chưa cập nhật được trạng thái. Bấm lại để hoàn tất.");
      toast.success("Đã đổi mật khẩu");
      onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        /different|same/i.test(msg)
          ? "Mật khẩu mới phải khác mật khẩu tạm."
          : msg || "Không đổi được mật khẩu.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-[420px] p-6">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h1 className="text-[16px] font-semibold">Đổi mật khẩu để tiếp tục</h1>
        </div>
        <p className="mb-4 text-[12.5px] text-muted-foreground">
          Tài khoản {user?.email} đang dùng mật khẩu tạm do quản trị cấp. Vui lòng đặt mật khẩu mới.
        </p>
        <form className="space-y-3" onSubmit={(e) => void submit(e)}>
          <div className="space-y-1">
            <Label htmlFor="np">Mật khẩu mới</Label>
            <Input id="np" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="np2">Nhập lại mật khẩu mới</Label>
            <Input id="np2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && <p className="text-[12px] text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Đổi mật khẩu
          </Button>
          <Button type="button" variant="ghost" className="w-full gap-1.5" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" /> Đăng xuất
          </Button>
        </form>
      </Card>
    </div>
  );
};
