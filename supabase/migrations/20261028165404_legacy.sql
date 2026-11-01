-- Enrich the migrated demo offers with allowance, department and benefits
update public.candidate_offers
offer_set
set department = coalesce(o.department, 'Kinh doanh'),
    allowance = 2000000,
    other_benefits = 'Bảo hiểm xã hội/y tế đầy đủ theo luật; 12 ngày phép năm; thưởng KPI theo quý; laptop làm việc; khám sức khoẻ định kỳ.',
    work_location = coalesce(o.work_location, 'Văn phòng Hà Nội – 25 Lý Thường Kiệt')
from public.candidate_offers o
where offer_set.id = o.id
  and o.candidate_id in (
    'd3000000-0000-4000-8000-000000000003',
    'd3000000-0000-4000-8000-000000000006',
    'd3000000-0000-4000-8000-000000000007'
  );