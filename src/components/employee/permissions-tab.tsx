import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { PermissionMatrix } from "@/components/permissions/permission-matrix";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/lib/company-provider";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/utils";
import {
  expandLegacyPermissions,
  getEmployeePermissions,
  SPECIAL_PERMISSION_OPTIONS,
  listPermissionGroups,
  saveEmployeePermissions,
  type PermissionGroup,
} from "@/lib/permissions";
import type { Permission } from "@/lib/roles";

interface PermissionsTabProps {
  employeeId: string;
  companyId: string;
  canManage: boolean;
}

const PermissionsTab = ({ employeeId, companyId, canManage }: PermissionsTabProps) => {
  const { refreshPermissions } = useCompany();
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [groupId, setGroupId] = useState("none");
  const [selected, setSelected] = useState<string[]>([]);
  const [denied, setDenied] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [groupRows, record] = await Promise.all([
        listPermissionGroups(companyId),
        getEmployeePermissions(employeeId),
      ]);
      setGroups(groupRows);
      setGroupId(record?.group_id ?? "none");
      setSelected(expandLegacyPermissions(record?.permissions ?? []));
      setDenied(expandLegacyPermissions(record?.denied_permissions ?? []));
    } catch (error) {
      toast.error("Không tải được phân quyền", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePermission = (permission: string) => {
    if (selected.includes(permission)) {
      setSelected((prev) => prev.filter((item) => item !== permission));
      setDenied((prev) => Array.from(new Set([...prev, permission])));
      return;
    }
    if (denied.includes(permission)) {
      setDenied((prev) => prev.filter((item) => item !== permission));
      return;
    }
    setSelected((prev) => Array.from(new Set([...prev, permission])));
  };

  const chooseGroup = (value: string) => {
    setGroupId(value);
    setDenied([]);
    if (value === "none") return;
    const group = groups.find((item) => item.id === value);
    if (group) setSelected(expandLegacyPermissions(group.permissions));
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveEmployeePermissions({
        employee_id: employeeId,
        company_id: companyId,
        group_id: groupId === "none" ? null : groupId,
        permissions: selected.filter((key) => !denied.includes(key)) as Permission[],
        denied_permissions: denied as Permission[],
      });
      try {
        await supabase.rpc("log_activity", {
          target_company: companyId,
          target_entity_type: "employee",
          target_entity_id: employeeId,
          target_action: "permission_update",
          target_summary: `Cập nhật quyền: cấp ${selected.length - denied.filter((key) => selected.includes(key)).length}, thu hồi ${denied.length}`,
        });
      } catch {
        /* audit log là tuỳ chọn */
      }
      toast.success("Đã lưu quyền cho nhân sự");
      await load();
      await refreshPermissions();
    } catch (error) {
      toast.error("Không lưu được quyền", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="flex items-center justify-center gap-2 p-12 text-[12.5px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải phân quyền…
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
            <KeyRound className="h-4 w-4 text-primary" /> Phân quyền nhân sự
          </h3>
          <p className="text-[11.5px] text-muted-foreground">
            Gán nhóm quyền và tinh chỉnh các quyền áp dụng riêng cho nhân sự này.
          </p>
        </div>
        <Badge variant="muted">
          {selected.filter((key) => !denied.includes(key)).length} cấp · {denied.length} thu hồi
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-[12px]">Nhóm quyền</Label>
          <Select value={groupId} onValueChange={chooseGroup} disabled={!canManage}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Chọn nhóm quyền" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Không dùng nhóm (tuỳ chỉnh)</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name} · {group.permissions.length} quyền
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Chọn nhóm để nạp sẵn quyền; sau đó có thể tích/bỏ từng quyền bên dưới.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border/70 bg-muted/20 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Quyền đặc biệt
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SPECIAL_PERMISSION_OPTIONS.map((option) => {
            const blocked = denied.includes(option.value);
            const checked = selected.includes(option.value) && !blocked;
            return (
              <button
                key={option.value}
                type="button"
                disabled={!canManage}
                onClick={() => togglePermission(option.value)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  blocked
                    ? "border-destructive bg-destructive-subtle text-destructive line-through"
                    : checked
                      ? "border-primary bg-primary-subtle text-primary-subtle-foreground"
                      : "border-border bg-card text-muted-foreground"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <PermissionMatrix
          selected={selected}
          denied={denied}
          onToggle={togglePermission}
          readOnly={!canManage}
          showDeny
        />
      </div>

      {canManage && (
        <div className="mt-4 flex justify-end">
          <Button className="h-9 gap-2" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Lưu phân quyền
          </Button>
        </div>
      )}
    </Card>
  );
};

export default PermissionsTab;
