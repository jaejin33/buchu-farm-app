-- 사람 이름 표 + 권한 (6-6단계). Supabase 화면의 SQL Editor에서 한 번 실행한다.
-- 기록에는 입력한 사람의 계정 id(recorded_by)만 있다. 이력에 "아버지"·"형"으로 보여 주려고 id → 이름 표를 둔다.
-- 이름은 개발자가 SQL Editor(아래 "이름 넣기")나 Table Editor에서 넣고 고친다. 앱은 읽기만 한다.
-- 기록(records)과 달리 설정이라 고칠 수 있다 (이름이 바뀌면 덮어씀)

create table public.profiles (
  id    uuid primary key references auth.users (id),  -- Supabase Auth 사용자 id (= records.recorded_by)
  name  text not null                                  -- 이력에 보일 이름
);

-- ---- 권한: 로그인한 사람은 모든 이름을 본다. 앱에서는 아무도 추가·수정·삭제하지 못한다 ----
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

alter table public.profiles enable row level security;

create policy "로그인한 사람은 모든 이름 조회"
  on public.profiles for select
  to authenticated
  using (true);

-- ---- 이름 넣기 (계정마다 한 번. 이메일은 Authentication → Users에 있는 것) ----
-- insert into public.profiles (id, name) select id, '아버지' from auth.users where email = '아버지 이메일';
-- insert into public.profiles (id, name) select id, '형' from auth.users where email = '형 이메일';
-- insert into public.profiles (id, name) select id, '개발자' from auth.users where email = '개발자 이메일';
--
-- 이름 바꾸기: update public.profiles set name = '새 이름' where id = (select id from auth.users where email = '...');
-- 계정을 지울 때는 이 표의 그 줄을 먼저 지운다 (references 때문에 남아 있으면 계정이 안 지워진다)
