-- Dry-run: khối DO luôn raise exception nên mọi thay đổi tự rollback.
do $dry$
declare s text; a boolean; b boolean; c boolean; n1 int; n2 int;
begin
-- Dán nội dung migration 20261101190000_email_chay_ngay_theo_cong_ty.sql vào đây (execute $m$...$m$;)

select string_agg(pg_get_function_identity_arguments(p.oid), ' / ') into s from pg_proc p where proname='email_enqueue_daily' and pronamespace='public'::regnamespace;
a := has_function_privilege('authenticated','public.email_enqueue_daily(boolean,uuid)','execute');
b := has_function_privilege('anon','public.email_run_daily_now(uuid)','execute');
c := has_function_privilege('authenticated','public.email_run_daily_now(uuid)','execute');
n1 := public.email_enqueue_daily(false);
n2 := public.email_enqueue_daily(true, gen_random_uuid());
raise exception 'DRYRUN sigs=[%] auth_enqueue=% anon_run=% auth_run=% cron_n=% othercompany_n=%', s,a,b,c,n1,n2;
end $dry$;