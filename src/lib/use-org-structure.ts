import { useCallback, useEffect, useMemo, useState } from "react";

import { useCompany } from "@/lib/company-provider";
import type { FieldDef } from "@/lib/field-defs";
import {
  createSetting,
  listDepartmentPositions,
  listDepartments,
  type DepartmentPosition,
  type DepartmentRecord,
} from "@/lib/settings";

export type Option = { value: string; label: string };

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/**
 * Nguồn dữ liệu DUY NHẤT cho phòng ban / chức danh: bảng departments + department_positions
 * (Cài đặt › Sơ đồ tổ chức). Giá trị lưu là TÊN (tương thích cột text cũ); employees.department_id
 * được trigger đồng bộ theo tên.
 */
export const useOrgStructure = (companyIdOverride?: string | null) => {
  const { activeCompany, role } = useCompany();
  const companyId = companyIdOverride ?? activeCompany?.id ?? null;
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [positions, setPositions] = useState<DepartmentPosition[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [d, p] = await Promise.all([
        listDepartments(companyId),
        listDepartmentPositions(companyId),
      ]);
      setDepartments(d);
      setPositions(p);
    } catch {
      setDepartments([]);
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return useMemo(() => {
    const byId = new Map(departments.map((d) => [d.id, d]));
    const departmentOptions: Option[] = departments.map((d) => ({
      value: d.name,
      label: d.name,
    }));
    const positionOptionsByDepartment: Record<string, Option[]> = {};
    for (const d of departments) {
      positionOptionsByDepartment[d.name] = positions
        .filter((p) => p.department_id === d.id)
        .map((p) => ({
          value: p.title,
          label: p.is_management ? `${p.title} (quản lý)` : p.title,
        }));
    }
    const allPositionOptions: Option[] = Array.from(
      new Set(positions.map((p) => p.title)),
    ).map((t) => ({
      value: t,
      label: t,
    }));
    const findDepartment = (name: string | null | undefined) =>
      departments.find((d) => norm(d.name) === norm(name)) ?? null;
    const findPosition = (
      title: string | null | undefined,
      departmentName?: string | null,
    ) => {
      const dep = departmentName ? findDepartment(departmentName) : null;
      return (
        positions.find(
          (p) =>
            norm(p.title) === norm(title) &&
            (!dep || p.department_id === dep.id),
        ) ?? null
      );
    };
    /** Trưởng phòng/quản lý của phòng ban (nếu đã khai báo trên sơ đồ). */
    const managerOf = (name: string | null | undefined) => {
      const d = findDepartment(name);
      return d
        ? { employeeId: d.manager_employee_id, name: d.manager_name }
        : null;
    };
    const canEditOrg = role === "owner" || role === "admin" || role === "hr";
    const friendlyCreateError = (error: unknown, what: string) => {
      const message = error instanceof Error ? error.message : String(error);
      if (/duplicate|unique|23505/i.test(message)) return new Error(`${what} này đã có trong công ty.`);
      if (/row-level security|permission|42501/i.test(message)) return new Error(`Bạn không có quyền tạo ${what.toLowerCase()} (chỉ chủ sở hữu, quản trị, HR).`);
      return new Error(`Không tạo được ${what.toLowerCase()}: ${message}`);
    };
    /** Tạo nhanh phòng ban (owner/admin/HR; RLS settings.create kiểm phía server). Trả về tên. */
    const createDepartment = async (name: string, parentId: string | null = null) => {
      const clean = name.trim().replace(/\s+/g, " ");
      if (!companyId) throw new Error("Chưa chọn công ty.");
      if (!clean) throw new Error("Vui lòng nhập tên phòng ban.");
      if (!canEditOrg) throw new Error("Chỉ chủ sở hữu, quản trị hoặc HR được tạo phòng ban.");
      if (findDepartment(clean)) throw new Error("Phòng ban này đã có trong công ty.");
      try {
        await createSetting("departments", { company_id: companyId, name: clean, parent_id: parentId, sort_order: departments.length });
      } catch (error) {
        throw friendlyCreateError(error, "Phòng ban");
      }
      await reload();
      return clean;
    };
    /** Tạo nhanh vị trí thuộc phòng ban đã chọn. Trả về tên vị trí. */
    const createPosition = async (departmentName: string, title: string) => {
      const clean = title.trim().replace(/\s+/g, " ");
      const dep = findDepartment(departmentName);
      if (!companyId) throw new Error("Chưa chọn công ty.");
      if (!dep) throw new Error("Chọn phòng ban trước khi tạo vị trí.");
      if (!clean) throw new Error("Vui lòng nhập tên vị trí.");
      if (!canEditOrg) throw new Error("Chỉ chủ sở hữu, quản trị hoặc HR được tạo vị trí.");
      if (positions.some((p) => p.department_id === dep.id && norm(p.title) === norm(clean))) throw new Error("Vị trí này đã có trong phòng ban.");
      try {
        await createSetting("department_positions", { company_id: companyId, department_id: dep.id, title: clean, sort_order: positions.length });
      } catch (error) {
        throw friendlyCreateError(error, "Vị trí");
      }
      await reload();
      return clean;
    };
    return {
      companyId,
      loading,
      reload,
      departments,
      positions,
      byId,
      empty: !loading && departments.length === 0,
      departmentOptions,
      positionOptionsByDepartment,
      allPositionOptions,
      findDepartment,
      findPosition,
      managerOf,
      createDepartment,
      createPosition,
      canEditOrg,
      /** Chỉ quản trị (owner/admin/HR) được nhập "Khác" ngoài sơ đồ. */
      allowCustom: canEditOrg,
    };
  }, [companyId, loading, reload, departments, positions, role]);
};

export type OrgStructure = ReturnType<typeof useOrgStructure>;

/** Cặp FieldDef Phòng ban → Chức danh dùng cho FieldDialog, nối với sơ đồ tổ chức. */
export const orgFieldDefs = (
  org: OrgStructure,
  opts: {
    department?: string;
    position?: string;
    required?: boolean;
    section?: string;
    positionLabel?: string;
  } = {},
): FieldDef[] => {
  const dep = opts.department ?? "department";
  const pos = opts.position ?? "position";
  return [
    {
      name: dep,
      label: "Phòng ban",
      type: "select",
      required: opts.required,
      options: org.departmentOptions,
      allowCustom: org.allowCustom,
      onCreate: org.canEditOrg ? ({ name, parentId }) => org.createDepartment(name, parentId) : undefined,
      createLabel: "+ Tạo phòng ban mới…",
      createParentOptions: org.departments.map((d) => ({ value: d.id, label: d.name })),
      section: opts.section,
      placeholder: org.empty ? "Chưa có sơ đồ tổ chức" : "Chọn phòng ban",
      hint: org.empty
        ? "Sơ đồ tổ chức trống — vào Cài đặt › Sơ đồ tổ chức để thiết lập."
        : undefined,
    },
    {
      name: pos,
      label: opts.positionLabel ?? "Chức danh",
      type: "select",
      required: opts.required,
      dependsOn: dep,
      optionsByValue: org.positionOptionsByDepartment,
      options: org.allPositionOptions,
      allowCustom: org.allowCustom,
      onCreate: org.canEditOrg ? ({ name }, values) => org.createPosition(values[dep] ?? "", name) : undefined,
      createLabel: "+ Tạo vị trí mới trong phòng ban…",
      section: opts.section,
      placeholder: "Chọn phòng ban trước",
      hint: "Lọc theo vị trí của phòng ban trên sơ đồ tổ chức.",
    },
  ];
};

/** Thay các field "department"/"position" (text/select cứng) trong 1 danh sách FieldDef bằng bản nối sơ đồ tổ chức. */
export const withOrgFields = (
  fields: FieldDef[],
  org: OrgStructure,
  names = { department: "department", position: "position" },
) => {
  const [dep, pos] = orgFieldDefs(org, names);
  return fields.map((field) => {
    if (field.name === names.department)
      return {
        ...field,
        ...dep,
        label: field.label,
        required: field.required,
        section: field.section,
      };
    if (field.name === names.position)
      return {
        ...field,
        ...pos,
        type: "select" as const,
        label: field.label,
        required: field.required,
        section: field.section,
      };
    if (field.name === "concurrent_positions")
      return {
        ...field,
        type: "multiselect" as const,
        options: org.allPositionOptions,
        allowCustom: org.allowCustom,
        placeholder: "Tìm và chọn vị trí kiêm nhiệm…",
        hint: "Chọn một hoặc nhiều vị trí trên sơ đồ tổ chức.",
      };
    return field;
  });
};
