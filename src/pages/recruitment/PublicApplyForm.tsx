import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

interface CandidateFormInfo {
  candidate_name: string;
  position_applied: string | null;
  company_name: string;
  already_submitted: boolean;
}

const PublicApplyForm = () => {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<CandidateFormInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    gender: "none",
    address: "",
    position_applied: "",
    experience_years: "",
    current_salary: "",
    expected_salary: "",
    education: "",
    note: "",
  });

  const load = useCallback(async () => {
    if (!token) {
      setInvalid(true);
      setLoading(false);
      return;
    }
    try {
      const { data, error: rpcError } = await supabase.rpc("peek_candidate_form", { p_token: token });
      if (rpcError) throw rpcError;
      const rows = (data ?? []) as unknown as CandidateFormInfo[];
      if (rows.length === 0) {
        setInvalid(true);
        return;
      }
      setInfo(rows[0]);
      setForm((prev) => ({
        ...prev,
        full_name: rows[0].candidate_name ?? "",
        position_applied: rows[0].position_applied ?? "",
      }));
    } catch {
      setInvalid(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    if (!form.full_name.trim()) {
      setError("Vui lòng nhập họ và tên.");
      return;
    }
    if (!form.email.trim() && !form.phone.trim()) {
      setError("Vui lòng nhập email hoặc số điện thoại để chúng tôi liên hệ.");
      return;
    }
    const numericFields: { key: keyof typeof form; label: string }[] = [
      { key: "experience_years", label: "Số năm kinh nghiệm" },
      { key: "current_salary", label: "Lương hiện tại" },
      { key: "expected_salary", label: "Lương mong muốn" },
    ];
    for (const field of numericFields) {
      const raw = form[field.key].trim();
      if (raw && Number.isNaN(Number(raw))) {
        setError(`${field.label} phải là số.`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc("submit_candidate_form", {
        p_token: token,
        payload: {
          ...form,
          gender: form.gender === "none" ? "" : form.gender,
        },
      });
      if (rpcError) throw rpcError;
      setSubmitted(true);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : String((submitError as { message?: string })?.message ?? "");
      if (message.includes("FORM_ALREADY_SUBMITTED")) {
        setError("Hồ sơ đã được gửi trước đó. Liên hệ nhà tuyển dụng nếu cần cập nhật.");
      } else if (message.includes("FORM_EXPIRED")) {
        setError("Liên kết đã hết hạn. Vui lòng liên hệ nhà tuyển dụng để nhận liên kết mới.");
      } else {
        setError("Không gửi được hồ sơ. Vui lòng thử lại hoặc liên hệ nhà tuyển dụng.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-gradient-to-b from-primary/[0.07] via-primary/[0.02] to-transparent" />

      <div className="relative mx-auto w-full max-w-[720px] px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
        <div className="flex justify-center">
          <Logo subtitle="People Platform" />
        </div>

        {loading ? (
          <Card className="mt-8 flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang mở biểu mẫu…
          </Card>
        ) : invalid ? (
          <Card className="mt-8 p-10 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
            <h1 className="mt-3 font-display text-[20px] font-semibold text-foreground">
              Liên kết không còn hiệu lực
            </h1>
            <p className="mt-1 text-[12.5px] leading-6 text-muted-foreground">
              Biểu mẫu này đã bị đóng hoặc liên kết không đúng. Vui lòng liên hệ nhà tuyển dụng để nhận liên kết mới.
            </p>
          </Card>
        ) : submitted ? (
          <Card className="mt-8 p-10 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <h1 className="mt-3 font-display text-[22px] font-semibold text-foreground">Đã gửi hồ sơ thành công</h1>
            <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
              Cảm ơn {info?.candidate_name}. Bộ phận tuyển dụng {info?.company_name} sẽ liên hệ với bạn trong thời gian
              sớm nhất.
            </p>
          </Card>
        ) : (
          <Card className="mt-8 p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Biểu mẫu ứng tuyển</p>
            <h1 className="mt-1.5 font-display text-[24px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
              Hoàn thiện hồ sơ của bạn
            </h1>
            <p className="mt-1.5 text-[12.5px] leading-6 text-muted-foreground">
              {info?.company_name}
              {info?.position_applied ? ` · Vị trí ${info.position_applied}` : ""}. Thông tin bạn nhập được bảo mật và
              chỉ dùng cho quá trình tuyển dụng.
            </p>

            {info?.already_submitted && (
              <p className="mt-3 rounded-md border border-info/25 bg-info-subtle px-3 py-2 text-[11.5px] leading-5 text-info">
                Bạn đã gửi hồ sơ trước đó. Có thể cập nhật lại thông tin nếu cần.
              </p>
            )}

            <form className="mt-5 space-y-4" onSubmit={onSubmit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name" className="text-[12px]">
                    Họ và tên <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="full_name"
                    value={form.full_name}
                    onChange={(event) => set("full_name", event.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="position_applied" className="text-[12px]">
                    Vị trí ứng tuyển
                  </Label>
                  <Input
                    id="position_applied"
                    value={form.position_applied}
                    onChange={(event) => set("position_applied", event.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[12px]">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(event) => set("email", event.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-[12px]">
                    Số điện thoại
                  </Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(event) => set("phone", event.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="date_of_birth" className="text-[12px]">
                    Ngày sinh
                  </Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={form.date_of_birth}
                    onChange={(event) => set("date_of_birth", event.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Giới tính</Label>
                  <Select value={form.gender} onValueChange={(value) => set("gender", value)}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Chọn" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Chưa chọn</SelectItem>
                      <SelectItem value="male">Nam</SelectItem>
                      <SelectItem value="female">Nữ</SelectItem>
                      <SelectItem value="other">Khác</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="address" className="text-[12px]">
                    Địa chỉ hiện tại
                  </Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(event) => set("address", event.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="education" className="text-[12px]">
                    Học vấn
                  </Label>
                  <Input
                    id="education"
                    value={form.education}
                    onChange={(event) => set("education", event.target.value)}
                    className="h-10"
                    placeholder="Đại học Bách Khoa"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="experience_years" className="text-[12px]">
                    Số năm kinh nghiệm
                  </Label>
                  <Input
                    id="experience_years"
                    inputMode="numeric"
                    value={form.experience_years}
                    onChange={(event) => set("experience_years", event.target.value)}
                    className="h-10"
                    placeholder="3"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="current_salary" className="text-[12px]">
                    Lương hiện tại (VND)
                  </Label>
                  <Input
                    id="current_salary"
                    inputMode="numeric"
                    value={form.current_salary}
                    onChange={(event) => set("current_salary", event.target.value)}
                    className="h-10"
                    placeholder="20000000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expected_salary" className="text-[12px]">
                    Lương mong muốn (VND)
                  </Label>
                  <Input
                    id="expected_salary"
                    inputMode="numeric"
                    value={form.expected_salary}
                    onChange={(event) => set("expected_salary", event.target.value)}
                    className="h-10"
                    placeholder="30000000"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="note" className="text-[12px]">
                    Giới thiệu ngắn về bản thân
                  </Label>
                  <Textarea
                    id="note"
                    rows={4}
                    value={form.note}
                    onChange={(event) => set("note", event.target.value)}
                    className="text-[13px]"
                    placeholder="Kinh nghiệm nổi bật, thành tựu, nguyện vọng…"
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-md border border-destructive/25 bg-destructive-subtle px-3 py-2 text-[11.5px] leading-5 text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full gap-2" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? "Đang gửi…" : "Gửi hồ sơ ứng tuyển"}
              </Button>
              <p className="text-center text-[11px] leading-5 text-muted-foreground">
                Bằng việc gửi hồ sơ, bạn đồng ý để {info?.company_name} lưu và xử lý thông tin cho mục đích tuyển dụng.
              </p>
            </form>
          </Card>
        )}

        <p className="mt-6 text-center text-[11px] text-muted-foreground">© 2026 ONHRM · Biểu mẫu ứng tuyển</p>
      </div>
    </div>
  );
};

export default PublicApplyForm;
