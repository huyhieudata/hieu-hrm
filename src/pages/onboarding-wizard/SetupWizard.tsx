import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Check, Loader2, Network, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/brand/logo";
import { CreateAccountsDialog } from "@/components/employee/account-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompany } from "@/lib/company-provider";
import { createSetting, listDepartments } from "@/lib/settings";
import { cn } from "@/lib/utils";

const INDUSTRIES = [
  "Công nghệ thông tin",
  "Tài chính - Ngân hàng",
  "Bán lẻ - Thương mại",
  "Sản xuất",
  "Giáo dục",
  "Y tế",
  "Dịch vụ",
  "Khác",
];
const SIZES = ["1 - 10 nhân sự", "11 - 50 nhân sự", "51 - 200 nhân sự", "201 - 500 nhân sự", "Trên 500 nhân sự"];

const DEFAULT_DEPARTMENTS: Record<string, string[]> = {
  "Sản xuất": ["Hành chính - Nhân sự", "Kế toán", "Kinh doanh", "Sản xuất", "Kho vận", "Kỹ thuật"],
  "Bán lẻ - Thương mại": ["Hành chính - Nhân sự", "Kế toán", "Kinh doanh", "Marketing", "Kho vận", "Chăm sóc khách hàng"],
  "Công nghệ thông tin": ["Hành chính - Nhân sự", "Kế toán", "Kinh doanh", "Kỹ thuật", "Sản phẩm", "Marketing"],
};
const departmentsFor = (industry: string) =>
  DEFAULT_DEPARTMENTS[industry] ?? ["Hành chính - Nhân sự", "Kế toán", "Kinh doanh", "Marketing", "Kỹ thuật"];

const STEPS = [
  { label: "Công ty", icon: Building2 },
  { label: "Phòng ban", icon: Network },
  { label: "Mời nhân sự", icon: UserPlus },
];

/** Wizard tạo công ty 3 bước: (1) tên/ngành/quy mô → (2) phòng ban mặc định → (3) mời nhân sự (bỏ qua được). */
const SetupWizard = () => {
  const navigate = useNavigate();
  const { createCompany } = useCompany();
  const [step, setStep] = useState(0);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const submitCompany = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Tên công ty cần ít nhất 2 ký tự.");
    setBusy(true);
    try {
      const id = await createCompany({ name, industry, companySize: size });
      setCompanyId(id);
      const list = departmentsFor(industry);
      setDepartments(list);
      setSelected(new Set(list));
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được công ty.");
    } finally {
      setBusy(false);
    }
  };

  const addCustom = () => {
    const value = custom.trim();
    if (!value) return;
    if (!departments.some((d) => d.toLowerCase() === value.toLowerCase())) setDepartments((list) => [...list, value]);
    setSelected((set) => new Set(set).add(value));
    setCustom("");
  };

  const submitDepartments = async () => {
    if (!companyId) return;
    setError(null);
    setBusy(true);
    try {
      const existing = new Set((await listDepartments(companyId)).map((d) => d.name.trim().toLowerCase()));
      let order = existing.size;
      for (const dept of departments.filter((d) => selected.has(d))) {
        if (existing.has(dept.toLowerCase())) continue;
        order += 1;
        await createSetting("departments", { company_id: companyId, name: dept, sort_order: order });
      }
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được phòng ban.");
    } finally {
      setBusy(false);
    }
  };

  const finish = (skipped: boolean) => {
    toast.success("Công ty đã sẵn sàng", {
      description: skipped ? "Bạn có thể mời nhân sự sau ở Cài đặt › Thành viên." : undefined,
    });
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto w-full max-w-[640px] px-5 py-8">
        <Logo subtitle="Thiết lập công ty" />

        <ol className="mt-8 flex items-center gap-2" aria-label="Các bước thiết lập">
          {STEPS.map((item, index) => (
            <li key={item.label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold",
                  index < step && "border-primary bg-primary text-white",
                  index === step && "border-primary text-primary",
                  index > step && "border-border text-muted-foreground",
                )}
                aria-current={index === step ? "step" : undefined}
              >
                {index < step ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className={cn("text-[12.5px]", index === step ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {item.label}
              </span>
              {index < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
            </li>
          ))}
        </ol>

        <Card className="mt-6 p-5">
          {step === 0 && (
            <form className="space-y-3.5" onSubmit={submitCompany}>
              <h1 className="text-[16px] font-semibold">Bước 1/3 · Thông tin công ty</h1>
              <div className="space-y-1.5">
                <Label htmlFor="wz-name">Tên công ty</Label>
                <Input id="wz-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Công ty TNHH An Phát" className="h-10" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Lĩnh vực</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quy mô nhân sự</Label>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>{SIZES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {error && <p className="rounded-md bg-destructive-subtle px-3 py-2 text-[12px] text-destructive">{error}</p>}
              <div className="flex justify-between pt-1">
                <Button type="button" variant="ghost" className="gap-1.5" onClick={() => navigate("/cong-ty")}>
                  <ArrowLeft className="h-4 w-4" /> Quay lại
                </Button>
                <Button type="submit" disabled={busy} className="gap-2">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Tạo công ty & tiếp tục
                </Button>
              </div>
            </form>
          )}

          {step === 1 && (
            <div className="space-y-3.5">
              <h1 className="text-[16px] font-semibold">Bước 2/3 · Phòng ban mặc định</h1>
              <p className="text-[12.5px] text-muted-foreground">
                Gợi ý theo lĩnh vực "{industry}". Bỏ chọn phòng không cần; có thể sửa sau ở Cài đặt › Cơ cấu tổ chức.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {departments.map((dept) => (
                  <label key={dept} className="flex items-center gap-2 rounded-md border p-2.5 text-[13px]">
                    <Checkbox
                      checked={selected.has(dept)}
                      onCheckedChange={(checked) =>
                        setSelected((set) => {
                          const next = new Set(set);
                          if (checked) next.add(dept);
                          else next.delete(dept);
                          return next;
                        })
                      }
                    />
                    {dept}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Thêm phòng ban khác" className="h-9"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
                <Button type="button" variant="outline" className="h-9" onClick={addCustom}>Thêm</Button>
              </div>
              {error && <p className="rounded-md bg-destructive-subtle px-3 py-2 text-[12px] text-destructive">{error}</p>}
              <div className="flex justify-between pt-1">
                <Button type="button" variant="ghost" onClick={() => setStep(2)} disabled={busy}>Bỏ qua</Button>
                <Button onClick={() => void submitDepartments()} disabled={busy} className="gap-2">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Tạo {selected.size} phòng ban & tiếp tục
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3.5">
              <h1 className="text-[16px] font-semibold">Bước 3/3 · Mời nhân sự</h1>
              <p className="text-[12.5px] text-muted-foreground">
                Tạo tài khoản cho nhân sự (nhập tay hoặc nhập từ Excel). Bạn có thể bỏ qua và làm sau ở Cài đặt › Thành viên.
              </p>
              <Button variant="outline" className="gap-2" onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4" /> Mời nhân sự
              </Button>
              <div className="flex justify-between pt-1">
                <Button variant="ghost" onClick={() => finish(true)}>Bỏ qua</Button>
                <Button onClick={() => finish(false)}>Hoàn tất</Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {companyId && (
        <CreateAccountsDialog open={inviteOpen} onOpenChange={setInviteOpen} companyId={companyId} allowImport onDone={() => undefined} />
      )}
    </div>
  );
};

export default SetupWizard;
