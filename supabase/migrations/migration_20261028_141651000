-- Remove ONLY the two temporary test users and their test company created by my verification script minutes ago

delete from public.companies where id = '73c5a211-785c-4158-8414-351b00975b83' and name like 'Công ty Test %';
delete from public.profiles where id in ('423f8965-fb46-4792-b6c6-002962a53f80', '5fc5704b-7674-4b3b-a7ce-a79ccb7fef68');
delete from auth.users where id in ('423f8965-fb46-4792-b6c6-002962a53f80', '5fc5704b-7674-4b3b-a7ce-a79ccb7fef68');