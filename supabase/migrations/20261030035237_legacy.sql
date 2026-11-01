create policy "employee_contracts_grant_all" on public.employee_contracts for all to authenticated
  using (public.has_permission(company_id, 'contracts.edit'))
  with check (public.has_permission(company_id, 'contracts.edit'));

create policy "employee_salary_grant_all" on public.employee_salary_records for all to authenticated
  using (public.has_permission(company_id, 'employees.edit'))
  with check (public.has_permission(company_id, 'employees.edit'));

create policy "employee_insurance_grant_all" on public.employee_insurance_records for all to authenticated
  using (public.has_permission(company_id, 'insurance.edit'))
  with check (public.has_permission(company_id, 'insurance.edit'));

create policy "employee_rewards_grant_all" on public.employee_rewards for all to authenticated
  using (public.has_permission(company_id, 'employees.edit'))
  with check (public.has_permission(company_id, 'employees.edit'));

create policy "employee_discipline_grant_all" on public.employee_discipline_records for all to authenticated
  using (public.has_permission(company_id, 'employees.edit'))
  with check (public.has_permission(company_id, 'employees.edit'));

create policy "employee_training_grant_all" on public.employee_training_records for all to authenticated
  using (public.has_permission(company_id, 'employees.edit'))
  with check (public.has_permission(company_id, 'employees.edit'));

create policy "employee_assets_grant_all" on public.employee_assets for all to authenticated
  using (public.has_permission(company_id, 'employees.edit'))
  with check (public.has_permission(company_id, 'employees.edit'));

create policy "employee_debts_grant_all" on public.employee_debts for all to authenticated
  using (public.has_permission(company_id, 'employees.edit'))
  with check (public.has_permission(company_id, 'employees.edit'));

create policy "employee_dependents_grant_all" on public.employee_dependents for all to authenticated
  using (public.has_permission(company_id, 'employees.edit'))
  with check (public.has_permission(company_id, 'employees.edit'));

create policy "employee_documents_grant_all" on public.employee_documents for all to authenticated
  using (public.has_permission(company_id, 'employees.edit'))
  with check (public.has_permission(company_id, 'employees.edit'));

create policy "employee_work_history_grant_all" on public.employee_work_history for all to authenticated
  using (public.has_permission(company_id, 'employees.edit'))
  with check (public.has_permission(company_id, 'employees.edit'));

create policy "employee_contacts_grant_all" on public.employee_contacts for all to authenticated
  using (public.has_permission(company_id, 'employees.edit'))
  with check (public.has_permission(company_id, 'employees.edit'));

create policy "employee_notes_grant_all" on public.employee_notes for all to authenticated
  using (public.has_permission(company_id, 'employees.edit'))
  with check (public.has_permission(company_id, 'employees.edit'));