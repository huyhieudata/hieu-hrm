-- Tester#1: chặn ghi bảng cấu hình cho Quản lý/Nhân viên (chỉ owner/admin/hr). Idempotent, chính sách RESTRICTIVE cộng thêm vào chính sách cũ.
do $$
declare t text; c text;
begin
  foreach t in array array['approval_workflows','request_types','leave_policies','leave_policy_items','leave_policy_assignments',
    'attendance_policies','attendance_settings','work_shifts','contract_templates','document_checklist_templates','onboarding_checklist_templates'] loop
    if to_regclass('public.'||t) is null then continue; end if;
    foreach c in array array['insert','update','delete'] loop
      execute format('drop policy if exists %I on public.%I', t||'_cfg_role_'||c, t);
      if c='insert' then
        execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (public.has_company_role(company_id, array[''owner'',''admin'',''hr'']))', t||'_cfg_role_'||c, t);
      elsif c='update' then
        execute format('create policy %I on public.%I as restrictive for update to authenticated using (public.has_company_role(company_id, array[''owner'',''admin'',''hr''])) with check (public.has_company_role(company_id, array[''owner'',''admin'',''hr'']))', t||'_cfg_role_'||c, t);
      else
        execute format('create policy %I on public.%I as restrictive for delete to authenticated using (public.has_company_role(company_id, array[''owner'',''admin'',''hr'']))', t||'_cfg_role_'||c, t);
      end if;
    end loop;
  end loop;
  foreach t in array array['approval_workflow_steps','approval_workflow_types'] loop
    foreach c in array array['insert','update','delete'] loop
      execute format('drop policy if exists %I on public.%I', t||'_cfg_role_'||c, t);
      if c='insert' then
        execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (exists (select 1 from public.approval_workflows w where w.id = workflow_id and public.has_company_role(w.company_id, array[''owner'',''admin'',''hr''])))', t||'_cfg_role_'||c, t);
      elsif c='update' then
        execute format('create policy %I on public.%I as restrictive for update to authenticated using (exists (select 1 from public.approval_workflows w where w.id = workflow_id and public.has_company_role(w.company_id, array[''owner'',''admin'',''hr''])))', t||'_cfg_role_'||c, t);
      else
        execute format('create policy %I on public.%I as restrictive for delete to authenticated using (exists (select 1 from public.approval_workflows w where w.id = workflow_id and public.has_company_role(w.company_id, array[''owner'',''admin'',''hr''])))', t||'_cfg_role_'||c, t);
      end if;
    end loop;
  end loop;
end $$;
