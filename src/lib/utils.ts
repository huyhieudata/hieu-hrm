import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


/** Supabase/PostgREST errors are plain objects, not Error instances. */
export const getErrorMessage = (error: unknown, fallback = "Không lưu được dữ liệu."): string => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) return message;
  }
  if (typeof error === "string" && error.trim().length > 0) return error;
  return fallback;
};
