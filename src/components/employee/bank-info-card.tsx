import { useState } from "react";
import { CreditCard, Loader2, Pencil, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { FieldDialog } from "@/components/employee/field-dialog";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateEmployee, type EmployeeRecord } from "@/lib/employee-records";
import { exportPdf } from "@/lib/export-utils";

const bankFields = [
  { name: "bank_name", label: "Ngân hàng", placeholder: "Vietcombank", section: "Tài khoản nhận lương" },
  { name: "bank_account", label: "Số tài khoản", placeholder: "0071000123456", section: "Tài khoản nhận lương" },
  { name: "bank_branch", label: "Chi nhánh", placeholder: "Sở giao dịch Hà Nội", section: "Tài khoản nhận lương" },
  { name: "tax_code", label: "Mã số thuế TNCN", placeholder: "8012345678", section: "Thuế" },
];

const InfoItem = ({ label, value }: { label: string; value: string | null }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
    <p className="mt-0.5 break-words text-[12.5px] font-medium text-foreground">{value?.trim() || "—"}</p>
  </div>
);

interface BankInfoCardProps {
  employee: EmployeeRecord;
  canManage: boolean;
  onUpdated: () => void | Promise<void>;
}

export const BankInfoCard = ({ employee, canManage, onUpdated }: BankInfoCardProps) => {
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const hasBankInfo = Boolean(employee.bank_name || employee.bank_account || employee.bank_branch);
  const hasAnyInfo = hasBankInfo || Boolean(employee.tax_code);

  const handleSave = async (values: Record<string, string | number | null>) => {
    try {
      await updateEmployee(employee.id, values);
      toast.success("Đã cập nhật thông tin thanh toán");
      await onUpdated();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Không lưu được thông tin.";
      throw new Error(
        message.includes("row-level security") ? "Bạn không có quyền sửa hồ sơ nhân viên này." : message,
      );
    }
  };

  const handleClear = async () => {
    setRemoving(true);
    try {
      await updateEmployee(employee.id, {
        bank_name: null,
        bank_account: null,
        bank_branch: null,
        tax_code: null,
      });
      toast.success("Đã xoá thông tin thanh toán");
      setRemoveOpen(false);
      await onUpdated();
    } catch (clearError) {
      toast.error("Không xoá được thông tin", {
        description: clearError instanceof Error ? clearError.message : undefined,
      });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-subtle text-primary-subtle-foreground">
            <CreditCard className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <div>
            <h3 className="text-[13.5px] font-semibold text-foreground">Thanh toán & thuế</h3>
            <p className="text-[11.5px] text-muted-foreground">Dùng cho chuyển khoản lương</p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-[11.5px]"
              onClick={() =>
                exportPdf(
                  `Thông tin thanh toán — ${employee.full_name}`,
                  `${employee.code} · ${employee.department ?? "—"}`,
                  ["Thông tin", "Giá trị"],
                  [
                    ["Ngân hàng", employee.bank_name ?? "—"],
                    ["Số tài khoản", employee.bank_account ?? "—"],
                    ["Chi nhánh", employee.bank_branch ?? "—"],
                    ["Mã số thuế", employee.tax_code ?? "—"],
                  ],
                )
              }
            >
              <Printer className="h-3 w-3" /> In
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-[11.5px]"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3 w-3" />
              {hasAnyInfo ? "Chỉnh sửa" : "Thêm thông tin"}
            </Button>
            {hasAnyInfo && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Xoá thông tin thanh toán"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setRemoveOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {hasAnyInfo ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoItem label="Ngân hàng" value={employee.bank_name} />
          <InfoItem label="Số tài khoản" value={employee.bank_account} />
          <InfoItem label="Chi nhánh" value={employee.bank_branch} />
          <InfoItem label="Mã số thuế" value={employee.tax_code} />
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-border bg-muted/40 px-3 py-3 text-[11.5px] leading-5 text-muted-foreground">
          Chưa có thông tin ngân hàng. Thêm số tài khoản để chuyển lương và mã số thuế để tính thuế TNCN.
        </p>
      )}

      <FieldDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Thông tin thanh toán & thuế"
        description="Dùng cho chuyển khoản lương và kê khai thuế TNCN."
        fields={bankFields}
        initial={employee}
        submitLabel="Lưu thông tin"
        onSubmit={handleSave}
      />

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá thông tin thanh toán?</AlertDialogTitle>
            <AlertDialogDescription>
              Thông tin ngân hàng và mã số thuế của {employee.full_name} sẽ bị xoá khỏi hồ sơ. Bạn có thể
              nhập lại bất cứ lúc nào.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removing}
              onClick={(event) => {
                event.preventDefault();
                void handleClear();
              }}
            >
              {removing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {removing ? "Đang xoá…" : "Xoá thông tin"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
