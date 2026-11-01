import { Link } from "react-router-dom";

import { PageHeader } from "@/components/common/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { useSettingsGroups } from "@/components/settings/settings-nav";

const SettingsHome = () => {
  const groups = useSettingsGroups();
  return (
    <AppShell>
      <PageHeader eyebrow="Cài đặt" title="Cài đặt" description="Mọi cấu hình của công ty ở một nơi." />
      {groups.length === 0 && <p className="text-sm text-muted-foreground">Bạn chưa có quyền cấu hình nào.</p>}
      {groups.map((g) => (
        <section key={g.label} className="space-y-2">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#0e2d58]">{g.label}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.items.map((i) => (
              <Link key={i.to} to={i.to} className="flex items-start gap-3 rounded-xl border bg-card p-4 transition hover:border-[#fc600b]/60 hover:shadow-sm">
                <span className="rounded-lg bg-[#0e2d58]/5 p-2 text-[#0e2d58]"><i.icon className="h-5 w-5" /></span>
                <span>
                  <span className="block text-sm font-semibold">{i.label}</span>
                  <span className="block text-xs text-muted-foreground">{i.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </AppShell>
  );
};
export default SettingsHome;
