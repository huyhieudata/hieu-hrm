export type ThemeChoice = "light" | "dark" | "system";

const KEY = "onhrm.theme";

export const readTheme = (): ThemeChoice => {
  try {
    const value = localStorage.getItem(KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    /* private mode */
  }
  return "light";
};

export const prefersDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export const resolveDark = (choice: ThemeChoice = readTheme()) =>
  choice === "dark" || (choice === "system" && prefersDark());

export const applyTheme = (choice: ThemeChoice = readTheme()) => {
  if (typeof document === "undefined") return;
  const dark = resolveDark(choice);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  const theme = document.querySelector('meta[name="theme-color"]');
  theme?.setAttribute("content", dark ? "#071629" : "#0e2d58");
};

export const writeTheme = (choice: ThemeChoice) => {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* ignore */
  }
  applyTheme(choice);
};
