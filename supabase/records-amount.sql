-- 약·관비에 ml, 비료(웃거름)에 포 수 칸 더하기 (9단계). 이미 records 표가 있는 Supabase의 SQL Editor에서 한 번 실행한다.
-- (records.sql에는 이 칸이 이미 들어 있다. 처음부터 새로 만드는 곳이면 이 파일은 실행하지 않는다)
-- 앱 새 버전을 push하기 전에 실행한다. 칸이 없으면 새 버전 폰의 약·비료·관비 기록이 서버에서 거절되어 "미전송"에 남는다

alter table public.records add column amount_ml int;      -- spray(약 원액), fertigation(관비). 정수 ml
alter table public.records add column bags      numeric;  -- top_dressing(비료). 0.5포처럼 소수도

-- 추가할 수 있는 칸 목록(GRANT)에도 더한다. 조회는 표 전체에 열려 있어서 따로 할 것 없다
grant insert (amount_ml, bags) on public.records to authenticated;
