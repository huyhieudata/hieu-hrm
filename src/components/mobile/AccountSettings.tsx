import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { describeAuthError } from "@/lib/auth-provider";
import { getErrorMessage } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const validateNewPassword = (current: string, next: string, confirm: string): string | null => {
  if (!current) return "Vui lòng nhập mật khẩu hiện tại.";
  if (next.length < 8) return "Mật khẩu mới phải có ít nhất 8 ký tự.";
  if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) return "Mật khẩu mới cần có cả chữ và số.";
  if (next === current) return "Mật khẩu mới phải khác mật khẩu hiện tại.";
  if (next !== confirm) return "Xác nhận mật khẩu không khớp.";
  return null;
};

export const ChangePasswordDialog = ({ open, onOpenChange, email }: { open: boolean; onOpenChange: (open: boolean) => void; email: string | null | undefined }) => {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    const problem = validateNewPassword(current, next, confirm);
    if (problem) return setError(problem);
    if (!email) return setError("Tài khoản không có email, vui lòng liên hệ HR để đổi mật khẩu.");
    setSaving(true);
    setError(null);
    try {
      // Xác minh mật khẩu hiện tại trước khi đổi.
      const check = await supabase.auth.signInWithPassword({ email, password: current });
      if (check.error) throw new Error("Mật khẩu hiện tại không đúng.");
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) throw new Error(describeAuthError(updateError));
      toast.success("Đã đổi mật khẩu");
      onOpenChange(false);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đổi mật khẩu</DialogTitle>
          <DialogDescription>Mật khẩu mới tối thiểu 8 ký tự, gồm chữ và số.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <div className="space-y-1.5"><Label htmlFor="pw-current">Mật khẩu hiện tại</Label><Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="pw-next">Mật khẩu mới</Label><Input id="pw-next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="pw-confirm">Nhập lại mật khẩu mới</Label><Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
          {error ? <p className="text-[13px] font-medium text-destructive">{error}</p> : null}
          <Button type="submit" className="h-11 w-full" disabled={saving}>{saving ? "Đang lưu…" : "Đổi mật khẩu"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

type Prefs = { email_requests: boolean; email_attendance: boolean; email_hr_reminders: boolean };
const DEFAULT_PREFS: Prefs = { email_requests: true, email_attendance: true, email_hr_reminders: true };
const PREF_LABELS: Array<[keyof Prefs, string, string]> = [
  ["email_requests", "Kết quả đơn từ", "Email khi đơn được duyệt hoặc từ chối"],
  ["email_attendance", "Chấm công", "Email nhắc chấm công, cảnh báo đi muộn"],
  ["email_hr_reminders", "Nhắc việc nhân sự", "Sinh nhật, hết hạn hợp đồng, hết thử việc (nếu bạn là HR/quản lý)"],
];

export const NotificationSettingsDialog = ({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (open: boolean) => void; userId: string | null | undefined }) => {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    void db
      .from("user_notification_preferences")
      .select("email_requests, email_attendance, email_hr_reminders")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }: { data: Prefs | null; error: Error | null }) => {
        if (error) toast.error("Không tải được cài đặt thông báo", { description: getErrorMessage(error) });
        setPrefs(data ?? DEFAULT_PREFS);
        setLoading(false);
      });
  }, [open, userId]);

  const toggle = async (key: keyof Prefs, value: boolean) => {
    if (!userId) return;
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const { error } = await db.from("user_notification_preferences").upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() });
    if (error) {
      setPrefs(previous);
      toast.error("Không lưu được cài đặt", { description: getErrorMessage(error) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cài đặt thông báo</DialogTitle>
          <DialogDescription>Email tài khoản và mật khẩu luôn được gửi.</DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-border">
          {PREF_LABELS.map(([key, title, hint]) => (
            <label key={key} className="flex min-h-14 items-center gap-3 py-2">
              <span className="flex-1"><span className="block text-[15px] font-medium">{title}</span><span className="block text-[12px] text-muted-foreground">{hint}</span></span>
              <Switch checked={prefs[key]} disabled={loading} onCheckedChange={(value) => void toggle(key, value)} aria-label={title} />
            </label>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
