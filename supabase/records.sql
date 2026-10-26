-- 기록 테이블 + 권한 (6단계). Supabase 화면의 SQL Editor에서 한 번 실행한다.
-- 규칙: 로그인한 사람은 모든 기록을 볼 수 있고, 자기 이름(recorded_by)으로만 추가할 수 있다.
--       수정·삭제는 아무도 못 한다 (기록은 추가만 한다. 잘못 넣은 기록은 cancel 기록으로 취소)

create table public.records (
  id           uuid primary key,
  house_no     int  not null,
  work_date    date not null,
  type         text not null check (type in
                 ('spray','top_dressing','fertigation','harvest_start','harvest','harvest_amount','problem','cancel')),
  pesticide    text,                   -- spray
  fertilizer   text,                   -- top_dressing, fertigation (7단계에 더함, records-fertilizer.sql)
  cycle_days   int,                    -- harvest
  boxes        int,                    -- harvest_amount
  bunches      int,                    -- harvest_amount
  problem      text check (problem in ('drainage','mycelium')),  -- problem
  resolved     boolean,                -- problem
  target_id    uuid,                   -- cancel, harvest_amount
  memo         text,
  recorded_by  uuid not null,          -- Supabase Auth 사용자 id
  recorded_at  timestamptz not null,   -- 폰에서 입력한 시각
  received_at  timestamptz not null default now()  -- 서버가 받은 시각
);

-- 내려받기는 "마지막으로 받은 시각 이후에 들어온 기록"을 찾는다
create index records_received_at_idx on public.records (received_at);

-- ---- 권한 1: 표 단위로 무엇을 할 수 있나 (GRANT) ----
-- 먼저 다 막고, 필요한 것만 연다.
-- anon(로그인 안 함)은 아무것도 못 한다. authenticated(로그인함)는 조회와 추가만 한다.
-- 추가할 때 received_at은 폰이 정할 수 없게 뺀다. 서버 시각(now())만 들어가야 내려받기가 기록을 놓치지 않는다
revoke all on public.records from anon, authenticated;
grant select on public.records to authenticated;
grant insert (id, house_no, work_date, type, pesticide, fertilizer, cycle_days, boxes, bunches,
              problem, resolved, target_id, memo, recorded_by, recorded_at)
  on public.records to authenticated;

-- ---- 권한 2: 줄 단위로 어떤 기록에 할 수 있나 (RLS) ----
alter table public.records enable row level security;

create policy "로그인한 사람은 모든 기록 조회"
  on public.records for select
  to authenticated
  using (true);

create policy "자기 이름으로만 기록 추가"
  on public.records for insert
  to authenticated
  with check (recorded_by = (select auth.uid()));

-- update, delete 정책은 만들지 않는다 → RLS가 켜져 있으면 정책이 없는 동작은 모두 막힌다
