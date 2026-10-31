create or replace function public.align_work_event_dates()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  prev_id uuid;
  prev_type text;
  prev_end date;
begin
  if new.event_type not in ('onboarding', 'return', 'resignation') then
    return new;
  end if;

  select w.id, w.event_type, w.end_date
    into prev_id, prev_type, prev_end
  from public.employee_work_history w
  where w.employee_id = new.employee_id
  order by w.start_date desc nulls last, w.created_at desc
  limit 1;

  if prev_id is null then
    return new;
  end if;

  if (prev_type in ('onboarding', 'return') and new.event_type = 'resignation')
     or (prev_type = 'resignation' and new.event_type in ('onboarding', 'return')) then

    if prev_end is not null then
      new.start_date := prev_end;
    elsif new.start_date is not null then
      update public.employee_work_history
      set end_date = new.start_date
      where id = prev_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger align_work_event_dates_trigger
  before insert on public.employee_work_history
  for each row execute function public.align_work_event_dates();