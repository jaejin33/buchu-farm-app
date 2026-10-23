// 동기화: 폰(IndexedDB)의 기록을 Supabase로 올린다 (6-4단계). 내려받기는 6-5단계에서 여기에 추가한다.
// 화면은 항상 IndexedDB를 기준으로 그리므로, 올리기가 실패해도 화면과 입력은 그대로 동작한다.
// 못 보낸 기록은 synced = 0으로 남아 있다가 다음 기회(저장 직후, 인터넷 재연결, 앱 실행)에 다시 보낸다

import type { FarmRecord } from '../domain/types'
import { db, type StoredRecord } from './db'
import { getSupabase } from './supabase'

/** PostgreSQL 에러 코드: 같은 기본 키(id)가 이미 있음 */
const DUPLICATE_KEY = '23505'

// 올리기가 도는 중이면 그 작업. 저장 직후·재연결·앱 실행이 겹쳐도 한 번에 하나만 돌게 한다
let running: Promise<void> | null = null
// 도는 중에 또 불렸으면 true. 그사이 저장된 기록도 보내도록 끝난 뒤 한 번 더 돈다
let again = false

/**
 * 아직 안 보낸 기록(synced = 0)을 Supabase로 보낸다. 에러를 던지지 않는다 (실패하면 다음에 다시 보낸다).
 * 보낸 기록과 "이미 서버에 있다"는 기록은 synced = 1로 바꾼다
 */
export function uploadPending(): Promise<void> {
  if (running !== null) {
    again = true
    return running
  }
  running = (async () => {
    try {
      do {
        again = false
        await uploadOnce()
      } while (again)
    } catch (e) {
      console.warn('기록 올리기 실패 (다음에 다시 보냄)', e)
    } finally {
      running = null
    }
  })()
  return running
}

async function uploadOnce(): Promise<void> {
  if (!navigator.onLine) return
  const pending = await db.records.where('synced').equals(0).toArray()
  if (pending.length === 0) return

  // 로그인 표(토큰)가 지났으면 여기서 새로 받는다. 못 받으면(인터넷 끊김 등) 다음에 보낸다
  const supabase = getSupabase()
  const { data } = await supabase.auth.getSession()
  if (data.session === null) return

  // 한 건씩 보낸다. 여러 건을 한 번에 보내면 그중 하나만 "이미 있음"이어도 전부 실패하기 때문이다.
  // 하루에 많아야 수십 건이라 한 건씩 보내도 충분히 빠르다
  for (const stored of pending) {
    // <FarmRecord>: 적지 않으면 TypeScript가 기록 종류 중 하나(약)만 골라 타입을 맞추려다 에러가 난다
    const { error } = await supabase.from('records').insert<FarmRecord>(toRow(stored))
    if (error === null || error.code === DUPLICATE_KEY) {
      await db.records.update(stored.id, { synced: 1 })
    } else {
      // 이 기록만 남겨 두고 다음 기록을 보낸다 (한 건이 막혀도 나머지는 올라가게)
      console.warn('기록 올리기 실패', stored.id, error)
    }
  }
}

/** IndexedDB 기록 → Supabase records 테이블 한 줄. 폰에서만 쓰는 synced는 빼고 보낸다 */
function toRow(stored: StoredRecord): FarmRecord {
  const { synced: _synced, ...record } = stored
  return record
}

/**
 * 앱이 열리고 로그인되어 있을 때 한 번 부른다: 지금 올리고, 인터넷이 다시 연결될 때마다 올린다.
 * 돌려주는 함수를 부르면 재연결 감시를 멈춘다 (React useEffect의 정리 함수로 쓴다)
 */
export function startSync(): () => void {
  const onOnline = () => void uploadPending()
  window.addEventListener('online', onOnline)
  void uploadPending()
  return () => window.removeEventListener('online', onOnline)
}
