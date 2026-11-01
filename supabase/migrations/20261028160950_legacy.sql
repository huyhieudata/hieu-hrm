-- Recreate the two public-form RPCs with non-shadowing parameter names (our own functions, no data affected)
drop function if exists public.peek_candidate_form(text);
drop function if exists public.submit_candidate_form(text, jsonb);

create or replace function public.peek_candidate_form(p_token text)
returns table (
  candidate_name text,
  position_applied text,
  company_name text,
  already_submitted boolean
) language sql stable security definer set search_path = public as $$
  select c.full_name, c.position_applied, co.name, c.form_submitted_at is not null
  from public.candidates c
  join public.companies co on co.id = c.company_id
  where c.form_token = p_token
  limit 1;
$$;

create or replace function public.submit_candidate_form(p_token text, payload jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  target public.candidates;
begin
  select c.* into target from public.candidates c where c.form_token = p_token limit 1;
  if not found then
    raise exception 'FORM_NOT_FOUND';
  end if;

  update public.candidates
  set full_name = coalesce(nullif(payload->>'full_name', ''), full_name),
      email = coalesce(nullif(payload->>'email', ''), email),
      phone = coalesce(nullif(payload->>'phone', ''), phone),
      date_of_birth = nullif(payload->>'date_of_birth', '')::date,
      gender = nullif(payload->>'gender', ''),
      address = nullif(payload->>'address', ''),
      position_applied = coalesce(nullif(payload->>'position_applied', ''), position_applied),
      experience_years = nullif(payload->>'experience_years', '')::numeric,
      current_salary = nullif(payload->>'current_salary', '')::numeric,
      expected_salary = nullif(payload->>'expected_salary', '')::numeric,
      education = nullif(payload->>'education', ''),
      note = nullif(payload->>'note', ''),
      profile_data = payload,
      form_submitted_at = now()
  where id = target.id;

  return true;
end;
$$;

revoke all on function public.peek_candidate_form(text) from public;
revoke all on function public.submit_candidate_form(text, jsonb) from public;
grant execute on function public.peek_candidate_form(text) to anon, authenticated;
grant execute on function public.submit_candidate_form(text, jsonb) to anon, authenticated;