import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const token = (name: string) => `hsl(var(--${name}))`;
const tokenAlpha = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1440px" },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "Be Vietnam Pro", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Be Vietnam Pro", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        "brand-navy": tokenAlpha("brand-navy"),
        "brand-orange": tokenAlpha("brand-orange"),
        border: tokenAlpha("border"),
        input: tokenAlpha("input"),
        ring: token("ring"),
        background: token("background"),
        foreground: token("foreground"),
        primary: {
          DEFAULT: token("primary"),
          foreground: token("primary-foreground"),
          hover: token("primary-hover"),
          active: token("primary-active"),
          subtle: token("primary-subtle"),
          "subtle-foreground": token("primary-subtle-foreground"),
        },
        secondary: {
          DEFAULT: token("secondary"),
          foreground: token("secondary-foreground"),
        },
        destructive: {
          DEFAULT: token("destructive"),
          foreground: token("destructive-foreground"),
          subtle: token("destructive-subtle"),
        },
        success: {
          DEFAULT: token("success"),
          foreground: token("success-foreground"),
          subtle: token("success-subtle"),
        },
        warning: {
          DEFAULT: token("warning"),
          foreground: token("warning-foreground"),
          subtle: token("warning-subtle"),
        },
        info: {
          DEFAULT: token("info"),
          foreground: token("info-foreground"),
          subtle: token("info-subtle"),
        },
        muted: {
          DEFAULT: token("muted"),
          foreground: token("muted-foreground"),
        },
        accent: {
          DEFAULT: token("accent"),
          foreground: token("accent-foreground"),
        },
        popover: {
          DEFAULT: token("popover"),
          foreground: token("popover-foreground"),
        },
        card: {
          DEFAULT: token("card"),
          foreground: token("card-foreground"),
        },
        overlay: tokenAlpha("overlay"),
        chart: {
          1: token("chart-1"),
          2: token("chart-2"),
          3: token("chart-3"),
          4: token("chart-4"),
          5: token("chart-5"),
        },
        sidebar: {
          DEFAULT: tokenAlpha("sidebar-background"),
          foreground: tokenAlpha("sidebar-foreground"),
          primary: tokenAlpha("sidebar-primary"),
          "primary-foreground": tokenAlpha("sidebar-primary-foreground"),
          accent: tokenAlpha("sidebar-accent"),
          "accent-foreground": tokenAlpha("sidebar-accent-foreground"),
          border: tokenAlpha("sidebar-border"),
          ring: tokenAlpha("sidebar-ring"),
        },
      },
      borderRadius: {
        sm: "calc(var(--radius) - 6px)",
        DEFAULT: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 4px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 10px)",
        "3xl": "1.75rem",
      },
      boxShadow: {        xs: "0 1px 2px 0 hsl(222 47% 11% / 0.04)",
        soft: "0 1px 3px 0 hsl(222 47% 11% / 0.05), 0 1px 2px -1px hsl(222 47% 11% / 0.04)",
        card: "0 1px 3px 0 hsl(222 47% 11% / 0.04), 0 8px 24px -16px hsl(222 47% 11% / 0.16)",
        raised: "0 4px 16px -4px hsl(222 47% 11% / 0.08), 0 2px 6px -2px hsl(222 47% 11% / 0.05)",
        overlay: "0 24px 60px -24px hsl(222 47% 22% / 0.24), 0 8px 24px -12px hsl(222 47% 22% / 0.12)",
        focus: "0 0 0 3px hsl(var(--ring) / 0.18)",
        "primary-glow": "0 12px 28px -12px hsl(var(--primary) / 0.55)",
        brand: "0 12px 26px -14px hsl(var(--brand-navy) / 0.55)",
        glow: "0 14px 30px -10px rgb(14 45 88 / 0.6)",
      },
      backgroundImage: {
        brand: "linear-gradient(135deg, #0e2d58 0%, #1d4a84 100%)",
        "gradient-primary": "linear-gradient(135deg, #0e2d58 0%, #1d4a84 100%)",
        "gradient-accent": "linear-gradient(135deg, #fc600b 0%, #ff8a3d 100%)",
        "brand-soft":
          "linear-gradient(135deg, hsl(var(--primary) / 0.12) 0%, hsl(21 98% 52% / 0.12) 100%)",
        panel:
          "linear-gradient(155deg, hsl(214 100% 97%) 0%, hsl(221 92% 93%) 45%, hsl(258 96% 96%) 100%)",
        sheen: "linear-gradient(180deg, hsl(0 0% 100% / 0.7), hsl(0 0% 100% / 0))",
        "hairline-x": "linear-gradient(90deg, hsl(var(--border)), hsl(var(--border) / 0))",
      },
      transitionTimingFunction: {
        expo: "cubic-bezier(0.16, 1, 0.3, 1)",
        standard: "cubic-bezier(0.2, 0, 0, 1)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-left": {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgb(252 96 11 / 0.45)" },
          "70%": { boxShadow: "0 0 0 16px rgb(252 96 11 / 0)" },
          "100%": { boxShadow: "0 0 0 0 rgb(252 96 11 / 0)" },
        },
        "check-draw": {
          from: { strokeDashoffset: "48" },
          to: { strokeDashoffset: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-left": "slide-left 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 1.8s infinite",
        "pulse-ring": "pulse-ring 2s ease-out infinite",
        "check-draw": "check-draw 0.6s ease-out both",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
