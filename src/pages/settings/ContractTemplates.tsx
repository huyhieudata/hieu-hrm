import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { SettingsShell } from "@/components/settings/settings-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCompany } from "@/lib/company-provider";
import {
  CONTRACT_TEMPLATE_VARS,
  DEFAULT_CONTRACT_TEMPLATE,
  deleteContractTemplate,
  listContractTemplates,
  renderContractTemplate,
  saveContractTemplate,
  type ContractTemplate,
} from "@/lib/contract-docs";
import { CONTRACT_TYPE_LABELS } from "@/lib/employee-records";
import { getErrorMessage } from "@/lib/utils";

type Draft = { id?: string; name: string; contract_type: string; body_html: string; active: boolean };
const blank = (): Draft => ({ name: "Mẫu HĐLĐ", contract_type: "", body_html: DEFAULT_CONTRACT_TEMPLATE, active: true });

const ContractTemplates = () => {
  const { activeCompany, canDo } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const canEdit = canDo("contracts", "edit");
  const [rows, setRows] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setRows(await listContractTemplates(companyId));
    } catch (error) {
      toast.error("Không tải được mẫu", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId]);
  useEffect(() => {
    void load();
  }, [load]);

  const preview = useMemo(() => {
    if (!draft) return "";
    const sample = Object.fromEntries(CONTRACT_TEMPLATE_VARS.map((v) => [v.key, `[${v.label}]`]));
    return renderContractTemplate(draft.body_html, sample);
  }, [draft]);

  const save = async () => {
    if (!companyId || !draft) return;
    if (!draft.name.trim()) return toast.error("Nhập tên mẫu");
    if (!draft.body_html.trim()) return toast.error("Nội dung mẫu đang trống");
    setSaving(true);
    try {
      await saveContractTemplate({
        id: draft.id,
        company_id: companyId,
        name: draft.name.trim(),
        contract_type: draft.contract_type || null,
        body_html: draft.body_html,
        active: draft.active,
      });
      toast.success("Đã lưu mẫu hợp đồng");
      setDraft(null);
      await load();
    } catch (error) {
      toast.error("Không lưu được", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsShell
      title="Mẫu hợp đồng lao động"
      description="Mẫu dùng khi Xuất Word / In PDF hợp đồng. Không có mẫu riêng ⇒ dùng mẫu mặc định theo BLLĐ 2019."
      actions={
        canEdit && !draft && (
          <Button className="h-9 gap-1.5 text-[12.5px]" onClick={() => setDraft(blank())}>
            <Plus className="h-4 w-4" /> Thêm mẫu
          </Button>
        )
      }
    >
      {draft ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <Card className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-[12.5px] font-medium">
                Tên mẫu
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <label className="space-y-1 text-[12.5px] font-medium">
                Áp dụng cho loại HĐ
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px]"
                  value={draft.contract_type}
                  onChange={(e) => setDraft({ ...draft, contract_type: e.target.value })}
                >
                  <option value="">Mọi loại hợp đồng</option>
                  {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              Đang dùng
            </label>
            <label className="block space-y-1 text-[12.5px] font-medium">
              Nội dung (HTML, dùng biến dạng {"{{ten_bien}}"})
              <textarea
                className="min-h-[320px] w-full rounded-md border border-input bg-background p-3 font-mono text-[12px]"
                value={draft.body_html}
                onChange={(e) => setDraft({ ...draft, body_html: e.target.value })}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button className="h-10 gap-1.5" disabled={saving} onClick={() => void save()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu mẫu
              </Button>
              <Button variant="outline" className="h-10 gap-1.5" onClick={() => setDraft({ ...draft, body_html: DEFAULT_CONTRACT_TEMPLATE })}>
                <RotateCcw className="h-4 w-4" /> Dùng mẫu mặc định
              </Button>
              <Button variant="ghost" className="h-10" onClick={() => setDraft(null)}>
                Huỷ
              </Button>
            </div>
            <div>
              <p className="mb-1 text-[12px] font-semibold text-muted-foreground">Xem trước</p>
              <div
                className="max-h-[420px] overflow-auto rounded-md border border-border bg-white p-4 text-[13px] text-black"
                dangerouslySetInnerHTML={{ __html: preview }}
              />
            </div>
          </Card>
          <Card className="h-fit p-4">
            <p className="text-[12.5px] font-semibold">Biến có sẵn</p>
            <p className="text-[11px] text-muted-foreground">Bấm để chèn vào cuối nội dung.</p>
            <ul className="mt-2 space-y-1">
              {CONTRACT_TEMPLATE_VARS.map((v) => (
                <li key={v.key}>
                  <button
                    type="button"
                    className="w-full rounded px-1.5 py-1 text-left text-[12px] hover:bg-muted"
                    onClick={() => setDraft({ ...draft, body_html: `${draft.body_html}{{${v.key}}}` })}
                  >
                    <code className="text-primary">{`{{${v.key}}}`}</code> <span className="text-muted-foreground">{v.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : loading ? (
        <p className="text-[13px] text-muted-foreground">Đang tải…</p>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-muted-foreground">
          Chưa có mẫu riêng — hệ thống đang dùng mẫu HĐLĐ mặc định.
        </Card>
      ) : (
        <Card className="divide-y divide-border/60">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-[13px] font-semibold">{row.name}</span>
                <Badge variant="muted">{row.contract_type ? CONTRACT_TYPE_LABELS[row.contract_type] ?? row.contract_type : "Mọi loại"}</Badge>
                {!row.active && <Badge variant="outline">Tắt</Badge>}
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-9"
                    onClick={() =>
                      setDraft({ id: row.id, name: row.name, contract_type: row.contract_type ?? "", body_html: row.body_html, active: row.active })
                    }
                  >
                    Sửa
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-9 text-destructive"
                    aria-label="Xoá mẫu"
                    onClick={async () => {
                      if (!window.confirm(`Xoá mẫu "${row.name}"?`)) return;
                      try {
                        await deleteContractTemplate(row.id);
                        toast.success("Đã xoá mẫu");
                        await load();
                      } catch (error) {
                        toast.error(getErrorMessage(error));
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </SettingsShell>
  );
};

export default ContractTemplates;
