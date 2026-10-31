import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ClipboardList, Download, Info, Loader2, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { downloadOfferLetter, printOfferLetter } from "@/lib/offer-letter";
import {
  OFFER_STATUS_LABELS,
  formatDay,
  getCandidateByEmployee,
  listRows,
  type Candidate,
  type CandidateOffer,
} from "@/lib/recruitment";
import { currency } from "@/lib/format";
import { useCompany } from "@/lib/company-provider";

interface OfferTabProps {
  employeeId: string;
  companyId: string;
}

export const OfferTab = ({ employeeId, companyId }: OfferTabProps) => {
  const { activeCompany } = useCompany();
  const companyName = activeCompany?.name ?? "Công ty";

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [offers, setOffers] = useState<CandidateOffer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const record = await getCandidateByEmployee(employeeId);
      setCandidate(record);
      if (record) {
        const rows = await listRows<CandidateOffer>("candidate_offers", companyId, "created_at");
        setOffers(rows.filter((offer) => offer.candidate_id === record.id));
      } else {
        setOffers([]);
      }
    } catch {
      setCandidate(null);
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-subtle text-primary-subtle-foreground">
              <ClipboardList className="h-[17px] w-[17px]" strokeWidth={1.9} />
            </span>
            <div>
              <h3 className="text-[13.5px] font-semibold text-foreground">Offer</h3>
              <p className="text-[11.5px] text-muted-foreground">
                {offers.length} offer · đồng bộ từ module Tuyển dụng
              </p>
            </div>
          </div>
          {candidate && (
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-[11.5px]">
              <Link to={`/tuyen-dung/ung-vien/${candidate.id}`}>
                <ArrowUpRight className="h-3.5 w-3.5" /> Mở hồ sơ ứng viên
              </Link>
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-[12.5px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải offer…
          </div>
        ) : !candidate ? (
          <div className="px-5 py-10 text-center">
            <ClipboardList className="mx-auto h-5 w-5 text-muted-foreground/70" />
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              Nhân sự này không gắn với hồ sơ ứng viên nào nên không có offer.
            </p>
          </div>
        ) : offers.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <ClipboardList className="mx-auto h-5 w-5 text-muted-foreground/70" />
            <p className="mt-2 text-[12.5px] text-muted-foreground">Ứng viên chưa có offer nào.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {offers.map((offer) => (
              <li key={offer.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">
                      {offer.position ?? "Offer"}
                      {offer.department ? ` · ${offer.department}` : ""}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground">
                      Nhận việc {formatDay(offer.onboarding_date)}
                      {offer.work_location ? ` · ${offer.work_location}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        offer.status === "accepted"
                          ? "success"
                          : offer.status === "declined"
                            ? "destructive"
                            : offer.status === "sent"
                              ? "info"
                              : "muted"
                      }
                    >
                      {OFFER_STATUS_LABELS[offer.status] ?? offer.status}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-[11.5px]"
                      onClick={() => printOfferLetter(offer, candidate, companyName)}
                    >
                      <Printer className="h-3.5 w-3.5" /> In / PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Tải thư offer"
                      onClick={() => downloadOfferLetter(offer, candidate, companyName)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Mức lương", offer.base_salary ? currency(Number(offer.base_salary)) : "—"],
                    ["Phụ cấp", offer.allowance ? currency(Number(offer.allowance)) : "—"],
                    ["Ngày nhận việc", formatDay(offer.onboarding_date)],
                    ["Hạn phản hồi", offer.response_deadline ? formatDay(offer.response_deadline) : "—"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {label}
                      </p>
                      <p className="text-[12.5px] font-medium text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                {offer.other_benefits && (
                  <p className="mt-2 whitespace-pre-line rounded-md bg-muted/40 px-3 py-2 text-[11.5px] leading-5 text-muted-foreground">
                    {offer.other_benefits}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="flex items-start gap-1.5 text-[10.5px] leading-5 text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Offer chỉ được đồng bộ từ module Tuyển dụng — mở hồ sơ ứng viên để thêm, sửa hoặc xoá offer.
      </p>
    </div>
  );
};
