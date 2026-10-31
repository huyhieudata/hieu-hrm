import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";

interface RecruitmentShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Recruitment sub-modules are navigated from the left sidebar, so the shell only
 * renders the page header and content.
 */
export const RecruitmentShell = ({ title, description, actions, children }: RecruitmentShellProps) => (
  <AppShell>
    <PageHeader eyebrow="Tuyển dụng" title={title} description={description} actions={actions} />
    {children}
  </AppShell>
);
