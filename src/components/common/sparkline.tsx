import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  stroke: string;
  fill: string;
  className?: string;
  id?: string;
}

export const Sparkline = ({ data, stroke, className, id = "spark" }: SparklineProps) => {
  const width = 88;
  const height = 32;
  const safeData = (data.length >= 2 ? data : [data[0] ?? 0, data[0] ?? 0]).map((value) =>
    Number.isFinite(Number(value)) ? Number(value) : 0,
  );
  const min = Math.min(...safeData);
  const max = Math.max(...safeData);
  const span = max - min || 1;

  const points = safeData.map((value, index) => {
    const x = (index / (safeData.length - 1)) * width;
    const y = height - 4 - ((value - min) / span) * (height - 8);
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const gradientId = `${id}-gradient`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r="2.4"
        fill={stroke}
        stroke="hsl(var(--card))"
        strokeWidth="1.5"
      />
    </svg>
  );
};
