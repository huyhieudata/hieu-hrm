import { ConfirmAction } from "@/components/common/confirm-action";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  KeyRound,
  Link2,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { PermissionMatrix } from "@/components/permissions/permission-matrix";
import { InviteDialog } from "@/components/team/invite-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AppInstallCell, AppInstallSummary } from "@/components/pwa/app-install-cell";
import { loadAppInstallStatus, type AppInstallStatus } from "@/lib/app-installs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { useCompany } from "@/lib/company-provider";
import { listEmployees, updateEmployee, type EmployeeRecord } from "@/lib/employee-records";
import { copyInviteLink } from "@/lib/invite-link";
import {
  PERMISSION_MODULES,
  SPECIAL_PERMISSION_OPTIONS,
  createPermissionGroup,
  deletePermissionGroup,
  expandLegacyPermissions,
  permissionLabel,
  listPermissionGroups,
  updatePermissionGroup,
  type PermissionGroup,
} from "@/lib/permissions";
import { ASSIGNABLE_ROLES, ROLE_BADGE, ROLE_LABELS, type Role } from "@/lib/roles";
import { getErrorMessage } from "@/lib/utils";

interface MemberRow {
  id: string;
  company_id: string;
  user_id: string;
  role: Role;
  status: string;
  job_title: string | null;
  department: string | null;
  joined_at: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  job_title: string | null;
}

interface InviteRow {
  id: string;
  token: string;
  email: string | null;
  role: Role;
  expires_at: string;
  accepted_at: string | null;
  revoked: boolean;
}

interface RoleBaseline {
  company_id: string;
  role: Role;
  permissions: string[];
}

const SPECIAL_VALUES = SPECIAL_PERMISSION_OPTIONS.map((option) => option.value as string);
const EDITABLE_ROLES: Role[] = ["admin", "hr", "manager", "employee"];

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

const Members = () => {
  const [installs, setInstalls] = useState<Map<string, AppInstallStatus>>(new Map());
  const [onlyNoApp, setOnlyNoApp] = useState(false);
  const { user } = useAuth();
  const { activeCompany, role, can, canDo, canManageModule, refreshPermissions } = useCompany();
  const companyId = activeCompany?.id ?? null;

  const [tab, setTab] = useState<"members" | "roles" | "groups">("members");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [baselines, setBaselines] = useState<Record<string, string[]>>({});
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<MemberRow | null>(null);
  const [linkMember, setLinkMember] = useState<MemberRow | null>(null);
  const [linkEmployeeId, setLinkEmployeeId] = useState("none");
  const [effectiveMember, setEffectiveMember] = useState<MemberRow | null>(null);
  const [effectiveKeys, setEffectiveKeys] = useState<string[]>([]);
  const [effectiveLoading, setEffectiveLoading] = useState(false);

  const [baselineRole, setBaselineRole] = useState<Role>("hr");
  const [baselineSelected, setBaselineSelected] = useState<string[]>([]);
  const [baselineSpecial, setBaselineSpecial] = useState<string[]>([]);
  const [baselineSaving, setBaselineSaving] = useState(false);

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupSelected, setGroupSelected] = useState<string[]>([]);
  const [groupSaving, setGroupSaving] = useState(false);
  const [pendingGroupDelete, setPendingGroupDelete] = useState<PermissionGroup | null>(null);

  const canInvite = can("members.invite") || canDo("members", "create");
  const canEditMembers = role === "owner" || role === "admin";
  const canDeleteMembers = role === "owner" || role === "admin";
  const canEditPermissions = role === "owner" || role === "admin";
  const canLinkEmployee = canManageModule("employees");
  const canViewEffective = role === "owner" || role === "admin" || role === "hr";

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [memberResult, employeeRows, inviteResult, baselineResult, groupRows] = await Promise.all([
        supabase
          .from("company_members")
          .select("id, company_id, user_id, role, status, job_title, department, joined_at")
          .eq("company_id", companyId)
          .order("joined_at", { ascending: true }),
        listEmployees(companyId),
        supabase
          .from("company_invites")
          .select("id, token, email, role, expires_at, accepted_at, revoked")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase.from("company_role_permissions").select("company_id, role, permissions").eq("company_id", companyId),
        listPermissionGroups(companyId),
      ]);
      void loadAppInstallStatus(companyId)
        .then((rows) => setInstalls(new Map(rows.map((row) => [row.user_id, row]))))
        .catch(() => setInstalls(new Map()));

      if (memberResult.error) throw memberResult.error;
      const memberRows = (memberResult.data ?? []) as MemberRow[];
      const userIds = memberRows.map((member) => member.user_id);
      const { data: profileRows } = userIds.length
        ? await supabase.from("profiles").select("id, full_name, email, job_title").in("id", userIds)
        : { data: [] as ProfileRow[] };
      const profileMap: Record<string, ProfileRow> = {};
      ((profileRows ?? []) as ProfileRow[]).forEach((profile) => {
        profileMap[profile.id] = profile;
      });

      setMembers(memberRows);
      setProfiles(profileMap);
      setEmployees(employeeRows);
      setInvites(((inviteResult.data ?? []) as InviteRow[]).filter((invite) => !invite.accepted_at && !invite.revoked));
      const baselineMap: Record<string, string[]> = {};
      ((baselineResult.data ?? []) as RoleBaseline[]).forEach((row) => {
        baselineMap[row.role] = row.permissions;
      });
      setBaselines(baselineMap);
      setGroups(groupRows);
    } catch (error) {
      toast.error("Không tải được thành viên", { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!companyId || !canEditPermissions) return;
    const loadBaseline = async () => {
      if (baselineRole === "owner") {
        const { data } = await supabase.rpc("default_role_permissions", { target_role: "owner" });
        setBaselineSelected(Array.isArray(data) ? (data as string[]) : []);
        setBaselineSpecial([]);
        return;
      }
      const stored = baselines[baselineRole];
      if (stored) {
        const expanded = expandLegacyPermissions(stored).filter((key) => !SPECIAL_VALUES.includes(key));
        setBaselineSelected(expanded);
        setBaselineSpecial(stored.filter((key) => SPECIAL_VALUES.includes(key)));
        return;
      }
      const { data } = await supabase.rpc("default_role_permissions", { target_role: baselineRole });
      const defaults = Array.isArray(data) ? (data as string[]) : [];
      setBaselineSelected(expandLegacyPermissions(defaults).filter((key) => !SPECIAL_VALUES.includes(key)));
      setBaselineSpecial(defaults.filter((key) => SPECIAL_VALUES.includes(key)));
    };
    void loadBaseline();
  }, [baselineRole, baselines, canEditPermissions, companyId]);

  const employeeByUser = useMemo(() => {
    const map = new Map<string, EmployeeRecord>();
    employees.forEach((employee) => {
      if (employee.user_id) map.set(employee.user_id, employee);
    });
    return map;
  }, [employees]);

  const unlinkedEmployees = useMemo(
    () => employees.filter((employee) => !employee.user_id && employee.status !== "resigned"),
    [employees],
  );

  const tenantGroups = groups.filter((group) => group.company_id === companyId);
  const globalGroups = groups.filter((group) => !group.company_id);

  const log = async (entityType: string, entityId: string, action: string, summary: string) => {
    if (!companyId) return;
    try {
      await supabase.rpc("log_activity", {
        target_company: companyId,
        target_entity_type: entityType,
        target_entity_id: entityId,
        target_action: action,
        target_summary: summary,
      });
    } catch {
      /* audit log là tuỳ chọn */
    }
  };

  const changeRole = async (member: MemberRow, nextRole: Role) => {
    try {
      const { error } = await supabase.from("company_members").update({ role: nextRole }).eq("id", member.id);
      if (error) throw error;
      toast.success(`Đã đổi vai trò ${profiles[member.user_id]?.full_name ?? "thành viên"} thành ${ROLE_LABELS[nextRole]}`);
      await log("company", companyId ?? member.company_id, "member_role_update", `Đổi vai trò thành ${ROLE_LABELS[nextRole]}`);
      await load();
      if (member.user_id === user?.id) await refreshPermissions();
    } catch (error) {
      toast.error("Không đổi được vai trò", { description: getErrorMessage(error) });
    }
  };

  const removeMember = async () => {
    if (!pendingRemove) return;
    try {
      const { error } = await supabase.from("company_members").delete().eq("id", pendingRemove.id);
      if (error) throw error;
      const linkedEmployee = employeeByUser.get(pendingRemove.user_id);
      if (linkedEmployee) await updateEmployee(linkedEmployee.id, { user_id: null });
      toast.success("Đã gỡ thành viên khỏi công ty");
      await log("company", pendingRemove.company_id, "member_remove", "Gỡ thành viên khỏi công ty");
      setPendingRemove(null);
      await load();
    } catch (error) {
      toast.error("Không gỡ được thành viên", { description: getErrorMessage(error) });
    }
  };

  const linkEmployee = async () => {
    if (!linkMember || linkEmployeeId === "none") return;
    try {
      await updateEmployee(linkEmployeeId, { user_id: linkMember.user_id });
      toast.success("Đã liên kết tài khoản với hồ sơ nhân sự");
      await log("employee", linkEmployeeId, "member_employee_link", "Liên kết tài khoản với hồ sơ nhân sự");
      setLinkMember(null);
      setLinkEmployeeId("none");
      await load();
    } catch (error) {
      toast.error("Không liên kết được hồ sơ", { description: getErrorMessage(error) });
    }
  };

  const openEffective = async (member: MemberRow) => {
    setEffectiveMember(member);
    setEffectiveKeys([]);
    setEffectiveLoading(true);
    try {
      const { data, error } = await supabase.rpc("effective_permission_keys", {
        target_company: member.company_id,
        target_user: member.user_id,
      });
      if (error) throw error;
      setEffectiveKeys(Array.isArray(data) ? (data as string[]) : []);
    } catch (error) {
      toast.error("Không tải được quyền hiệu lực", { description: getErrorMessage(error) });
    } finally {
      setEffectiveLoading(false);
    }
  };

  const saveBaseline = async () => {
    if (!companyId) return;
    setBaselineSaving(true);
    try {
      const permissions = Array.from(new Set([...baselineSelected, ...baselineSpecial]));
      const { error } = await supabase
        .from("company_role_permissions")
        .upsert({ company_id: companyId, role: baselineRole, permissions, updated_at: new Date().toISOString() }, { onConflict: "company_id,role" });
      if (error) throw error;
      toast.success(`Đã lưu quyền nền cho ${ROLE_LABELS[baselineRole]}`);
      await log("company", companyId, "role_permission_update", `Cập nhật quyền nền ${ROLE_LABELS[baselineRole]}`);
      await load();
      await refreshPermissions();
    } catch (error) {
      toast.error("Không lưu được quyền nền", { description: getErrorMessage(error) });
    } finally {
      setBaselineSaving(false);
    }
  };

  const openGroup = (group: PermissionGroup | null) => {
    setEditingGroup(group);
    setGroupName(group?.name ?? "");
    setGroupDescription(group?.description ?? "");
    setGroupSelected(group ? expandLegacyPermissions(group.permissions).filter((key) => !SPECIAL_VALUES.includes(key)) : []);
    setGroupDialogOpen(true);
  };

  const saveGroup = async () => {
    if (!companyId) return;
    if (!groupName.trim()) {
      toast.error("Vui lòng nhập tên nhóm quyền.");
      return;
    }
    setGroupSaving(true);
    try {
      const payload = {
        company_id: companyId,
        name: groupName.trim(),
        description: groupDescription.trim() || null,
        permissions: groupSelected,
      };
      if (editingGroup) await updatePermissionGroup(editingGroup.id, payload);
      else await createPermissionGroup(payload);
      toast.success(editingGroup ? "Đã cập nhật nhóm quyền" : "Đã tạo nhóm quyền");
      await log("company", companyId, "permission_group_save", `${editingGroup ? "Cập nhật" : "Tạo"} nhóm quyền ${groupName.trim()}`);
      setGroupDialogOpen(false);
      setEditingGroup(null);
      await load();
    } catch (error) {
      toast.error("Không lưu được nhóm quyền", { description: getErrorMessage(error) });
    } finally {
      setGroupSaving(false);
    }
  };

  const removeGroup = async (group: PermissionGroup) => {
    try {
      await deletePermissionGroup(group.id);
      toast.success("Đã xoá nhóm quyền");
      await load();
    } catch (error) {
      toast.error("Không xoá được nhóm quyền", { description: getErrorMessage(error) });
    }
  };

  const revokeInvite = async (invite: InviteRow) => {
    try {
      const { error } = await supabase.from("company_invites").update({ revoked: true }).eq("id", invite.id);
      if (error) throw error;
      toast.success("Đã thu hồi lời mời");
      await load();
    } catch (error) {
      toast.error("Không thu hồi được lời mời", { description: getErrorMessage(error) });
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Quản trị"
        title="Thành viên & quyền"
        description="Quản lý người dùng trong công ty, liên kết tài khoản với hồ sơ nhân sự và cấu hình quyền nền."
        actions={
          canInvite ? (
            <Button className="h-9 gap-1.5 text-[12.5px]" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" /> Mời thành viên
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
        {[
          { key: "members", label: `Thành viên (${members.length})`, icon: Users },
          canEditPermissions && { key: "roles", label: "Quyền theo vai trò", icon: ShieldCheck },
          canEditPermissions && { key: "groups", label: `Nhóm quyền (${tenantGroups.length})`, icon: KeyRound },
        ]
          .filter(Boolean)
          .map((rawItem) => {
            const item = rawItem as { key: string; label: string; icon: typeof Users };
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key as typeof tab)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                tab === item.key ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải thành viên…
        </Card>
      ) : tab === "members" ? (
        <div className="space-y-3">
          {installs.size > 0 && (
            <AppInstallSummary
              installed={members.filter((m) => installs.get(m.user_id)?.installed).length}
              total={members.filter((m) => installs.has(m.user_id)).length}
              onlyMissing={onlyNoApp}
              onToggle={setOnlyNoApp}
            />
          )}
          <Card className="overflow-hidden p-0">
            <div className="scrollbar-slim overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-[11.5px]">
                <thead>
                  <tr className="bg-muted/40 text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-semibold">Thành viên</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Hồ sơ nhân sự</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Vai trò</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Đã cài app</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Tham gia</th>
                    <th className="w-[150px] px-3 py-2.5 text-right font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {members
                    .filter((member) => !onlyNoApp || (installs.has(member.user_id) && !installs.get(member.user_id)?.installed))
                    .map((member) => {
                    const profile = profiles[member.user_id];
                    const employee = employeeByUser.get(member.user_id);
                    return (
                      <tr key={member.id} className="border-t border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-2.5">
                          <p className="text-[12.5px] font-semibold text-foreground">
                            {profile?.full_name ?? "Thành viên"}
                            {member.user_id === user?.id ? " (bạn)" : ""}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {profile?.email ?? "Chưa có email"} · {member.status === "active" ? "Đang hoạt động" : member.status}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          {employee ? (
                            <div>
                              <p className="text-[12px] text-foreground">{employee.full_name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {employee.code}
                                {employee.department ? ` · ${employee.department}` : ""}
                              </p>
                            </div>
                          ) : (
                            <Badge variant="warning">Chưa liên kết</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {member.role === "owner" || !canEditMembers ? (
                            <Badge variant={ROLE_BADGE[member.role]}>{ROLE_LABELS[member.role]}</Badge>
                          ) : (
                            <Select value={member.role} onValueChange={(value) => void changeRole(member, value as Role)}>
                              <SelectTrigger className="h-8 w-[132px] text-[11.5px]" aria-label="Đổi vai trò thành viên">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ASSIGNABLE_ROLES.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {ROLE_LABELS[value]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <AppInstallCell status={installs.get(member.user_id)} />
                        </td>
                        <td className="px-3 py-2.5 text-right text-[11px] text-muted-foreground">
                          {formatDate(member.joined_at)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-0.5">
                            {canViewEffective && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Xem quyền của ${profile?.full_name ?? "thành viên"}`}
                                onClick={() => void openEffective(member)}
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canLinkEmployee && !employee && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Liên kết hồ sơ nhân sự"
                                onClick={() => {
                                  setLinkMember(member);
                                  setLinkEmployeeId("none");
                                }}
                              >
                                <Link2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canDeleteMembers &&
                              member.role !== "owner" &&
                              (role === "owner" || member.role !== "admin") && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Gỡ thành viên"
                                onClick={() => setPendingRemove(member)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {canInvite && invites.length > 0 && (
            <Card className="p-4">
              <p className="text-[12.5px] font-semibold text-foreground">Lời mời đang chờ ({invites.length})</p>
              <ul className="mt-2 divide-y divide-border/50">
                {invites.map((invite) => (
                  <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <p className="text-[12px] text-foreground">{invite.email ?? "Lời mời bằng liên kết"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {ROLE_LABELS[invite.role]} · hết hạn {formatDate(invite.expires_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {canInvite && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-[11.5px]"
                            onClick={() => void copyInviteLink(invite.token)}
                          >
                            <Copy className="h-3 w-3" /> Sao chép
                          </Button>
                          <ConfirmAction
                            title="Thu hồi lời mời?"
                            description={`Lời mời gửi ${invite.email ?? ""} sẽ không dùng được nữa.`}
                            confirmLabel="Thu hồi"
                            onConfirm={() => revokeInvite(invite)}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-[11.5px] text-destructive"
                            >
                              <Trash2 className="h-3 w-3" /> Thu hồi
                            </Button>
                          </ConfirmAction>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      ) : tab === "roles" ? (
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13.5px] font-semibold text-foreground">Quyền nền theo vai trò</p>
              <p className="text-[11.5px] text-muted-foreground">
                Quyền nền áp dụng cho mọi thành viên có vai trò tương ứng. Quyền cấp riêng cho từng nhân sự sẽ cộng thêm.
              </p>
            </div>
            <Select value={baselineRole} onValueChange={(value) => setBaselineRole(value as Role)}>
              <SelectTrigger className="h-9 w-[180px] text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITABLE_ROLES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {ROLE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Quyền đặc biệt
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SPECIAL_PERMISSION_OPTIONS.map((option) => {
                const checked = baselineSpecial.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={!canEditPermissions}
                    onClick={() =>
                      setBaselineSpecial((prev) =>
                        prev.includes(option.value)
                          ? prev.filter((key) => key !== option.value)
                          : [...prev, option.value],
                      )
                    }
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      checked
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

          <PermissionMatrix
            selected={baselineSelected}
            onToggle={(key) =>
              setBaselineSelected((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]))
            }
            readOnly={!canEditPermissions || baselineRole === "owner"}
          />

          {canEditPermissions && (
            <div className="flex justify-end">
              <Button className="h-9 gap-2" onClick={() => void saveBaseline()} disabled={baselineSaving}>
                {baselineSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                Lưu quyền nền
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-muted-foreground">
              Nhóm quyền riêng của công ty giúp tái sử dụng bộ quyền khi phân quyền nhân sự.
            </p>
            {canEditPermissions && (
              <Button className="h-9 gap-1.5 text-[12.5px]" onClick={() => openGroup(null)}>
                <Plus className="h-4 w-4" /> Tạo nhóm quyền
              </Button>
            )}
          </div>

          {tenantGroups.length === 0 ? (
            <Card className="p-10 text-center">
              <KeyRound className="mx-auto h-6 w-6 text-muted-foreground/70" />
              <p className="mt-2 text-[13px] font-semibold text-foreground">Chưa có nhóm quyền riêng</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Tạo nhóm để gán nhanh bộ quyền cho nhiều nhân sự.
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {tenantGroups.map((group) => (
                <Card key={group.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">{group.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {group.description ?? "Không có mô tả"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {expandLegacyPermissions(group.permissions).length} quyền
                    </p>
                  </div>
                  {canEditPermissions && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Sửa nhóm ${group.name}`}
                        onClick={() => openGroup(group)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Xoá nhóm ${group.name}`}
                        onClick={() => setPendingGroupDelete(group)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {globalGroups.length > 0 && (
            <Card className="p-4">
              <p className="text-[12px] font-semibold text-foreground">Mẫu dùng chung</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Các nhóm mẫu do quản trị hệ thống cung cấp, không sửa được trong công ty.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {globalGroups.map((group) => (
                  <Badge key={group.id} variant="muted">
                    {group.name}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        companyId={companyId ?? ""}
        actorId={user?.id ?? ""}
        allowedRoles={role === "owner" || role === "admin" ? ASSIGNABLE_ROLES : ["employee", "manager"]}
        onCreated={() => {
          void load();
          void log("company", companyId ?? "", "member_invite", "Tạo lời mời thành viên");
        }}
      />

      <Dialog open={!!linkMember} onOpenChange={(open) => !open && setLinkMember(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Liên kết hồ sơ nhân sự</DialogTitle>
            <DialogDescription>
              Gắn tài khoản {profiles[linkMember?.user_id ?? ""]?.full_name ?? "thành viên"} với một hồ sơ nhân sự
              chưa có tài khoản. Sau khi liên kết, người này xem được hồ sơ, chấm công và phiếu lương của mình.
            </DialogDescription>
          </DialogHeader>
          <Select value={linkEmployeeId} onValueChange={setLinkEmployeeId}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Chọn hồ sơ nhân sự" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Chưa chọn</SelectItem>
              {unlinkedEmployees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.full_name} · {employee.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setLinkMember(null)}>
              Huỷ
            </Button>
            <Button className="gap-2" disabled={linkEmployeeId === "none"} onClick={() => void linkEmployee()}>
              <Link2 className="h-4 w-4" /> Liên kết
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!effectiveMember} onOpenChange={(open) => !open && setEffectiveMember(null)}>
        <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              Quyền hiệu lực · {profiles[effectiveMember?.user_id ?? ""]?.full_name ?? "Thành viên"}
            </DialogTitle>
            <DialogDescription>
              Tổng hợp từ quyền nền của vai trò {effectiveMember ? ROLE_LABELS[effectiveMember.role] : ""} và quyền cấp riêng.
            </DialogDescription>
          </DialogHeader>
          {effectiveLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tính quyền…
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="muted">{effectiveKeys.length} quyền</Badge>
                {PERMISSION_MODULES.filter((module) => effectiveKeys.includes(`${module.key}.view`)).map((module) => (
                  <Badge key={module.key} variant="outline">
                    {module.label}
                  </Badge>
                ))}
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {effectiveKeys.map((key) => (
                  <span key={key} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-[11px] text-foreground">
                    {permissionLabel(key)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Sửa nhóm quyền" : "Tạo nhóm quyền"}</DialogTitle>
            <DialogDescription>Nhóm quyền chỉ áp dụng trong công ty hiện tại.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[12px]">Tên nhóm</Label>
                <Input value={groupName} onChange={(event) => setGroupName(event.target.value)} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Mô tả</Label>
                <Input
                  value={groupDescription}
                  onChange={(event) => setGroupDescription(event.target.value)}
                  className="h-10"
                />
              </div>
            </div>
            <PermissionMatrix
              selected={groupSelected}
              onToggle={(key) =>
                setGroupSelected((prev) =>
                  prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
                )
              }
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setGroupDialogOpen(false)}>
              Huỷ
            </Button>
            <Button className="gap-2" disabled={groupSaving} onClick={() => void saveGroup()}>
              {groupSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Lưu nhóm quyền
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingGroupDelete} onOpenChange={(open) => !open && setPendingGroupDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá nhóm quyền?</AlertDialogTitle>
            <AlertDialogDescription>
              Nhóm “{pendingGroupDelete?.name}” sẽ bị xoá. Nhân sự đang dùng nhóm vẫn giữ quyền đã cấp trước đó.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingGroupDelete) void removeGroup(pendingGroupDelete);
                setPendingGroupDelete(null);
              }}
            >
              Xoá nhóm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingRemove} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gỡ thành viên?</AlertDialogTitle>
            <AlertDialogDescription>
              {profiles[pendingRemove?.user_id ?? ""]?.full_name ?? "Thành viên"} sẽ mất quyền truy cập công ty này.
              Hồ sơ nhân sự vẫn được giữ lại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void removeMember()}
            >
              Gỡ thành viên
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default Members;
