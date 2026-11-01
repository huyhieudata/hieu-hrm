import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type QuestionType = "single" | "multi" | "text" | "rating";
export interface SurveyQuestion {
  id: string;
  type: QuestionType;
  label: string;
  options?: string[];
}
export interface Survey {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
  status: "draft" | "open" | "closed";
  anonymous: boolean;
  closes_at: string | null;
  created_at: string;
}
export type Answers = Record<string, string | string[] | number>;

export const listSurveys = async (companyId: string) => {
  const { data, error } = await db.from("surveys").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Survey[];
};

export const listMyResponses = async (companyId: string) => {
  const { data, error } = await db.from("survey_responses").select("survey_id").eq("company_id", companyId);
  if (error) throw new Error(error.message);
  return new Set<string>((data ?? []).map((r: { survey_id: string }) => r.survey_id));
};

export const submitSurvey = async (survey: Survey, answers: Answers) => {
  const { error } = await db.from("survey_responses").insert({ survey_id: survey.id, company_id: survey.company_id, answers });
  if (error) {
    if (String(error.code) === "23505") throw new Error("Bạn đã trả lời khảo sát này rồi.");
    throw new Error("Không gửi được: khảo sát có thể đã đóng.");
  }
};

export const createSurvey = async (values: Pick<Survey, "company_id" | "title" | "description" | "questions" | "anonymous" | "closes_at">) => {
  const { error } = await db.from("surveys").insert({ ...values, status: "open" });
  if (error) throw new Error(error.message);
};

export const setSurveyStatus = async (id: string, status: Survey["status"]) => {
  const { error } = await db.from("surveys").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
};

export const deleteSurvey = async (id: string) => {
  const { data, error } = await db.from("surveys").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Không xoá được: bạn không có quyền hoặc khảo sát không còn.");
};

export interface SurveyResults {
  survey: Survey;
  members: number;
  responses: { answers: Answers; created_at: string; name: string | null }[];
}
export const loadSurveyResults = async (id: string) => {
  const { data, error } = await db.rpc("survey_results", { p_survey_id: id });
  if (error) throw new Error(error.message);
  return data as SurveyResults;
};
