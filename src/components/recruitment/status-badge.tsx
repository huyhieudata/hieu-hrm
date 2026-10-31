import { Badge } from "@/components/ui/badge";
import { statusMeta } from "@/lib/recruitment";

export const CandidateStatusBadge = ({ status }: { status: string }) => {
  const meta = statusMeta(status);
  return <Badge variant={meta.tone}>{meta.label}</Badge>;
};
