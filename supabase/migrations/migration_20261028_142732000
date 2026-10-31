-- SELECT policy must not query the employees table for the row being inserted (it is not visible yet),
-- otherwise INSERT ... RETURNING fails. These are direct column checks only.
alter policy "employees_select_authorized" on public.employees
  using (
    user_id = auth.uid()
    or public.has_company_role(company_id, array['owner','admin','hr','manager'])
  );