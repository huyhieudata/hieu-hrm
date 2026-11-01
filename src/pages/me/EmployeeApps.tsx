import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  CalendarDays,
  ClipboardList,
  FileText,
  FolderOpen,
  Megaphone,
  Newspaper,
  Search,
  Shield,
  Smartphone,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { useDeviceMode } from "@/hooks/use-device-mode";
import { useCompany } from "@/lib/company-provider";

interface AppTile {
  label: string;
  to: string;
  icon: LucideIcon;
  group: "mine" | "apps";
}

const EmployeeApps = () => {
  const mode = useDeviceMode();
  const { role, loading, canDo } = useCompany();
  const [query, setQuery] = useState("");
  const tiles = useMemo(() => {
    const mine: AppTile[] = [
      { label: "Tài khoản", to: "/toi", icon: UserRound, group: "mine" },
      { label: "Đơn từ", to: "/don-tu", icon: FileText, group: "mine" },
      { label: "Phiếu lương", to: "/toi/phieu-luong", icon: Wallet, group: "mine" },
    ];
    if (canDo("attendance", "view")) {
      mine.push(
        { label: "Bảng công", to: "/toi/bang-cong", icon: CalendarDays, group: "mine" },
        { label: "Lịch làm việc", to: "/cham-cong/lich-lam-viec", icon: CalendarDays, group: "mine" },
        { label: "Thiết bị", to: "/toi/thiet-bi", icon: Smartphone, group: "mine" },
      );
    }
    const apps: AppTile[] = [
      { label: "Tin nội bộ", to: "/toi/tin-tuc", icon: Newspaper, group: "apps" },
      { label: "Khảo sát", to: "/toi/khao-sat", icon: ClipboardList, group: "apps" },
      { label: "Tài liệu", to: "/toi/tai-lieu", icon: FolderOpen, group: "apps" },
    ];
    if (canDo("employees", "view")) apps.push({ label: "Danh bạ", to: "/employees", icon: Users, group: "apps" });
    if (canDo("assets", "view")) apps.push({ label: "Tài sản", to: "/tai-san", icon: FolderOpen, group: "apps" });
    if (canDo("insurance", "view")) apps.push({ label: "Bảo hiểm", to: "/bao-hiem", icon: Shield, group: "apps" });
    if (canDo("news", "view")) apps.push({ label: "Bảng tin", to: "/tin-tuc", icon: Megaphone, group: "apps" });
    return [...mine, ...apps];
  }, [canDo]);

  if (mode !== "mobile") return <Navigate to="/" replace />;
  if (!loading && role && role !== "employee") return <Navigate to="/" replace />;

  const needle = query.trim().toLocaleLowerCase("vi");
  const visible = needle ? tiles.filter((tile) => tile.label.toLocaleLowerCase("vi").includes(needle)) : tiles;
  const mine = visible.filter((tile) => tile.group === "mine");
  const apps = visible.filter((tile) => tile.group === "apps");

  return (
    <AppShell>
      <label className="shadow-card-soft flex h-12 items-center gap-2.5 rounded-full bg-card px-4 text-muted-foreground ring-1 ring-border">
        <Search className="h-4 w-4" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm kiếm ứng dụng..."
          className="h-11 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          enterKeyHint="search"
        />
      </label>
      {visible.length === 0 ? (
        <p className="px-2 py-10 text-center text-[13px] text-muted-foreground">Không có mục nào khớp.</p>
      ) : null}
      <TileGroup title={`Của tôi${mine.length ? `  ${mine.length}` : ""}`} items={mine} />
      <TileGroup title={`Ứng dụng${apps.length ? `  ${apps.length}` : ""}`} items={apps} />
    </AppShell>
  );
};

const TileGroup = ({ title, items }: { title: string; items: AppTile[] }) => {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 mt-5 px-1 text-[13px] font-bold tracking-wide text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to + item.label} to={item.to} className="shadow-card-soft flex h-[108px] flex-col items-center justify-center gap-2.5 rounded-[20px] bg-card">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-subtle text-brand-navy">
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span className="px-1 text-center text-[13px] font-medium text-foreground">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default EmployeeApps;
