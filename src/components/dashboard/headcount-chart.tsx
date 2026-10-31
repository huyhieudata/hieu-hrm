import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Card } from "@/components/ui/card";

interface TooltipPayload {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
}

const TrendTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-overlay">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Tháng {label}
      </p>
      <p className="tabular text-[12px] font-semibold text-foreground">
        {payload[0]?.value ?? 0} nhân sự
      </p>
    </div>
  );
};

export const HeadcountChart = ({ data }: { data: { month: string; count: number }[] }) => {
  const first = data[0]?.count ?? 0;
  const last = data[data.length - 1]?.count ?? 0;
  const growth = first > 0 ? ((last - first) / first) * 100 : 0;
  const positive = growth >= 0;

  return (
    <Card className="col-span-1 flex flex-col overflow-hidden lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-2 pt-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold leading-6 text-foreground">Biến động nhân sự</h3>
            {first > 0 && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  positive ? "bg-success-subtle text-success" : "bg-destructive-subtle text-destructive"
                }`}
              >
                {positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {positive ? "+" : ""}
                {growth.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Số nhân sự đang làm việc cuối mỗi tháng, 6 tháng gần nhất
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-chart-1" /> Nhân sự
        </span>
      </div>

      {data.length === 0 ? (
        <div className="flex h-[248px] items-center justify-center px-5 text-center text-[12px] text-muted-foreground">
          Chưa có dữ liệu nhân sự.
        </div>
      ) : (
        <div className="mt-2 h-[248px] w-full pr-4">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={data} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="headcountFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={38}
                domain={[(min: number) => Math.max(0, min - 1), (max: number) => max + 1]}
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                content={<TrendTooltip />}
                cursor={{ stroke: "hsl(var(--primary) / 0.35)", strokeWidth: 1.5, strokeDasharray: "4 4" }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2.4}
                fill="url(#headcountFill)"
                activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};
