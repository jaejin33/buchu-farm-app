// 로그인. 아버지·형이 각자 계정으로, 앱을 설치할 때 한 번만 로그인한다.
// 계정은 Supabase 화면에서 직접 만들고, 앱에는 가입 화면이 없다 (Supabase에서 가입도 막아 둠).
//
// "누가 로그인했나"는 Supabase 로그인 정보와 따로 이 폰에 적어 둔다 (CURRENT_USER_KEY).
// Supabase의 로그인 표(토큰)는 1시간마다 인터넷으로 새로 받아야 하는데, 하우스에서 인터넷이 끊긴 채 앱을 열면
// 표가 지나 있어 "로그인 안 됨"으로 보일 수 있다. 그래도 기록은 폰에 저장되어야 하므로,
// 화면은 이 폰에 적어 둔 사용자를 기준으로 연다. 서버로 보내는 일(6-4단계)만 인터넷이 될 때 표를 새로 받아 한다

import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

export interface CurrentUser {
  id: string // Supabase Auth 사용자 id. 기록의 recorded_by에 들어간다
  email: string
}

const CURRENT_USER_KEY = 'buchu-farm:user'

/** 이 폰에서 로그인한 사람. 로그인 전이면 null */
export function getCurrentUser(): CurrentUser | null {
  try {
    const saved = localStorage.getItem(CURRENT_USER_KEY)
    return saved === null ? null : (JSON.parse(saved) as CurrentUser)
  } catch {
    return null
  }
}

export type SignInResult =
  | 'ok'
  | 'wrong' // 이메일이나 비밀번호가 틀림
  | 'offline' // 인터넷이 안 됨
  | 'failed' // 그 밖의 이유 (잠시 뒤 다시)

/** 이메일·비밀번호로 로그인한다. 처음 한 번은 인터넷이 필요하다 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  if (!navigator.onLine) return 'offline'
  const { data, error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password })
  if (error) {
    if (isAuthRetryableFetchError(error)) return 'offline'
    if (error.code === 'invalid_credentials') return 'wrong'
    return 'failed'
  }
  const user: CurrentUser = { id: data.user.id, email: data.user.email ?? email.trim() }
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user))
  return 'ok'
}
