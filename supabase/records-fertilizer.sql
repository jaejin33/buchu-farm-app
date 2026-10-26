-- 웃거름·관비에 비료 이름 칸 더하기 (7단계). 이미 records 표가 있는 Supabase의 SQL Editor에서 한 번 실행한다.
-- (records.sql에는 이 칸이 이미 들어 있다. 처음부터 새로 만드는 곳이면 이 파일은 실행하지 않는다)
-- 앱 새 버전을 push하기 전에 실행한다. 칸이 없으면 새 버전 폰의 웃거름·관비 기록이 서버에서 거절되어 "미전송"에 남는다

alter table public.records add column fertilizer text;  -- top_dressing, fertigation

-- 추가할 수 있는 칸 목록(GRANT)에도 더한다. 조회는 표 전체에 열려 있어서 따로 할 것 없다
grant insert (fertilizer) on public.records to authenticated;
