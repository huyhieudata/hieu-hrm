import { useState } from "react";
import { Link } from "react-router-dom";
import { Network } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrgStructure } from "@/lib/use-org-structure";

export const ORG_SETUP_PATH = "/cai-dat/co-cau-to-chuc";

/** Hướng dẫn khi sơ đồ tổ chức còn trống. */
export const OrgEmptyHint = ({ org }: { org: OrgStructure }) =>
  org.empty ? (
    <p className="flex items-center gap-1.5 rounded-md bg-warning-subtle px-2.5 py-1.5 text-[11.5px] text-warning">
      <Network className="h-3.5 w-3.5" /> Chưa có sơ đồ tổ chức.{" "}
      <Link to={ORG_SETUP_PATH} className="font-semibold underline">
        Thiết lập sơ đồ tổ chức
      </Link>
    </p>
  ) : null;

const CUSTOM = "__custom__";
const NONE = "__none__";

const OrgSelect = ({
  value,
  onChange,
  options,
  allowCustom,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allowCustom: boolean;
  placeholder: string;
  id?: string;
}) => {
  const [custom, setCustom] = useState(false);
  const legacy = !!value && !options.some((o) => o.value === value);
  if (custom)
    return (
      <Input
        id={id}
        autoFocus
        value={value}
        placeholder="Nhập giá trị khác"
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => !value && setCustom(false)}
      />
    );
  return (
    <Select
      value={value || NONE}
      onValueChange={(v) =>
        v === CUSTOM ? setCustom(true) : onChange(v === NONE ? "" : v)
      }
    >
      <SelectTrigger id={id} className="h-10">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Chưa chọn</SelectItem>
        {legacy && (
          <SelectItem value={value}>{value} (không có trên sơ đồ)</SelectItem>
        )}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
        {allowCustom && (
          <SelectItem value={CUSTOM}>Khác (nhập tay)…</SelectItem>
        )}
      </SelectContent>
    </Select>
  );
};

export const DepartmentSelect = ({
  org,
  value,
  onChange,
  id,
}: {
  org: OrgStructure;
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) => (
  <OrgSelect
    id={id}
    value={value}
    onChange={onChange}
    options={org.departmentOptions}
    allowCustom={org.allowCustom}
    placeholder="Chọn phòng ban"
  />
);

/** Chức danh lọc theo phòng ban đã chọn (department_positions). */
export const PositionSelect = ({
  org,
  department,
  value,
  onChange,
  id,
}: {
  org: OrgStructure;
  department: string;
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) => (
  <OrgSelect
    id={id}
    value={value}
    onChange={onChange}
    options={
      department
        ? (org.positionOptionsByDepartment[
            org.findDepartment(department)?.name ?? ""
          ] ?? [])
        : org.allPositionOptions
    }
    allowCustom={org.allowCustom}
    placeholder={department ? "Chọn chức danh" : "Chọn phòng ban trước"}
  />
);
