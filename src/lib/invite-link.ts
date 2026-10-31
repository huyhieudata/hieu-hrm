import { toast } from "sonner";

export const inviteLink = (token: string) => `${window.location.origin}/tham-gia/${token}`;

export const copyInviteLink = async (token: string) => {
  const url = inviteLink(token);
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Đã sao chép liên kết mời", { description: url });
  } catch {
    toast.message("Sao chép liên kết mời", { description: url });
  }
};
