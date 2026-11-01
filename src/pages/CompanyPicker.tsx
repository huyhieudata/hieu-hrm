import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Check, Loader2, LogOut, Plus, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

import { Logo, LogoMark } from "@/components/brand/logo";
import { Avatar } from "@/components/common/avatar";
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
import { displayName, useAuth } from "@/lib/auth-provider";
import { companyInitials, useCompany } from "@/lib/company-provider";
import { ROLE_BADGE, ROLE_LABELS } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const industries = [
  "Công nghệ thông tin",
  "Tài chính - Ngân hàng",
  "Bán lẻ - Thương mại",
  "Sản xuất",
  "Giáo dục",
  "Y tế",
  "Dịch vụ",
  "Khác",
];

const sizes = ["1 - 10 nhân sự", "11 - 50 nhân sự", "51 - 200 nhân sự", "201 - 500 nhân sự", "Trên 500 nhân sự"];

const CompanyPicker = () => {
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();
  const { memberships, activeMembership, setActiveCompany, createCompany, loading } = useCompany();

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState(industries[0]);
  const [size, setSize] = useState(sizes[1]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError("Tên công ty cần ít nhất 2 ký tự.");
      return;
    }

    setSubmitting(true);
    try {
      await createCompany({ name, industry, companySize: size });
      toast.success("Đã tạo công ty", { description: `${name.trim()} đã sẵn sàng để mời đội ngũ.` });
      navigate("/");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Không tạo được công ty.");
    } finally {
      setSubmitting(false);
    }
  };

  const onSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="relative min-h-[100dvh] bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-gradient-to-b from-primary/[0.07] via-primary/[0.02] to-transparent" />

      <div className="relative mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-8">
        <header className="flex items-center justify-between">
          <Logo subtitle="People Platform" />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[12.5px] font-semibold leading-4 text-foreground">
                {displayName(profile, user?.email)}
              </p>
              <p className="text-[11px] text-muted-foreground">{user?.email}</p>
            </div>
            <Avatar name={displayName(profile, user?.email)} />
            <Button variant="ghost" size="icon-sm" aria-label="Đăng xuất" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="mt-10 max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Không gian làm việc
          </p>
          <h1 className="mt-2 font-display text-[30px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[36px]">
            Chọn công ty để tiếp tục
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Một tài khoản có thể thuộc nhiều công ty với các vai trò khác nhau. Dữ liệu nhân sự, bảng
            lương và phân quyền được tách biệt cho từng công ty.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Công ty của bạn
              </h2>
              <span className="text-[11.5px] text-muted-foreground">{memberships.length} công ty</span>
            </div>

            {loading ? (
              <Card className="flex items-center justify-center gap-2 p-10 text-[12.5px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải danh sách công ty…
              </Card>
            ) : memberships.length === 0 ? (
              <Card className="border-dashed p-8 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[12px] bg-primary-subtle text-primary-subtle-foreground">
                  <Building2 className="h-5 w-5" />
                </div>
                <p className="mt-3 text-[13.5px] font-semibold text-foreground">Bạn chưa thuộc công ty nào</p>
                <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-5 text-muted-foreground">
                  Tạo công ty đầu tiên của bạn, hoặc mở liên kết mời từ quản trị viên để tham gia đội
                  ngũ có sẵn.
                </p>
              </Card>
            ) : (
              <ul className="space-y-2.5">
                {memberships.map((membership) => {
                  const isActive = activeMembership?.company_id === membership.company_id;
                  return (
                    <li key={membership.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCompany(membership.company_id);
                          navigate("/");
                        }}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-lg border bg-card p-3.5 text-left shadow-xs transition-all",
                          isActive
                            ? "border-primary/30 ring-1 ring-primary/20"
                            : "border-border hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-soft",
                        )}
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-brand text-[13px] font-semibold text-white shadow-primary-glow">
                          {companyInitials(membership.company.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[13.5px] font-semibold text-foreground">
                              {membership.company.name}
                            </span>
                            {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
                            <span>{membership.company.industry ?? "Chưa cập nhật ngành"}</span>
                            <span className="text-border">·</span>
                            <span>{membership.company.company_size ?? "Chưa rõ quy mô"}</span>
                          </span>
                        </span>
                        <Badge variant={ROLE_BADGE[membership.role]}>{ROLE_LABELS[membership.role]}</Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <Card className="h-fit p-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-subtle text-primary-subtle-foreground">
                <Plus className="h-[18px] w-[18px]" />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-foreground">Tạo công ty mới</h2>
                <p className="text-[11.5px] text-muted-foreground">Bạn sẽ là chủ sở hữu không gian này.</p>
              </div>
            </div>

            <form className="mt-4 space-y-3.5" onSubmit={onCreate}>
              <div className="space-y-1.5">
                <Label htmlFor="company-name" className="text-[12.5px]">
                  Tên công ty
                </Label>
                <Input
                  id="company-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Công ty TNHH An Phát"
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Lĩnh vực</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Quy mô nhân sự</Label>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sizes.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p className="rounded-md border border-destructive/25 bg-destructive-subtle px-3 py-2 text-[11.5px] leading-5 text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full gap-2" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                {submitting ? "Đang tạo…" : "Tạo công ty"}
              </Button>
            </form>

            <div className="mt-4 space-y-2 rounded-md border border-dashed border-border bg-muted/40 p-3">
              <p className="flex items-start gap-2 text-[11.5px] leading-5 text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Ba vai trò mặc định: chủ sở hữu, quản trị viên và nhân viên. Bạn có thể mời thêm nhân
                sự với vai trò HR hoặc quản lý sau.
              </p>
              <p className="flex items-start gap-2 text-[11.5px] leading-5 text-muted-foreground">
                <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Thành viên được mời bằng liên kết — không cần cấu hình máy chủ email.
              </p>
            </div>
          </Card>
        </div>

        <div className="mt-10 flex items-center gap-3 text-[11px] text-muted-foreground">
          <LogoMark className="h-5 w-5 rounded-[6px]" />
          ONHRM · Dữ liệu được bảo vệ theo từng công ty
        </div>
      </div>
    </div>
  );
};

export default CompanyPicker;
