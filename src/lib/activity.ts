import { supabase } from "@/integrations/supabase/client";

export interface ActivityLog {
  id: string;
  action: string;
  summary: string;
  actor_name: string | null;
  created_at: string;
}

export const listActivity = async (
  entityType: "candidate" | "employee" | "onboarding",
  entityId: string,
): Promise<ActivityLog[]> => {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, action, summary, actor_name, created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as ActivityLog[];
};
