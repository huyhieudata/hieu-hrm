/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-provider";
import { can as roleCan, permissionsForRole, type Permission, type Role } from "./roles";
import { expandLegacyPermissions, toLegacyPermissions, type CrudAction } from "./permissions";

export interface Company {
  id: string;
  name: string;
  slug: string | null;
  industry: string | null;
  company_size: string | null;
  logo_url: string | null;
}

export interface Membership {
  id: string;
  company_id: string;
  user_id: string;
  role: Role;
  status: string;
  job_title: string | null;
  department: string | null;
  joined_at: string;
  company: Company;
}

interface CreateCompanyInput {
  name: string;
  industry?: string;
  companySize?: string;
}

interface CompanyContextValue {
  memberships: Membership[];
  activeMembership: Membership | null;
  activeCompany: Company | null;
  role: Role | null;
  loading: boolean;
  can: (permission: Permission) => boolean;
  canDo: (moduleKey: string, action: CrudAction) => boolean;
  canManageModule: (moduleKey: string) => boolean;
  permissionKeys: string[];
  refreshPermissions: () => Promise<void>;
  setActiveCompany: (companyId: string) => void;
  createCompany: (input: CreateCompanyInput) => Promise<string>;
  refreshMemberships: () => Promise<void>;
}

const MEMBERSHIP_COLUMNS =
  "id, company_id, user_id, role, status, job_title, department, joined_at, company:companies(id, name, slug, industry, company_size, logo_url)";

const CompanyContext = createContext<CompanyContextValue | null>(null);

const storageKey = (userId: string) => `nova.activeCompany.${userId}`;

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "cong-ty";

export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // userId whose memberships finished loading. Guards stay in "loading" until this matches,
  // otherwise a deep link (/employees) renders once with no role and gets redirected to "/".
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const loadMemberships = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("company_members")
        .select(MEMBERSHIP_COLUMNS)
        .eq("user_id", id)
        .eq("status", "active")
        .order("joined_at", { ascending: true });

      if (error) throw error;

      const rows = ((data ?? []) as unknown as Membership[]).filter((row) => row.company);
      setMemberships(rows);
    } catch (error) {
      console.error("Không tải được danh sách công ty", error);
      setMemberships([]);
    } finally {
      setLoading(false);
      setLoadedFor(id);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setMemberships([]);
      setActiveId(null);
      setLoading(false);
      return;
    }
    void loadMemberships(userId);
  }, [loadMemberships, userId]);

  useEffect(() => {
    if (!userId) return;

    setActiveId((current) => {
      const stored = window.localStorage.getItem(storageKey(userId));
      const candidate = current ?? stored;
      if (candidate && memberships.some((membership) => membership.company_id === candidate)) {
        return candidate;
      }
      return memberships[0]?.company_id ?? null;
    });
  }, [memberships, userId]);

  useEffect(() => {
    if (userId && activeId) {
      window.localStorage.setItem(storageKey(userId), activeId);
    }
  }, [activeId, userId]);

  const activeMembership = useMemo(
    () => memberships.find((membership) => membership.company_id === activeId) ?? null,
    [activeId, memberships],
  );

  const role = activeMembership?.role ?? null;

  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [permissionsReady, setPermissionsReady] = useState(false);

  const loadPermissions = useCallback(
    async (companyId: string, currentRole: Role | null) => {
      setPermissionLoading(true);
      setPermissionsReady(false);
      try {
        const { data, error } = await supabase.rpc("my_permissions", { target_company: companyId });
        if (!error && Array.isArray(data)) {
          setPermissionKeys(data as string[]);
          return;
        }

        // Fallback for older backends that do not have my_permissions yet.
        const { data: employee } = await supabase
          .from("employees")
          .select("id")
          .eq("company_id", companyId)
          .eq("user_id", userId)
          .maybeSingle();
        const { data: grants } = employee?.id
          ? await supabase.from("employee_permissions").select("permissions").eq("employee_id", employee.id).maybeSingle()
          : { data: null };
        const legacy = new Set<Permission>([
          ...permissionsForRole(currentRole),
          ...toLegacyPermissions(((grants?.permissions ?? []) as string[]) ?? []),
        ]);
        setPermissionKeys(expandLegacyPermissions(Array.from(legacy)));
      } catch {
        setPermissionKeys(expandLegacyPermissions(permissionsForRole(currentRole)));
      } finally {
        setPermissionLoading(false);
        setPermissionsReady(true);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId || !activeId) {
      setPermissionKeys([]);
      setPermissionsReady(false);
      return;
    }
    void loadPermissions(activeId, role);
  }, [activeId, loadPermissions, role, userId]);

  const setActiveCompany = useCallback((companyId: string) => {
    setActiveId(companyId);
  }, []);

  const createCompany = useCallback<CompanyContextValue["createCompany"]>(
    async ({ name, industry, companySize }) => {
      if (!userId) throw new Error("Bạn cần đăng nhập để tạo công ty.");

      const trimmedName = name.trim();
      if (trimmedName.length < 2) throw new Error("Tên công ty cần ít nhất 2 ký tự.");

      const { data, error } = await supabase
        .from("companies")
        .insert({
          name: trimmedName,
          slug: `${slugify(trimmedName)}-${Math.random().toString(36).slice(2, 6)}`,
          industry: industry?.trim() || null,
          company_size: companySize?.trim() || null,
          created_by: userId,
        })
        .select("id")
        .single();

      if (error) throw error;

      await loadMemberships(userId);
      setActiveId(data.id);
      return data.id;
    },
    [loadMemberships, userId],
  );

  const refreshMemberships = useCallback(async () => {
    if (userId) await loadMemberships(userId);
  }, [loadMemberships, userId]);

  const legacyPermissions = useMemo<Permission[]>(() => {
    if (!permissionsReady) return permissionsForRole(role);
    const direct = permissionKeys.filter((key): key is Permission =>
      [
        "company.manage",
        "members.view",
        "members.invite",
        "members.manage",
        "employees.view",
        "employees.manage",
        "recruitment.view",
        "recruitment.manage",
        "attendance.view",
        "attendance.manage",
        "leave.view",
        "leave.approve",
        "payroll.view",
        "payroll.manage",
      ].includes(key),
    );
    return Array.from(new Set<Permission>([...direct, ...toLegacyPermissions(permissionKeys)]));
  }, [permissionKeys, permissionsReady, role]);

  const can = useCallback(
    (permission: Permission) =>
      permissionsReady ? legacyPermissions.includes(permission) : roleCan(role, permission),
    [legacyPermissions, permissionsReady, role],
  );

  const canDo = useCallback(
    (moduleKey: string, action: CrudAction) =>
      permissionsReady && permissionKeys.includes(`${moduleKey}.${action}`),
    [permissionKeys, permissionsReady],
  );

  const canManageModule = useCallback(
    (moduleKey: string) =>
      canDo(moduleKey, "create") || canDo(moduleKey, "edit") || canDo(moduleKey, "delete"),
    [canDo],
  );

  const refreshPermissions = useCallback(async () => {
    if (userId && activeId) await loadPermissions(activeId, role);
  }, [activeId, loadPermissions, role, userId]);

  const value = useMemo<CompanyContextValue>(
    () => ({
      memberships,
      activeMembership,
      activeCompany: activeMembership?.company ?? null,
      role,
      loading:
        loading ||
        permissionLoading ||
        (Boolean(userId) && loadedFor !== userId) ||
        (memberships.length > 0 && !activeMembership) ||
        (Boolean(userId && activeId) && !permissionsReady),
      can,
      canDo,
      canManageModule,
      permissionKeys,
      refreshPermissions,
      setActiveCompany,
      createCompany,
      refreshMemberships,
    }),
    [
      activeId,
      activeMembership,
      can,
      canDo,
      canManageModule,
      createCompany,
      loading,
      loadedFor,
      memberships,
      permissionKeys,
      permissionLoading,
      permissionsReady,
      refreshMemberships,
      refreshPermissions,
      role,
      setActiveCompany,
      userId,
    ],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) throw new Error("useCompany phải được dùng bên trong CompanyProvider");
  return context;
};

export const companyInitials = (name: string | null | undefined) => {
  if (!name) return "NV";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "NV";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
};
