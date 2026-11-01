-- #48: nhân viên xem phiếu đánh giá ĐÃ CHỐT của chính mình (kèm tên tiêu chí và điểm), không xem được của người khác.
-- Nhân viên không có quyền đọc biểu mẫu/tiêu chí nên dùng RPC security definer, lọc theo auth.uid(). Idempotent.
create or replace function public.my_evaluations(p_company uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'submitted_at' desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', ev.id, 'kind', ev.kind, 'period_label', ev.period_label,
      'period_start', ev.period_start, 'period_end', ev.period_end,
      'submitted_at', ev.submitted_at, 'total_score', ev.total_score,
      'recommendation', ev.recommendation, 'strengths', ev.strengths,
      'improvements', ev.improvements, 'overall_comment', ev.overall_comment,
      'template_name', t.name, 'scale_max', t.scale_max,
      'criteria', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', c.name, 'group_name', c.group_name, 'weight', c.weight,
          'score', ev.answers->c.id::text->'score', 'comment', ev.answers->c.id::text->>'comment')
          order by c.sort_order)
        from public.evaluation_criteria c where c.template_id = ev.template_id), '[]'::jsonb)
    ) x
    from public.employee_evaluations ev
    join public.employees e on e.id = ev.employee_id
    join public.evaluation_templates t on t.id = ev.template_id
    where ev.company_id = p_company and ev.status = 'submitted'
      and e.user_id = auth.uid() and auth.uid() is not null
      and public.is_company_member(p_company)
  ) s;
$$;
revoke all on function public.my_evaluations(uuid) from public, anon;
grant execute on function public.my_evaluations(uuid) to authenticated;
