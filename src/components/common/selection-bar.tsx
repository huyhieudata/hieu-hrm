import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface SelectionBarProps {
  count: number;
  label?: string;
  onClear: () => void;
  onDelete: () => void;
}

export const SelectionBar = ({ count, label = "bản ghi", onClear, onDelete }: SelectionBarProps) => {
  if (count === 0) return null;

  return (
    <Card className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
      <p className="text-[12px] font-medium text-foreground">
        Đã chọn {count} {label}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 text-[11.5px]" onClick={onClear}>
          Bỏ chọn
        </Button>
        <Button
          size="sm"
          className="h-8 gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" /> Xoá đã chọn
        </Button>
      </div>
    </Card>
  );
};
