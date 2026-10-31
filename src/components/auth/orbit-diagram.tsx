import { LogoMark } from "@/components/brand/logo";

const nodes = [
  { label: "Hồ sơ nhân sự", x: 210, y: 34, dot: "bg-chart-1", delay: "0s" },
  { label: "Chấm công", x: 352, y: 88, dot: "bg-chart-2", delay: "0.6s" },
  { label: "Tính lương", x: 352, y: 214, dot: "bg-chart-3", delay: "1.2s" },
  { label: "Đánh giá", x: 210, y: 268, dot: "bg-chart-4", delay: "1.8s" },
  { label: "Tuyển dụng", x: 68, y: 214, dot: "bg-chart-5", delay: "2.4s" },
  { label: "Đơn từ", x: 68, y: 88, dot: "bg-primary", delay: "3s" },
];

export const OrbitDiagram = () => (
  <div className="relative mx-auto h-[300px] w-full max-w-[440px]">
    <svg viewBox="0 0 420 300" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <circle cx="210" cy="150" r="118" fill="none" stroke="hsl(var(--primary) / 0.12)" strokeDasharray="2 6" />
      <circle cx="210" cy="150" r="78" fill="none" stroke="hsl(var(--primary) / 0.1)" />
      {nodes.map((node) => (
        <line
          key={node.label}
          x1="210"
          y1="150"
          x2={node.x}
          y2={node.y}
          stroke="hsl(var(--primary) / 0.28)"
          strokeWidth="1.2"
          strokeDasharray="4 5"
        />
      ))}
    </svg>

    <div className="absolute left-1/2 top-1/2 flex h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-primary-glow ring-1 ring-primary/10">
      <LogoMark className="h-14 w-14 rounded-[16px]" />
    </div>

    {nodes.map((node) => (
      <div
        key={node.label}
        className="absolute -translate-x-1/2 -translate-y-1/2 animate-float"
        style={{
          left: `${(node.x / 420) * 100}%`,
          top: `${(node.y / 300) * 100}%`,
          animationDelay: node.delay,
        }}
      >
        <span className="flex items-center gap-2 whitespace-nowrap rounded-full border border-primary/12 bg-card/90 px-3.5 py-2 text-[12px] font-medium text-foreground shadow-soft backdrop-blur-sm">
          <span className={`h-1.5 w-1.5 rounded-full ${node.dot}`} />
          {node.label}
        </span>
      </div>
    ))}
  </div>
);
