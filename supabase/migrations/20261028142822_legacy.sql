-- Remove ONLY the temporary verification data created by my test scripts (companies "EP Test %" and their test accounts)
delete from public.companies where name like 'EP Test %';
delete from public.profiles where email like 'ep.owner.%@example.com' or email like 'ep.manager.%@example.com';
delete from auth.users where email like 'ep.owner.%@example.com' or email like 'ep.manager.%@example.com';