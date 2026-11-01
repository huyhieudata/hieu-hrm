import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { Copy, Pencil, Play, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { EmailEditor } from "@/components/settings/email-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCompany } from "@/lib/company-provider";
import {
  EVENTS, SAMPLE_VARS, deleteRule, deleteTemplate, eventDef, invokeMailer, listLogs, listQueue, listRules,
  listTemplates, renderTemplate, retryQueue, runDailyNow, sanitizeEmailHtml, saveRule, saveTemplate, varsFor,
  type EmailLog, type EmailQueueRow, type EmailRule, type EmailTemplate, type EventKey,
} from "@/lib/email-automation";
import { useOrgStructure } from "@/lib/use-org-structure";
import { getErrorMessage } from "@/lib/utils";

const TABS = [
  ["mau", "Mẫu email"], ["luong-tu-dong", "Luồng tự động"], ["nhat-ky", "Nhật ký gửi"], ["cau-hinh", "Cấu hình gửi mail"],
] as const;
const selectCls = "h-10 w-full rounded-md border bg-background px-3 text-base sm:text-sm";
const fmt = (d: string) => new Date(d).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
const reasonText = (r?: unknown) =>
  r === "NOT_CONFIGURED" ? "Chưa cấu hình máy chủ gửi mail (SMTP/Brevo)." : String(r ?? "Lỗi không rõ");

/* ---------------- Mẫu email ---------------- */
const TemplatesTab = ({ companyId }: { companyId: string }) => {
  const [rows, setRows] = useState<EmailTemplate[]>([]);
  const [edit, setEdit] = useState<Partial<EmailTemplate> | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => listTemplates(companyId).then(setRows).catch((e) => toast.error(getErrorMessage(e))), [companyId]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!edit?.name || !edit.code || !edit.subject) return toast.error("Nhập tên, mã và tiêu đề.");
    if (!/^[a-z0-9_]{2,40}$/.test(edit.code)) return toast.error("Mã chỉ gồm chữ thường không dấu, số, gạch dưới.");
    setBusy(true);
    try {
      await saveTemplate({ ...edit, company_id: companyId } as EmailTemplate);
      toast.success("Đã lưu mẫu");
      setEdit(null);
      void load();
    } catch (e) { toast.error(getErrorMessage(e)); } finally { setBusy(false); }
  };
  const duplicate = (t: EmailTemplate) =>
    setEdit({ name: `${t.name} (bản sao)`, code: `${t.code}_2`.slice(0, 40), subject: t.subject, body_html: t.body_html, event_key: t.event_key, active: false });
  const testSend = async (t: Partial<EmailTemplate>) => {
    if (!t.id) return toast.error("Lưu mẫu trước khi gửi thử.");
    const r = await invokeMailer({ mode: "test", template_id: t.id });
    if (r.sent) toast.success(`Đã gửi thử tới ${r.to}`); else toast.error(`Chưa gửi được: ${reasonText(r.reason ?? r.error)}`);
  };
  const vars = varsFor(edit?.event_key);
  const html = sanitizeEmailHtml(renderTemplate(edit?.body_html ?? "", SAMPLE_VARS));

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setEdit({ name: "", code: "", subject: "", body_html: "<p>Xin chào {{ten_nhan_vien}},</p>", active: true, event_key: null })}>
          <Plus className="mr-1 h-4 w-4" /> Thêm mẫu
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr><th className="p-3">Tên mẫu</th><th className="p-3">Mã</th><th className="p-3">Sự kiện</th><th className="p-3">Tiêu đề</th><th className="p-3">Bật</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-3 font-medium">{t.name} {t.is_default && <Badge variant="secondary" className="ml-1">Mặc định</Badge>}</td>
                <td className="p-3 font-mono text-xs">{t.code}</td>
                <td className="p-3">{eventDef(t.event_key)?.label ?? "—"}</td>
                <td className="max-w-[260px] truncate p-3">{t.subject}</td>
                <td className="p-3">
                  <Switch checked={t.active} aria-label="Bật/tắt mẫu" onCheckedChange={async (v) => {
                    try { await saveTemplate({ id: t.id, company_id: companyId, active: v, body_html: t.body_html }); void load(); } catch (e) { toast.error(getErrorMessage(e)); }
                  }} />
                </td>
                <td className="whitespace-nowrap p-3 text-right">
                  <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Sửa" onClick={() => setEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Nhân bản" onClick={() => duplicate(t)}><Copy className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Gửi thử cho tôi" onClick={() => void testSend(t)}><Send className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-10 w-10 text-destructive" aria-label="Xoá" onClick={async () => {
                    if (!window.confirm(`Xoá mẫu "${t.name}"? Luồng đang dùng mẫu này sẽ không gửi.`)) return;
                    try { await deleteTemplate(t.id); void load(); } catch (e) { toast.error(getErrorMessage(e)); }
                  }}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Chưa có mẫu email.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{edit?.id ? "Sửa mẫu email" : "Mẫu email mới"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><Label htmlFor="tpl-name">Tên mẫu</Label><Input id="tpl-name" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
                <div><Label htmlFor="tpl-code">Mã (dùng nội bộ)</Label><Input id="tpl-code" value={edit.code ?? ""} disabled={!!edit.id && edit.is_default} onChange={(e) => setEdit({ ...edit, code: e.target.value.toLowerCase() })} /></div>
                <div><Label htmlFor="tpl-event">Loại sự kiện (gợi ý biến)</Label>
                  <select id="tpl-event" className={selectCls} value={edit.event_key ?? ""} onChange={(e) => setEdit({ ...edit, event_key: e.target.value || null })}>
                    <option value="">Chung</option>{EVENTS.map((ev) => <option key={ev.key} value={ev.key}>{ev.label}</option>)}
                  </select></div>
              </div>
              <div><Label htmlFor="tpl-subject">Tiêu đề</Label><Input id="tpl-subject" value={edit.subject ?? ""} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} /></div>
              <div className="flex items-center justify-between">
                <Label>Nội dung</Label>
                <div className="flex items-center gap-2 text-sm">
                  <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => setPreview((v) => !v)}>{preview ? "Soạn thảo" : "Xem trước"}</Button>
                </div>
              </div>
              {preview ? (
                <div className="rounded-lg border bg-white p-4 text-brand-navy">
                  <p className="mb-2 border-b pb-2 text-sm"><b>Tiêu đề:</b> {renderTemplate(edit.subject ?? "", SAMPLE_VARS, false)}</p>
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
                </div>
              ) : (
                <EmailEditor value={edit.body_html ?? ""} onChange={(v) => setEdit((p) => (p ? { ...p, body_html: v } : p))} variables={vars} />
              )}
              <label className="flex items-center gap-2 text-sm"><Switch checked={edit.active ?? true} onCheckedChange={(v) => setEdit({ ...edit, active: v })} /> Đang dùng</label>
            </div>
          )}
          <DialogFooter className="sticky bottom-0 gap-2 bg-card pt-2">
            {edit?.id && <Button variant="outline" className="h-11" onClick={() => void testSend(edit)}><Send className="mr-1 h-4 w-4" />Gửi thử cho tôi</Button>}
            <Button variant="outline" className="h-11" onClick={() => setEdit(null)}>Huỷ</Button>
            <Button className="h-11" disabled={busy} onClick={() => void save()}>Lưu mẫu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ---------------- Luồng tự động ---------------- */
const csv = (v?: string[]) => (v ?? []).join(", ");
const parseCsv = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

const MultiPick = ({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) => (
  <div>
    <Label>{label}</Label>
    <div className="mt-1 flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-md border p-2">
      {options.length === 0 && <span className="text-xs text-muted-foreground">Chưa có dữ liệu trên sơ đồ tổ chức</span>}
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={`min-h-[36px] rounded-full border px-3 text-xs ${on ? "border-brand-navy bg-brand-navy text-white" : "hover:bg-muted"}`}>{o}</button>
        );
      })}
    </div>
    <p className="mt-1 text-[11px] text-muted-foreground">Để trống = tất cả.</p>
  </div>
);

const RulesTab = ({ companyId }: { companyId: string }) => {
  const org = useOrgStructure();
  const [rules, setRules] = useState<EmailRule[]>([]);
  const [tpls, setTpls] = useState<EmailTemplate[]>([]);
  const [edit, setEdit] = useState<Partial<EmailRule> | null>(null);
  const load = useCallback(async () => {
    try { const [r, t] = await Promise.all([listRules(companyId), listTemplates(companyId)]); setRules(r); setTpls(t); }
    catch (e) { toast.error(getErrorMessage(e)); }
  }, [companyId]);
  useEffect(() => { void load(); }, [load]);
  const depts = useMemo(() => org.departmentOptions.map((o) => o.label), [org.departmentOptions]);
  const positions = useMemo(() => Array.from(new Set(org.allPositionOptions.map((o) => o.label))), [org.allPositionOptions]);

  const newRule = (event: EventKey = "employee_joined"): Partial<EmailRule> => ({
    name: "", event_key: event, conditions: {}, recipients: { employee: true }, offset_days: event === "contract_expiring" ? 30 : 0,
    threshold: 3, delay_minutes: 0, send_hour: 8, active: true,
    template_id: tpls.find((t) => t.event_key === event)?.id ?? null,
  });
  const save = async () => {
    if (!edit?.name || !edit.event_key || !edit.template_id) return toast.error("Nhập tên, sự kiện và chọn mẫu email.");
    try { await saveRule({ ...edit, company_id: companyId } as EmailRule); toast.success("Đã lưu luồng"); setEdit(null); void load(); }
    catch (e) { toast.error(getErrorMessage(e)); }
  };
  const ev = eventDef(edit?.event_key);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={async () => {
          try { const n = await runDailyNow(companyId); const r = await invokeMailer({ mode: "process", company_id: companyId });
            toast.success(`Đã xếp ${n} thư theo ngày; xử lý ${r.processed ?? 0} thư (gửi ${r.sent ?? 0}).`); }
          catch (e) { toast.error(getErrorMessage(e)); }
        }}><Play className="mr-1 h-4 w-4" /> Chạy ngay</Button>
        <Button onClick={() => setEdit(newRule())}><Plus className="mr-1 h-4 w-4" /> Thêm luồng</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {rules.map((r) => {
          const d = eventDef(r.event_key);
          const rec = [r.recipients.employee && "Nhân viên", r.recipients.manager && "Quản lý trực tiếp", r.recipients.hr && "HR", ...(r.recipients.emails ?? [])].filter(Boolean).join(", ");
          return (
            <div key={r.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-xs text-brand-orange">{d?.label}{d?.offsetLabel && r.offset_days ? ` · trước ${r.offset_days} ngày` : ""}{d?.threshold ? ` · ≥ ${r.threshold} lần` : ""}</p>
                </div>
                <Switch checked={r.active} aria-label="Bật/tắt luồng" onCheckedChange={async (v) => { try { await saveRule({ id: r.id, company_id: companyId, active: v }); void load(); } catch (e) { toast.error(getErrorMessage(e)); } }} />
              </div>
              <p className="mt-2 text-sm"><span className="text-muted-foreground">Mẫu:</span> {tpls.find((t) => t.id === r.template_id)?.name ?? <span className="text-destructive">chưa chọn</span>}</p>
              <p className="text-sm"><span className="text-muted-foreground">Gửi tới:</span> {rec || "—"}</p>
              <p className="text-sm text-muted-foreground">{d?.kind === "daily" ? `Hằng ngày lúc ${r.send_hour}:00` : r.delay_minutes ? `Trễ ${r.delay_minutes} phút` : "Gửi ngay"}
                {csv(r.conditions.departments) && ` · PB: ${csv(r.conditions.departments)}`}{csv(r.conditions.positions) && ` · CD: ${csv(r.conditions.positions)}`}</p>
              <div className="mt-2 flex justify-end gap-1">
                <Button size="sm" variant="ghost" className="h-10" onClick={() => setEdit(r)}><Pencil className="mr-1 h-4 w-4" />Sửa</Button>
                <Button size="sm" variant="ghost" className="h-10 text-destructive" onClick={async () => { if (window.confirm("Xoá luồng này?")) { try { await deleteRule(r.id); void load(); } catch (e) { toast.error(getErrorMessage(e)); } } }}><Trash2 className="mr-1 h-4 w-4" />Xoá</Button>
              </div>
            </div>
          );
        })}
        {rules.length === 0 && <p className="text-sm text-muted-foreground">Chưa có luồng nào. Bấm “Thêm luồng” để tạo, ví dụ “Chào mừng khi nhân viên tham gia”.</p>}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? "Sửa luồng tự động" : "Luồng tự động mới"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <div><Label htmlFor="r-name">Tên luồng</Label><Input id="r-name" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor="r-event">Khi (sự kiện)</Label>
                  <select id="r-event" className={selectCls} value={edit.event_key} onChange={(e) => {
                    const k = e.target.value as EventKey;
                    setEdit({ ...edit, event_key: k, template_id: edit.template_id ?? tpls.find((t) => t.event_key === k)?.id ?? null });
                  }}>{EVENTS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></div>
                <div><Label htmlFor="r-tpl">Mẫu email</Label>
                  <select id="r-tpl" className={selectCls} value={edit.template_id ?? ""} onChange={(e) => setEdit({ ...edit, template_id: e.target.value || null })}>
                    <option value="">— Chọn mẫu —</option>{tpls.map((t) => <option key={t.id} value={t.id}>{t.name}{t.active ? "" : " (đang tắt)"}</option>)}
                  </select></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {ev?.offsetLabel && <div><Label htmlFor="r-off">{ev.offsetLabel}</Label><Input id="r-off" type="number" min={0} max={365} value={edit.offset_days ?? 0} onChange={(e) => setEdit({ ...edit, offset_days: Number(e.target.value) })} /></div>}
                {ev?.threshold && <div><Label htmlFor="r-th">Số lần đi muộn N</Label><Input id="r-th" type="number" min={1} value={edit.threshold ?? 3} onChange={(e) => setEdit({ ...edit, threshold: Number(e.target.value) })} /></div>}
                {ev?.kind === "daily" ? (
                  <div><Label htmlFor="r-hour">Giờ gửi (giờ VN)</Label><Input id="r-hour" type="number" min={0} max={23} value={edit.send_hour ?? 8} onChange={(e) => setEdit({ ...edit, send_hour: Number(e.target.value) })} /></div>
                ) : (
                  <div><Label htmlFor="r-delay">Gửi trễ (phút)</Label><Input id="r-delay" type="number" min={0} value={edit.delay_minutes ?? 0} onChange={(e) => setEdit({ ...edit, delay_minutes: Number(e.target.value) })} /></div>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <MultiPick label="Lọc phòng ban" options={depts} value={edit.conditions?.departments ?? []} onChange={(v) => setEdit({ ...edit, conditions: { ...edit.conditions, departments: v } })} />
                <MultiPick label="Lọc chức danh" options={positions} value={edit.conditions?.positions ?? []} onChange={(v) => setEdit({ ...edit, conditions: { ...edit.conditions, positions: v } })} />
              </div>
              {edit.event_key === "contract_expiring" && (
                <div><Label htmlFor="r-ct">Loại hợp đồng (cách nhau dấu phẩy, trống = tất cả)</Label><Input id="r-ct" value={csv(edit.conditions?.contract_types)} onChange={(e) => setEdit({ ...edit, conditions: { ...edit.conditions, contract_types: parseCsv(e.target.value) } })} /></div>
              )}
              <div>
                <Label>Người nhận</Label>
                <div className="mt-1 flex flex-wrap gap-4 text-sm">
                  {([["employee", "Nhân viên"], ["manager", "Quản lý trực tiếp"], ["hr", "HR công ty"]] as const).map(([k, l]) => (
                    <label key={k} className="flex min-h-[44px] items-center gap-2"><Switch checked={!!edit.recipients?.[k]} onCheckedChange={(v) => setEdit({ ...edit, recipients: { ...edit.recipients, [k]: v } })} />{l}</label>
                  ))}
                </div>
                {edit.event_key === "invite_sent" && <p className="text-[11px] text-muted-foreground">Thư mời cho chính người được mời do nút “Gửi lời mời” gửi (dùng mẫu mã <b>loi_moi</b>); luồng này dùng để báo cho quản lý/HR/email khác.</p>}
                <Label htmlFor="r-emails" className="mt-2 block">Email cố định (cách nhau dấu phẩy)</Label>
                <Input id="r-emails" value={csv(edit.recipients?.emails)} onChange={(e) => setEdit({ ...edit, recipients: { ...edit.recipients, emails: parseCsv(e.target.value) } })} />
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={edit.active ?? true} onCheckedChange={(v) => setEdit({ ...edit, active: v })} /> Đang bật</label>
            </div>
          )}
          <DialogFooter className="sticky bottom-0 gap-2 bg-card pt-2">
            <Button variant="outline" className="h-11" onClick={() => setEdit(null)}>Huỷ</Button>
            <Button className="h-11" onClick={() => void save()}>Lưu luồng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ---------------- Nhật ký ---------------- */
const STATUS: Record<string, string> = { pending: "Chờ gửi", sending: "Đang gửi", sent: "Đã gửi", failed: "Lỗi", skipped: "Bỏ qua" };
const LogsTab = ({ companyId }: { companyId: string }) => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [queue, setQueue] = useState<EmailQueueRow[]>([]);
  const load = useCallback(async () => {
    try { const [l, q] = await Promise.all([listLogs(companyId), listQueue(companyId)]); setLogs(l); setQueue(q); }
    catch (e) { toast.error(getErrorMessage(e)); }
  }, [companyId]);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />Tải lại</Button></div>
      <h3 className="text-sm font-semibold">Hàng đợi</h3>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm"><thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="p-3">Tạo lúc</th><th className="p-3">Hẹn gửi</th><th className="p-3">Sự kiện</th><th className="p-3">Người nhận</th><th className="p-3">Trạng thái</th><th className="p-3" /></tr></thead>
          <tbody>{queue.map((q) => (
            <tr key={q.id} className="border-t"><td className="p-3">{fmt(q.created_at)}</td><td className="p-3">{fmt(q.scheduled_at)}</td><td className="p-3">{eventDef(q.event_key)?.label ?? q.event_key}</td><td className="p-3">{q.to_email}</td>
              <td className="p-3"><Badge variant={q.status === "sent" ? "default" : q.status === "failed" ? "destructive" : "secondary"}>{STATUS[q.status] ?? q.status}</Badge>{q.error && <span className="ml-2 text-xs text-muted-foreground">{reasonText(q.error)}</span>}</td>
              <td className="p-3 text-right">{(q.status === "failed" || q.status === "skipped") && <Button size="sm" variant="ghost" className="h-10" onClick={async () => { try { await retryQueue(q.id); void load(); } catch (e) { toast.error(getErrorMessage(e)); } }}>Gửi lại</Button>}</td></tr>
          ))}{queue.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Hàng đợi trống.</td></tr>}</tbody></table>
      </div>
      <h3 className="text-sm font-semibold">Nhật ký gửi</h3>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm"><thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="p-3">Thời gian</th><th className="p-3">Người nhận</th><th className="p-3">Tiêu đề</th><th className="p-3">Sự kiện</th><th className="p-3">Kết quả</th></tr></thead>
          <tbody>{logs.map((l) => (
            <tr key={l.id} className="border-t"><td className="p-3">{fmt(l.created_at)}</td><td className="p-3">{l.to_email}</td><td className="max-w-[260px] truncate p-3">{l.subject ?? "—"}</td><td className="p-3">{l.event_key === "test" ? "Gửi thử" : eventDef(l.event_key)?.label ?? l.event_key}</td>
              <td className="p-3"><Badge variant={l.status === "sent" ? "default" : "destructive"}>{STATUS[l.status] ?? l.status}</Badge>{l.error && <span className="ml-2 text-xs text-muted-foreground">{reasonText(l.error)}</span>}</td></tr>
          ))}{logs.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Chưa có thư nào.</td></tr>}</tbody></table>
      </div>
    </div>
  );
};

const ConfigTab = ({ companyId }: { companyId: string }) => {
  const [res, setRes] = useState<string>("");
  return (
    <div className="max-w-2xl space-y-3 rounded-xl border bg-card p-5 text-sm">
      <p>Máy chủ gửi mail dùng chung cho nút “Gửi lời mời” và các luồng tự động, cấu hình bằng secret của Supabase Edge Function: <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code>, <code>MAIL_FROM</code>, <code>MAIL_FROM_NAME</code> (hoặc <code>BREVO_API_KEY</code>). Mật khẩu không hiển thị ở đây.</p>
      <p>Hàng đợi được xử lý tự động mỗi 10 phút (pg_cron). Sự kiện theo ngày (sinh nhật, hợp đồng, thử việc, nhắc chấm công) được xếp khi tới giờ gửi của luồng. Mỗi sự kiện chỉ gửi một lần cho mỗi người nhận.</p>
      <Button onClick={async () => { const r = await invokeMailer({ mode: "process", company_id: companyId }); setRes(r.error ? String(r.error) : r.configured ? `Đã cấu hình. Xử lý ${r.processed} thư.` : "Chưa cấu hình SMTP/Brevo — thư sẽ ghi lỗi NOT_CONFIGURED."); }}>
        Kiểm tra cấu hình & xử lý hàng đợi
      </Button>
      {res && <p className="font-medium text-brand-navy">{res}</p>}
    </div>
  );
};

const EmailSettings = () => {
  const { tab = "mau" } = useParams();
  const { activeCompany, role } = useCompany();
  const allowed = role === "owner" || role === "admin" || role === "hr";
  return (
    <AppShell>
      <PageHeader eyebrow="Cài đặt · Email" title="Email" description="Mẫu email, luồng gửi tự động và nhật ký gửi." />
      <div className="flex gap-1 overflow-x-auto border-b">
        {TABS.map(([k, l]) => (
          <NavLink key={k} to={`/cai-dat/email/${k}`} className={({ isActive }) => `min-h-[44px] whitespace-nowrap border-b-2 px-3 py-2.5 text-sm ${isActive ? "border-brand-orange font-semibold text-brand-navy" : "border-transparent text-muted-foreground"}`}>{l}</NavLink>
        ))}
      </div>
      {!allowed || !activeCompany ? <p className="text-sm text-muted-foreground">Chỉ chủ sở hữu, quản trị viên hoặc HR được cấu hình email.</p>
        : tab === "luong-tu-dong" ? <RulesTab companyId={activeCompany.id} />
        : tab === "nhat-ky" ? <LogsTab companyId={activeCompany.id} />
        : tab === "cau-hinh" ? <ConfigTab companyId={activeCompany.id} />
        : <TemplatesTab companyId={activeCompany.id} />}
    </AppShell>
  );
};
export default EmailSettings;
