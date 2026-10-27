-- 물 기록 (11단계). 이미 records 표가 있는 Supabase의 SQL Editor에서 한 번 실행한다.
-- (records.sql에는 이 내용이 이미 들어 있다. 처음부터 새로 만드는 곳이면 이 파일은 실행하지 않는다)
-- 앱 새 버전을 push하기 전에 실행한다. 안 하면 새 버전 폰의 물 기록이 서버에서 거절되어 "미전송"에 남는다

-- type 칸에 'water'(물)를 허락한다.
-- 표를 만들 때 칸 옆에 적은 check는 Postgres가 "표_칸_check"라는 이름을 붙인다 (records_type_check)
alter table public.records drop constraint records_type_check;
alter table public.records add constraint records_type_check
  check (type in ('spray','top_dressing','fertigation','water','harvest_start','harvest','harvest_amount','problem','cancel'));

-- 물을 준 시간(분) 칸. 앱에서 시간·분(10분씩)으로 맞춘다
alter table public.records add column water_minutes int;  -- water

-- 추가할 수 있는 칸 목록(GRANT)에도 더한다. 조회는 표 전체에 열려 있어서 따로 할 것 없다
grant insert (water_minutes) on public.records to authenticated;
