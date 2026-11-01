// Thẻ hiển thị một phiếu đánh giá theo biểu mẫu trong hồ sơ ứng viên (điểm tổng do máy chủ tính).
import { Eye, Lock, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EVALUATION_KIND_LABELS, EVALUATION_STATUS_LABELS, type EvaluationTemplate } from "@/lib/evaluations";
import {
  EVALUATION_RECOMMENDATION_LABELS,
  formatDateTime,
  type CandidateEvaluation,
  type Interview,
} from "@/lib/recruitment";

interface TemplateEvaluationCardProps {
  evaluation: CandidateEvaluation;
  template: EvaluationTemplate | null;
  interview: Interview | null;
  canEdit: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

export const TemplateEvaluationCard = ({
  evaluation,
  template,
  interview,
  canEdit,
  canDelete,
  onOpen,
  onDelete,
}: TemplateEvaluationCardProps) => {
  const isDraft = evaluation.status === "draft";
  const answered = Object.values(evaluation.answers ?? {}).filter((a) => typeof a?.score === "number").length;
  return (
    <Card className="space-y-2.5 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-foreground">{evaluation.reviewer_name ?? "Người đánh giá"}</p>
          <p className="text-[10.5px] text-muted-foreground">
            {isDraft ? "Cập nhật nháp" : "Nộp lúc"} {formatDateTime(evaluation.submitted_at ?? evaluation.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={isDraft ? "muted" : "success"}>
            {!isDraft && <Lock className="mr-1 h-3 w-3" />}
            {EVALUATION_STATUS_LABELS[isDraft ? "draft" : "submitted"]}
          </Badge>
          <Button variant="ghost" size="icon-sm" aria-label={canEdit ? "Sửa phiếu" : "Xem phiếu"} onClick={onOpen}>
            {canEdit ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          {canDelete && (
            <Button variant="ghost" size="icon-sm" aria-label="Xoá đánh giá" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 p-2">
        <div className="min-w-0 text-[11.5px]">
          <p className="truncate font-medium text-foreground">
            {template ? `${template.name} · v${template.version}` : "Biểu mẫu đã xoá"}
          </p>
          <p className="truncate text-[10.5px] text-muted-foreground">
            {template ? EVALUATION_KIND_LABELS[template.kind] ?? template.kind : ""}
            {interview ? ` · Vòng PV ${formatDateTime(interview.scheduled_at)}` : " · Không gắn vòng phỏng vấn"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-[0.05em] text-muted-foreground">Điểm tổng</p>
          <p className="tabular text-[15px] font-semibold text-primary">
            {evaluation.total_score ?? "—"}
            <span className="text-[11px] font-normal text-muted-foreground">/{template?.scale_max ?? 5}</span>
          </p>
          {isDraft && <p className="text-[9.5px] text-muted-foreground">{answered} tiêu chí đã chấm</p>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Badge
          variant={
            evaluation.recommendation === "advance"
              ? "success"
              : evaluation.recommendation === "reject"
                ? "destructive"
                : "warning"
          }
        >
          {EVALUATION_RECOMMENDATION_LABELS[evaluation.recommendation] ?? evaluation.recommendation}
        </Badge>
      </div>
      {evaluation.note && <p className="text-[11px] leading-5 text-muted-foreground">{evaluation.note}</p>}
    </Card>
  );
};
