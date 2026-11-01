import { Check, Minus } from "lucide-react";

import { CRUD_ACTIONS, PERMISSION_MODULES, permissionKey } from "@/lib/permissions";

interface PermissionMatrixProps {
  selected: string[];
  denied?: string[];
  onToggle: (key: string) => void;
  readOnly?: boolean;
  showDeny?: boolean;
}

export const PermissionMatrix = ({
  selected,
  denied = [],
  onToggle,
  readOnly = false,
  showDeny = false,
}: PermissionMatrixProps) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      <span>Hạng mục</span>
      <div className="flex gap-3 pr-1">
        {CRUD_ACTIONS.map((action) => (
          <span key={action.key} className="w-9 text-center">
            {action.label}
          </span>
        ))}
      </div>
    </div>

    {PERMISSION_MODULES.map((module) => {
      return (
        <div
          key={module.key}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
        >
          <p className="truncate text-[11.5px] font-medium text-foreground">{module.label}</p>
          <div className="flex gap-3">
            {CRUD_ACTIONS.map((action) => {
              const key = permissionKey(module.key, action.key);
              const checked = selected.includes(key) && !denied.includes(key);
              const blocked = showDeny && denied.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={readOnly}
                  onClick={() => onToggle(key)}
                  aria-label={`${module.label} · ${action.label}`}
                  className="flex w-9 justify-center disabled:cursor-default"
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      blocked
                        ? "border-destructive bg-destructive-subtle text-destructive"
                        : checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card"
                    }`}
                  >
                    {blocked ? <Minus className="h-3 w-3" /> : checked ? <Check className="h-3 w-3" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    })}

    {showDeny && (
      <p className="pt-1 text-[11px] leading-4 text-muted-foreground">
        Bấm một ô để chuyển trạng thái: trống → cấp quyền → thu hồi. Quyền thu hồi sẽ bị loại khỏi
        quyền nền của vai trò.
      </p>
    )}
    {keysHint(selected, denied)}
  </div>
);

const keysHint = (selected: string[], denied: string[]) => {
  const granted = selected.filter((key) => !denied.includes(key)).length;
  return (
    <p className="text-[11px] text-muted-foreground">
      Đang chọn <span className="font-semibold text-foreground">{granted}</span> quyền
      {denied.length > 0 ? ` · ${denied.length} quyền bị thu hồi` : ""}
    </p>
  );
};
