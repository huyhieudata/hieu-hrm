export const currency = (value: number, compact = false) => {
  if (compact) {
    if (Math.abs(value) >= 1_000_000_000)
      return `${(value / 1_000_000_000).toFixed(2).replace(".", ",")} tỷ`;
    if (Math.abs(value) >= 1_000_000)
      return `${Math.round(value / 1_000_000)} tr`;
    return value.toLocaleString("vi-VN");
  }
  return `${value.toLocaleString("vi-VN")}đ`;
};

export const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const avatarTone = (seed: string) => {
  const tones = [
    "bg-primary/10 text-primary",
    "bg-chart-2/12 text-chart-2",
    "bg-chart-3/12 text-chart-3",
    "bg-chart-4/15 text-chart-4",
    "bg-chart-5/12 text-chart-5",
    "bg-info-subtle text-info",
  ];
  const hash = seed
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return tones[hash % tones.length];
};
