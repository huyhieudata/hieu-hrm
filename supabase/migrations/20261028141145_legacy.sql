alter policy "companies_select_member" on public.companies
  using (public.is_company_member(id) or created_by = auth.uid());