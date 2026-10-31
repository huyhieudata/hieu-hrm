import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/lib/company-provider";
import { currency } from "@/lib/format";
import {
  OFFER_STATUS_LABELS,
  createRow,
  formatDay,
  listRows,
  type Candidate,
  type CandidateOffer,
} from "@/lib/recruitment";

const EMAIL_TEMPLATES = [
  { value: "offer_letter", label: "Thư mời nhận việc" },
  { value: "interview_invite", label: "Thư mời phỏng vấn" },
  { value: "result", label: "Thông báo kết quả" },
  { value: "custom", label: "Email tuỳ chỉnh" },
];

const buildTemplate = (
  template: string,
  candidate: Candidate,
  companyName: string,
  offer: CandidateOffer | null,
): { subject: string; body: string } => {
  const position = offer?.position ?? candidate.position_applied ?? "vị trí ứng tuyển";
  const department = offer?.department ?? "";
  const salary = offer?.base_salary ? `${currency(Number(offer.base_salary))} / tháng` : "(cập nhật sau)";
  const allowance = offer?.allowance ? currency(Number(offer.allowance)) : "Theo chính sách công ty";
  const startDate = offer?.onboarding_date ? formatDay(offer.onboarding_date) : "(cập nhật sau)";
  const location = offer?.work_location ?? "(cập nhật sau)";
  const benefits = offer?.other_benefits?.trim() || "Bảo hiểm đầy đủ theo luật, 12 ngày phép năm, xét tăng lương định kỳ.";
  const deadline = offer?.response_deadline
    ? formatDay(offer.response_deadline)
    : offer?.onboarding_date
      ? `${formatDay(offer.onboarding_date)} (trước 03 ngày)`
      : "(cập nhật sau)";

  if (template === "offer_letter") {
    return {
      subject: `Thư mời nhận việc – ${position} tại ${companyName}`,
      body: `Kính gửi ${candidate.full_name},

${companyName} vui mừng thông báo bạn đã trúng tuyển và trân trọng mời bạn làm việc tại công ty.

THÔNG TIN NHẬN VIỆC
• Vị trí: ${position}${department ? ` – ${department}` : ""}
• Mức lương: ${salary}
• Phụ cấp: ${allowance}
• Ngày nhận việc: ${startDate}
• Địa điểm làm việc: ${location}
• Chế độ khác: ${benefits}
• Thời hạn nhận phản hồi: ${deadline}

Vui lòng phản hồi email này để xác nhận việc nhận lời mời trước hạn phản hồi nêu trên. Nếu cần trao đổi thêm, bạn có thể liên hệ trực tiếp bộ phận Nhân sự.

Trân trọng cảm ơn,
Bộ phận Tuyển dụng ${companyName}`,
    };
  }

  if (template === "interview_invite") {
    return {
      subject: `Thư mời phỏng vấn – ${position}`,
      body: `Kính gửi ${candidate.full_name},

Cảm ơn bạn đã quan tâm và ứng tuyển vị trí ${position} tại ${companyName}. Chúng tôi trân trọng mời bạn tham gia buổi phỏng vấn:
• Thời gian: (vui lòng xem lịch hẹn đã gửi)
• Địa điểm / Link: ${location}
• Người phỏng vấn: bộ phận Tuyển dụng

Vui lòng phản hồi email này để xác nhận bạn tham dự được. Nếu cần đổi lịch, hãy cho chúng tôi biết sớm nhất có thể.

Trân trọng,
Bộ phận Tuyển dụng ${companyName}`,
    };
  }

  if (template === "result") {
    return {
      subject: `Kết quả ứng tuyển – ${position}`,
      body: `Kính gửi ${candidate.full_name},

Cảm ơn bạn đã dành thời gian tham gia quy trình tuyển dụng vị trí ${position} tại ${companyName}.

Chúng tôi sẽ thông báo kết quả chính thức tới bạn trong thời gian sớm nhất. Nếu cần bổ sung thông tin, bộ phận Tuyển dụng sẽ liên hệ trực tiếp.

Trân trọng,
Bộ phận Tuyển dụng ${companyName}`,
    };
  }

  return {
    subject: `Liên hệ từ ${companyName}`,
    body: `Kính gửi ${candidate.full_name},\n\n\n\nTrân trọng,\nBộ phận Tuyển dụng ${companyName}`,
  };
};

interface EmailDialogProps {
  candidate: Candidate | null;
  offers?: CandidateOffer[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void | Promise<void>;
}

export const CandidateEmailDialog = ({ candidate, offers: offersProp = [], open, onOpenChange, onSent }: EmailDialogProps) => {
  const { activeCompany } = useCompany();
  const companyName = activeCompany?.name ?? "Công ty";

  const [template, setTemplate] = useState("offer_letter");
  const [offerId, setOfferId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedOffers, setLoadedOffers] = useState<CandidateOffer[]>([]);

  const offers = offersProp.length > 0 ? offersProp : loadedOffers;

  useEffect(() => {
    if (!open || !candidate || offersProp.length > 0) return;
    let active = true;
    void listRows<CandidateOffer>("candidate_offers", candidate.company_id, "created_at")
      .then((rows) => {
        if (active) setLoadedOffers(rows.filter((row) => row.candidate_id === candidate.id));
      })
      .catch(() => {
        if (active) setLoadedOffers([]);
      });
    return () => {
      active = false;
    };
  }, [candidate, offersProp.length, open]);

  useEffect(() => {
    if (!open) return;
    setTemplate("offer_letter");
    setOfferId(offers[0]?.id ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, candidate?.id]);

  const selectedOffer = useMemo(
    () => offers.find((offer) => offer.id === offerId) ?? offers[0] ?? null,
    [offerId, offers],
  );

  const generated = useMemo(
    () => (candidate ? buildTemplate(template, candidate, companyName, selectedOffer) : { subject: "", body: "" }),
    [candidate, companyName, selectedOffer, template],
  );

  useEffect(() => {
    if (!open) return;
    setSubject(generated.subject);
    setBody(generated.body);
  }, [generated, open]);

  const handleSend = async () => {
    if (!candidate) return;
    if (!subject.trim() || !body.trim()) {
      setError("Vui lòng nhập tiêu đề và nội dung email.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await createRow("candidate_emails", {
        candidate_id: candidate.id,
        subject: subject.trim(),
        body,
        sent_to: candidate.email,
        template,
        status: "sent",
      });
      toast.success("Đã ghi nhận email", {
        description: candidate.email
          ? `Lưu vào lịch sử email của ${candidate.full_name}.`
          : "Ứng viên chưa có email — nội dung đã được lưu vào lịch sử.",
      });
      await onSent?.();
      onOpenChange(false);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Không gửi được email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Gửi email cho ứng viên
          </DialogTitle>
          <DialogDescription>
            Chọn mẫu email và offer — nội dung tự điền thông tin nhận việc từ offer đã tạo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Mẫu email</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TEMPLATES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-to" className="text-[12px]">
                Gửi tới
              </Label>
              <Input
                id="email-to"
                value={candidate?.email ?? "Ứng viên chưa có email"}
                readOnly
                className="h-10 text-[13px]"
              />
            </div>
          </div>

          {template === "offer_letter" && (
            <div className="space-y-1.5">
              <Label className="text-[12px]">Offer áp dụng</Label>
              {offers.length === 0 ? (
                <p className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-[11.5px] leading-5 text-warning">
                  Ứng viên chưa có offer. Tạo offer trong tab <strong>Offer Letter</strong> để email tự điền mức
                  lương, ngày và địa điểm nhận việc.
                </p>
              ) : (
                <Select value={selectedOffer?.id ?? ""} onValueChange={setOfferId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Chọn offer" />
                  </SelectTrigger>
                  <SelectContent>
                    {offers.map((offer) => (
                      <SelectItem key={offer.id} value={offer.id}>
                        {offer.position ?? "Offer"}
                        {offer.base_salary ? ` · ${currency(Number(offer.base_salary), true)}` : ""}
                        {offer.onboarding_date ? ` · ${formatDay(offer.onboarding_date)}` : ""} ·{" "}
                        {OFFER_STATUS_LABELS[offer.status] ?? offer.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email-subject" className="text-[12px]">
              Tiêu đề
            </Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="h-10 text-[13px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-body" className="text-[12px]">
              Nội dung
            </Label>
            <Textarea
              id="email-body"
              rows={14}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="text-[13px] leading-6"
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/25 bg-destructive-subtle px-3 py-2 text-[11.5px] leading-5 text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button className="gap-2" onClick={() => void handleSend()} disabled={sending || !candidate}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Đang gửi…" : "Gửi email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
