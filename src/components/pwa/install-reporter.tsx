import { useEffect } from "react";

import { useCompany } from "@/lib/company-provider";
import { reportAppInstall } from "@/lib/app-installs";

/** Ghi nhận khi app chạy dạng đã cài (standalone) hoặc vừa cài xong. Không hiển thị gì. */
export const InstallReporter = () => {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? null;

  useEffect(() => {
    if (!companyId) return;
    const timer = window.setTimeout(
      () => void reportAppInstall(companyId, "open").catch(() => undefined),
      3000,
    );
    const onInstalled = () =>
      void reportAppInstall(companyId, "installed").catch(() => undefined);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [companyId]);

  return null;
};
