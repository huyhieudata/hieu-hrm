-- Demo: multi-line benefits for the sample offers
update public.candidate_offers
set other_benefits = E'Bảo hiểm xã hội, bảo hiểm y tế đầy đủ theo luật\n12 ngày phép năm, nghỉ lễ theo quy định\nThưởng KPI theo quý, xét tăng lương 2 lần/năm\nLaptop làm việc, khám sức khoẻ định kỳ'
where candidate_id in (
  'd3000000-0000-4000-8000-000000000003',
  'd3000000-0000-4000-8000-000000000006',
  'd3000000-0000-4000-8000-000000000007'
);