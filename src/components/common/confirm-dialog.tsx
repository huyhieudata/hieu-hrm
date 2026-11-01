import { useEffect, useRef, useState } from "react";

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

type Request = { message: string; title?: string; confirmLabel?: string; resolve: (ok: boolean) => void };
let push: ((req: Request) => void) | null = null;

/** Thay window.confirm: hộp xác nhận của app, trả về Promise<boolean>. */
export const confirmDialog = (message: string, opts: { title?: string; confirmLabel?: string } = {}) =>
  new Promise<boolean>((resolve) => {
    if (!push) return resolve(window.confirm(message));
    push({ message, ...opts, resolve });
  });

export const ConfirmDialogHost = () => {
  const [req, setReq] = useState<Request | null>(null);
  const done = useRef(false);
  useEffect(() => {
    push = (r) => {
      done.current = false;
      setReq(r);
    };
    return () => {
      push = null;
    };
  }, []);
  const finish = (ok: boolean) => {
    if (!req || done.current) return;
    done.current = true;
    req.resolve(ok);
    setReq(null);
  };
  return (
    <AlertDialog open={!!req} onOpenChange={(o) => !o && finish(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{req?.title ?? "Xác nhận"}</AlertDialogTitle>
          <AlertDialogDescription>{req?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(false)}>Huỷ</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => finish(true)}
          >
            {req?.confirmLabel ?? "Đồng ý"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
