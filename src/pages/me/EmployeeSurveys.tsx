import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, ClipboardList, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/mobile/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { confirmDialog } from "@/components/common/confirm-dialog";
import { useCompany } from "@/lib/company-provider";
import {
  createSurvey,
  listMyResponses,
  listSurveys,
  loadSurveyResults,
  deleteSurvey,
  setSurveyStatus,
  submitSurvey,
  type Answers,
  type QuestionType,
  type Survey,
  type SurveyQuestion,
  type SurveyResults,
} from "@/lib/surveys";
import { getErrorMessage } from "@/lib/utils";

const TYPE_LABELS: Record<QuestionType, string> = { single: "Chọn một", multi: "Chọn nhiều", rating: "Chấm điểm 1–5", text: "Trả lời ngắn" };
const STATUS: Record<Survey["status"], string> = { draft: "Nháp", open: "Đang mở", closed: "Đã đóng" };

const EmployeeSurveys = () => {
  const { activeCompany, role } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const isHr = role === "owner" || role === "admin" || role === "hr";
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState<Survey | null>(null);
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<SurveyResults | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [list, mine] = await Promise.all([listSurveys(companyId), listMyResponses(companyId)]);
      // Nhân viên thường chỉ thấy khảo sát đang mở; đã đóng/nháp ẩn.
      setSurveys(isHr ? list : list.filter((s) => s.status === "open"));
      setDone(mine);
    } catch (error) {
      toast.error("Không tải được khảo sát", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId, isHr]);
  useEffect(() => void load(), [load]);

  const expired = (s: Survey) => s.status !== "open" || (s.closes_at ? new Date(s.closes_at) < new Date() : false);

  return (
    <AppShell>
      {loading && surveys.length === 0 ? (
        <div className="space-y-3">
          {[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-[20px] bg-card" />)}
        </div>
      ) : null}
      {!loading && surveys.length === 0 ? (
        <div className="space-y-3 text-center">
          <EmptyState
            emoji="📋"
            title="Chưa có khảo sát"
            description={isHr ? "Tạo khảo sát để lấy ý kiến nhân viên. Có thể bật ẩn danh." : "Khi công ty mở khảo sát, bạn sẽ thấy ở đây."}
          />
          {isHr && (
            <Button size="sm" className="h-10 gap-1.5 rounded-full bg-brand-orange px-5 text-white hover:bg-brand-orange/90" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Tạo khảo sát
            </Button>
          )}
        </div>
      ) : null}
      {isHr && surveys.length > 0 && (
        <div className="mb-3 flex justify-end">
          <Button size="sm" className="h-10 gap-1.5 rounded-full bg-brand-orange px-4 text-white hover:bg-brand-orange/90" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Tạo khảo sát
          </Button>
        </div>
      )}
      <div className="space-y-3">
        {surveys.map((s) => {
          const answered = done.has(s.id);
          return (
            <div key={s.id} className="shadow-card-soft rounded-[20px] bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-subtle text-brand-navy">
                  <ClipboardList className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{s.title}</p>
                  {s.description && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted-foreground">{s.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    <Badge variant={s.status === "open" ? "success" : "muted"}>{STATUS[s.status]}</Badge>
                    {s.anonymous && <Badge variant="info">Ẩn danh</Badge>}
                    <Badge variant="muted">{s.questions.length} câu</Badge>
                    {s.closes_at && <Badge variant="muted">Hạn {new Date(s.closes_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}</Badge>}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {answered ? (
                  <span className="flex items-center gap-1 text-[12.5px] font-medium text-success"><CheckCircle2 className="h-4 w-4" /> Đã trả lời</span>
                ) : (
                  <Button size="sm" className="rounded-full" disabled={expired(s)} onClick={() => setAnswering(s)}>
                    {expired(s) ? "Đã đóng" : "Làm khảo sát"}
                  </Button>
                )}
                {isHr && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1 rounded-full" onClick={() => loadSurveyResults(s.id).then(setResults).catch((e) => toast.error(getErrorMessage(e)))}>
                      <BarChart3 className="h-3.5 w-3.5" /> Kết quả
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-full" onClick={async () => {
                      const closing = s.status === "open";
                      if (closing && !(await confirmDialog(`Đóng khảo sát “${s.title}”? Nhân viên sẽ không còn thấy và trả lời được.`, { confirmLabel: "Đóng khảo sát" }))) return;
                      try {
                        await setSurveyStatus(s.id, closing ? "closed" : "open");
                        toast.success(closing ? "Đã đóng khảo sát" : "Đã mở lại khảo sát");
                        await load();
                      } catch (e) { toast.error(getErrorMessage(e)); }
                    }}>
                      {s.status === "open" ? "Đóng" : "Mở lại"}
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1 rounded-full text-destructive" onClick={async () => {
                      if (!(await confirmDialog(`Xoá khảo sát “${s.title}” và toàn bộ câu trả lời? Không thể hoàn tác.`, { confirmLabel: "Xoá" }))) return;
                      try {
                        await deleteSurvey(s.id);
                        toast.success("Đã xoá khảo sát");
                        await load();
                      } catch (e) { toast.error(getErrorMessage(e)); }
                    }}>
                      <Trash2 className="h-3.5 w-3.5" /> Xoá
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {answering && <AnswerDialog survey={answering} onClose={() => setAnswering(null)} onDone={load} />}
      {creating && companyId && <CreateDialog companyId={companyId} onClose={() => setCreating(false)} onDone={load} />}
      {results && <ResultsDialog data={results} onClose={() => setResults(null)} />}
    </AppShell>
  );
};

const AnswerDialog = ({ survey, onClose, onDone }: { survey: Survey; onClose: () => void; onDone: () => void }) => {
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const set = (id: string, v: Answers[string]) => setAnswers((a) => ({ ...a, [id]: v }));
  const submit = async () => {
    const missing = survey.questions.find((q) => {
      const v = answers[q.id];
      return v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
    });
    if (missing) return toast.error(`Chưa trả lời: ${missing.label}`);
    setBusy(true);
    try {
      await submitSurvey(survey, answers);
      toast.success("Đã gửi khảo sát. Cảm ơn bạn!");
      onClose();
      onDone();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{survey.title}</DialogTitle>
          <DialogDescription>{survey.anonymous ? "Khảo sát ẩn danh — HR không thấy tên bạn." : "Câu trả lời ghi kèm tên bạn."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {survey.questions.map((q, i) => (
            <div key={q.id}>
              <p className="mb-1.5 text-[13.5px] font-semibold">{i + 1}. {q.label}</p>
              {q.type === "text" && <Textarea value={String(answers[q.id] ?? "")} onChange={(e) => set(q.id, e.target.value)} maxLength={1000} />}
              {q.type === "rating" && (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => set(q.id, n)}
                      className={`h-11 w-11 rounded-full text-[14px] font-bold ${answers[q.id] === n ? "bg-brand-orange text-white" : "bg-muted text-foreground"}`}>{n}</button>
                  ))}
                </div>
              )}
              {(q.type === "single" || q.type === "multi") && (
                <div className="space-y-1.5">
                  {(q.options ?? []).map((opt) => {
                    const cur = answers[q.id];
                    const checked = q.type === "single" ? cur === opt : Array.isArray(cur) && cur.includes(opt);
                    return (
                      <button key={opt} type="button"
                        onClick={() => {
                          if (q.type === "single") return set(q.id, opt);
                          const list = Array.isArray(cur) ? cur : [];
                          set(q.id, checked ? list.filter((x) => x !== opt) : [...list, opt]);
                        }}
                        className={`flex min-h-11 w-full items-center rounded-xl px-3 text-left text-[13.5px] ring-1 ${checked ? "bg-primary-subtle font-semibold text-brand-navy ring-brand-navy" : "ring-border"}`}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button className="w-full bg-brand-orange text-white hover:bg-brand-orange/90" disabled={busy} onClick={submit}>Gửi khảo sát</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CreateDialog = ({ companyId, onClose, onDone }: { companyId: string; onClose: () => void; onDone: () => void }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [closesAt, setClosesAt] = useState("");
  const [questions, setQuestions] = useState<(SurveyQuestion & { optionsText: string })[]>([
    { id: crypto.randomUUID(), type: "rating", label: "", optionsText: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const update = (id: string, patch: Partial<SurveyQuestion & { optionsText: string }>) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const save = async () => {
    if (!title.trim()) return toast.error("Nhập tiêu đề khảo sát.");
    const clean: SurveyQuestion[] = questions.map(({ optionsText, ...q }) => ({
      ...q, label: q.label.trim(),
      options: q.type === "single" || q.type === "multi" ? optionsText.split(/\n|;/).map((o) => o.trim()).filter(Boolean) : undefined,
    }));
    if (clean.length === 0 || clean.some((q) => !q.label)) return toast.error("Mỗi câu hỏi cần nội dung.");
    if (clean.some((q) => q.options && q.options.length < 2)) return toast.error("Câu chọn cần ít nhất 2 lựa chọn.");
    setBusy(true);
    try {
      await createSurvey({ company_id: companyId, title: title.trim(), description: description.trim() || null, questions: clean, anonymous, closes_at: closesAt ? new Date(`${closesAt}T23:59:59`).toISOString() : null });
      toast.success("Đã mở khảo sát cho nhân viên");
      onClose();
      onDone();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Tạo khảo sát</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Tiêu đề" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          <Textarea placeholder="Mô tả (không bắt buộc)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <label className="flex items-center justify-between text-[13px]">Ẩn danh <Switch checked={anonymous} onCheckedChange={setAnonymous} /></label>
          <label className="block text-[13px]">Hạn trả lời (không bắt buộc)
            <Input type="date" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className="mt-1" />
          </label>
          {questions.map((q, i) => (
            <div key={q.id} className="space-y-2 rounded-xl p-3 ring-1 ring-border">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-muted-foreground">Câu {i + 1}</span>
                <select value={q.type} onChange={(e) => update(q.id, { type: e.target.value as QuestionType })} className="h-9 flex-1 rounded-md border bg-background px-2 text-[13px]">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {questions.length > 1 && (
                  <Button size="icon" variant="ghost" aria-label="Xoá câu" onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))}><Trash2 className="h-4 w-4" /></Button>
                )}
              </div>
              <Input placeholder="Nội dung câu hỏi" value={q.label} onChange={(e) => update(q.id, { label: e.target.value })} />
              {(q.type === "single" || q.type === "multi") && (
                <Textarea placeholder="Mỗi lựa chọn một dòng" value={q.optionsText} onChange={(e) => update(q.id, { optionsText: e.target.value })} />
              )}
            </div>
          ))}
          <Button variant="outline" className="w-full gap-1" onClick={() => setQuestions((qs) => [...qs, { id: crypto.randomUUID(), type: "single", label: "", optionsText: "" }])}>
            <Plus className="h-4 w-4" /> Thêm câu hỏi
          </Button>
        </div>
        <DialogFooter>
          <Button className="w-full bg-brand-orange text-white hover:bg-brand-orange/90" disabled={busy} onClick={save}>Mở khảo sát</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ResultsDialog = ({ data, onClose }: { data: SurveyResults; onClose: () => void }) => {
  const { survey, responses, members } = data;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kết quả: {survey.title}</DialogTitle>
          <DialogDescription>{responses.length}/{members} thành viên đã trả lời{survey.anonymous ? " · ẩn danh" : ""}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {survey.questions.map((q, i) => {
            const values = responses.map((r) => r.answers[q.id]).filter((v) => v !== undefined);
            if (q.type === "text") {
              return (
                <div key={q.id}>
                  <p className="text-[13.5px] font-semibold">{i + 1}. {q.label}</p>
                  <ul className="mt-1 space-y-1 text-[12.5px]">
                    {responses.filter((r) => r.answers[q.id]).map((r, k) => (
                      <li key={k} className="rounded-lg bg-muted px-2 py-1.5">{String(r.answers[q.id])}{r.name ? <span className="text-muted-foreground"> — {r.name}</span> : null}</li>
                    ))}
                  </ul>
                </div>
              );
            }
            const opts = q.type === "rating" ? ["1", "2", "3", "4", "5"] : q.options ?? [];
            const count = (o: string) => values.filter((v) => (Array.isArray(v) ? v.includes(o) : String(v) === o)).length;
            const avg = q.type === "rating" && values.length ? (values.reduce<number>((s, v) => s + Number(v), 0) / values.length).toFixed(1) : null;
            return (
              <div key={q.id}>
                <p className="text-[13.5px] font-semibold">{i + 1}. {q.label}{avg ? ` · TB ${avg}/5` : ""}</p>
                <div className="mt-1.5 space-y-1">
                  {opts.map((o) => {
                    const n = count(o);
                    const pct = values.length ? Math.round((n * 100) / values.length) : 0;
                    return (
                      <div key={o} className="text-[12.5px]">
                        <div className="flex justify-between"><span>{o}</span><span>{n} ({pct}%)</span></div>
                        <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-brand-orange" style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeSurveys;
