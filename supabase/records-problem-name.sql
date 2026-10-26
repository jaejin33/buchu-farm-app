-- 배수·균사 말고 다른 문제도 직접 적기 (8단계). 이미 records 표가 있는 Supabase의 SQL Editor에서 한 번 실행한다.
-- (records.sql에는 이 내용이 이미 들어 있다. 처음부터 새로 만드는 곳이면 이 파일은 실행하지 않는다)
-- 앱 새 버전을 push하기 전에 실행한다. 안 하면 새 버전 폰의 "직접 적은 문제" 기록이 서버에서 거절되어 "미전송"에 남는다

-- problem 칸에 'other'(직접 적은 문제)를 허락한다.
-- 표를 만들 때 칸 옆에 적은 check는 Postgres가 "표_칸_check"라는 이름을 붙인다 (records_problem_check)
alter table public.records drop constraint records_problem_check;
alter table public.records add constraint records_problem_check
  check (problem in ('drainage','mycelium','other'));

-- 직접 적은 문제 이름 칸
alter table public.records add column problem_name text;  -- problem이 'other'일 때

-- 추가할 수 있는 칸 목록(GRANT)에도 더한다. 조회는 표 전체에 열려 있어서 따로 할 것 없다
grant insert (problem_name) on public.records to authenticated;
