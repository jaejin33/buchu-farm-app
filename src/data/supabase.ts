// Supabase 연결. @supabase/supabase-js는 src/data/ 안에서만 쓴다 (나중에 서버를 바꿀 때 이 폴더만 고치려고).
// 주소와 키는 .env(이 PC)와 Vercel 환경 변수에서 온다. 둘 다 공개되어도 되는 값이고, 기록은 RLS가 막는다 (supabase/records.sql)

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * Supabase 클라이언트를 처음 쓸 때 만든다.
 * 파일을 불러오자마자 만들지 않는 이유: 테스트에는 .env 값이 없어서, 로그인·동기화를 안 쓰는 테스트까지 깨지기 때문이다
 */
export function getSupabase(): SupabaseClient {
  if (client !== null) return client
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('.env에 VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY가 없어요 (.env.example 참고)')
  client = createClient(url, key, {
    auth: {
      persistSession: true, // 로그인 상태를 폰에 남겨 둔다 (한 번만 로그인)
      autoRefreshToken: true, // 로그인 표(토큰)는 1시간마다 바뀌는데, 인터넷이 될 때 알아서 새로 받는다
      detectSessionInUrl: false, // 메일 링크·카카오 로그인을 안 쓰므로 주소에서 로그인 정보를 찾지 않는다
    },
  })
  return client
}
