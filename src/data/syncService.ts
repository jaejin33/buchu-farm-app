// 동기화: 폰(IndexedDB)과 Supabase 사이에서 기록을 주고받는다.
// - 올리기(6-4): 폰에서 저장한 기록 중 아직 안 보낸 것(synced = 0)을 서버로
// - 내려받기(6-5): 서버에 새로 들어온 기록(다른 폰에서 올린 것) 중 폰에 없는 것을 폰으로.
//   폰에 이미 있는 보낸 기록은 서버 것으로 바꾼다 (옛 버전이 빼 둔 칸을 채우려고, 9단계)
// - 이름 받기(6-6): 사람 이름 표(profiles)를 통째로 폰으로
// 화면은 항상 IndexedDB를 기준으로 그리므로, 주고받기가 실패해도 화면과 입력은 그대로 동작한다.
// 실패하면 다음 기회(저장 직후, 인터넷 재연결, 앱 실행, 앱 화면으로 돌아옴)에 다시 한다

import { nowTimestamp } from '../domain/today'
import type { FarmRecord, HouseProblem, Profile, RecordType } from '../domain/types'
import { db, type StoredRecord } from './db'
import { getSupabase } from './supabase'

/** PostgreSQL 에러 코드: 같은 기본 키(id)가 이미 있음 */
const DUPLICATE_KEY = '23505'

/**
 * 마지막으로 받은 기록의 서버 시각(received_at). 다음 내려받기는 이 시각 근처부터 가져온다.
 * 이름 끝 숫자는 "기록 모양" 번호다. 기록에 새 칸을 더하면 숫자를 올린다. 그러면 새 버전은 이 값을 못 찾아
 * 처음부터 다시 받고, 옛 버전이 새 칸을 모르고 저장해 둔 기록(9단계 ml·포, 7단계 비료 이름)을 서버 것으로 바꾼다 (9단계)
 */
const LAST_RECEIVED_KEY = 'buchu-farm:last-received-at:2'

/**
 * 내려받을 때 마지막으로 받은 시각보다 이만큼 앞부터 다시 가져온다.
 * received_at은 서버가 저장을 "시작한" 시각이라, 먼저 시작해 늦게 끝난 기록은 더 늦은 기록보다 늦게 보일 수 있다.
 * 그런 기록을 놓치지 않게 겹쳐 가져오고, 이미 폰에 있는 기록은 id로 거른다
 */
const OVERLAP_MS = 5 * 60 * 1000

/** 한 번 요청에 받는 기록 수. Supabase는 한 번에 최대 1000줄까지 돌려준다 */
const PAGE_SIZE = 1000

/** 마지막으로 서버에서 끝까지 받은 시각 (폰 시각). 화면의 "마지막 동기화: N분 전"에 쓴다 */
const LAST_SYNCED_KEY = 'buchu-farm:last-synced-at'

/**
 * 한 번에 하나만 돌게 감싼다. 도는 중에 또 불리면 새로 시작하지 않고, 끝난 뒤 한 번 더 돈다
 * (그사이 저장되거나 들어온 기록도 놓치지 않게). 에러를 던지지 않는다 (실패하면 다음에 다시 한다)
 */
function oneAtATime(name: string, task: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null
  let again = false
  return () => {
    if (running !== null) {
      again = true
      return running
    }
    running = (async () => {
      try {
        do {
          again = false
          await task()
        } while (again)
      } catch (e) {
        console.warn(`${name} 실패 (다음에 다시 함)`, e)
      } finally {
        running = null
      }
    })()
    return running
  }
}

/** 인터넷이 되고 로그인 표(토큰)가 살아 있으면 Supabase 클라이언트, 아니면 null */
async function connectedSupabase() {
  if (!navigator.onLine) return null
  // 로그인 표가 지났으면 여기서 새로 받는다. 못 받으면(인터넷 끊김 등) null
  const supabase = getSupabase()
  const { data } = await supabase.auth.getSession()
  return data.session === null ? null : supabase
}

// ---- 올리기 ----

/**
 * 아직 안 보낸 기록(synced = 0)을 Supabase로 보낸다.
 * 보낸 기록과 "이미 서버에 있다"는 기록은 synced = 1로 바꾼다
 */
export const uploadPending = oneAtATime('기록 올리기', async () => {
  const pending = await db.records.where('synced').equals(0).toArray()
  if (pending.length === 0) return
  const supabase = await connectedSupabase()
  if (supabase === null) return

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
})

/** IndexedDB 기록 → Supabase records 테이블 한 줄. 폰에서만 쓰는 synced는 빼고 보낸다 */
function toRow(stored: StoredRecord): FarmRecord {
  const { synced: _synced, ...record } = stored
  return record
}

// ---- 내려받기 ----

/** Supabase records 테이블 한 줄. 그 종류에 없는 칸은 null로 온다 */
export interface RecordRow {
  id: string
  house_no: number
  work_date: string
  type: RecordType
  pesticide: string | null
  fertilizer: string | null
  amount_ml: number | null
  bags: number | null
  cycle_days: number | null
  boxes: number | null
  bunches: number | null
  problem: HouseProblem | 'other' | null
  problem_name: string | null
  resolved: boolean | null
  target_id: string | null
  memo: string | null
  recorded_by: string
  recorded_at: string
  received_at: string
}

/**
 * 서버에 새로 들어온 기록 중 폰에 없는 것을 IndexedDB에 추가한다 (synced = 1, 이미 서버에 있으므로).
 * 폰에 있는 보낸 기록(synced = 1)은 서버 것으로 바꾼다. 서버 기록은 바뀌지 않으므로 내용은 같고,
 * 옛 버전이 모르는 칸을 빼고 저장해 둔 기록만 빠진 칸이 채워진다 (9단계).
 * 아직 안 보낸 기록(synced = 0)은 건드리지 않는다 (올리기가 보내고 synced = 1로 바꾼다)
 */
export const downloadNew = oneAtATime('기록 내려받기', async () => {
  const supabase = await connectedSupabase()
  if (supabase === null) return

  const last = readLastReceivedAt()
  const since = last === null ? null : new Date(Date.parse(last) - OVERLAP_MS).toISOString()

  // 받은 순서(received_at, 같으면 id)로 줄 세워 PAGE_SIZE개씩 끊어 받는다. 처음 받는 폰은 기록 전부를 받는다
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from('records').select('*')
    if (since !== null) query = query.gte('received_at', since)
    const { data, error } = await query
      .order('received_at')
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
      .overrideTypes<RecordRow[], { merge: false }>() // 돌아오는 줄의 타입을 알려 준다 (테이블 타입을 따로 만들지 않아서)
    if (error !== null) throw error

    await addOrRefresh(data)
    // 폰에 다 넣은 뒤에 시각을 적는다. 넣다가 실패하면 다음에 같은 곳부터 다시 받는다
    if (data.length > 0) writeLastReceivedAt(data[data.length - 1].received_at)
    if (data.length < PAGE_SIZE) break
  }
  // 끝까지 받았다 = 서버와 이어져 있었다. 올리기는 바로 앞에서 했으니(syncNow), 못 올린 기록은 "미전송 N건"에 남는다
  writeLastSyncedAt(nowTimestamp())
})

/** 서버 기록 중 폰에 없는 id는 추가하고, 폰에 보낸 기록(synced = 1)으로 있으면 서버 것으로 바꾼다 */
async function addOrRefresh(rows: RecordRow[]): Promise<void> {
  const records = rows.flatMap((row) => {
    const r = fromRow(row)
    if (r === null) console.warn('알 수 없는 기록이라 건너뜀', row.id)
    return r === null ? [] : [r]
  })
  if (records.length === 0) return
  // 있는지 보기와 넣기를 한 묶음(transaction)으로 한다. 그사이 같은 기록이 다른 곳에서 추가되지 않게
  await db.transaction('rw', db.records, async () => {
    const existing = await db.records.bulkGet(records.map((r) => r.id))
    const toPut = records.filter((_, i) => existing[i] === undefined || existing[i].synced === 1)
    // bulkPut: 없으면 추가, 있으면 통째로 바꾼다
    await db.records.bulkPut(toPut.map((r) => ({ ...r, synced: 1 as const })))
  })
}

/**
 * Supabase 한 줄 → 기록. 그 종류에 없는 칸(null)은 빼서 폰에서 만든 기록과 모양을 같게 한다.
 * 꼭 있어야 할 칸이 비었거나 모르는 종류면 null (건너뛴다)
 */
export function fromRow(row: RecordRow): FarmRecord | null {
  const base = {
    id: row.id,
    house_no: row.house_no,
    work_date: row.work_date,
    memo: row.memo,
    recorded_by: row.recorded_by,
    // 서버는 "2026-10-23T01:00:00.123+00:00"처럼 돌려준다. 폰에서 만든 기록과 같은 모양("…123Z")으로 바꾼다
    recorded_at: new Date(row.recorded_at).toISOString(),
  }
  switch (row.type) {
    case 'spray':
      return { ...base, type: row.type, pesticide: row.pesticide, amount_ml: row.amount_ml }
    case 'top_dressing':
      return { ...base, type: row.type, fertilizer: row.fertilizer, bags: row.bags }
    case 'fertigation':
      return { ...base, type: row.type, fertilizer: row.fertilizer, amount_ml: row.amount_ml }
    case 'harvest_start':
      return { ...base, type: row.type }
    case 'harvest':
      return row.cycle_days === null ? null : { ...base, type: row.type, cycle_days: row.cycle_days }
    case 'harvest_amount':
      return row.target_id === null || row.boxes === null || row.bunches === null
        ? null
        : { ...base, type: row.type, target_id: row.target_id, boxes: row.boxes, bunches: row.bunches }
    case 'problem':
      if (row.problem === null || row.resolved === null) return null
      if (row.problem === 'other') {
        // 직접 적은 문제는 이름이 꼭 있어야 한다
        return row.problem_name === null
          ? null
          : { ...base, type: row.type, problem: row.problem, problem_name: row.problem_name, resolved: row.resolved }
      }
      return { ...base, type: row.type, problem: row.problem, resolved: row.resolved }
    case 'cancel':
      return row.target_id === null ? null : { ...base, type: row.type, target_id: row.target_id }
    default:
      return null
  }
}

function readLastReceivedAt(): string | null {
  try {
    return localStorage.getItem(LAST_RECEIVED_KEY)
  } catch {
    return null
  }
}

function writeLastReceivedAt(receivedAt: string): void {
  try {
    localStorage.setItem(LAST_RECEIVED_KEY, receivedAt)
  } catch {
    // 못 적으면 다음에 처음부터 다시 받는다 (폰에 있는 기록은 id로 걸러져서 문제없다)
  }
}

// ---- 마지막 동기화 시각 ----

/** 마지막 동기화 시각이 바뀌면 부를 함수들 (화면이 다시 그리게) */
const lastSyncedListeners = new Set<() => void>()

/** 마지막으로 서버에서 끝까지 받은 시각 (ISO 문자열). 한 번도 못 받았으면 null */
export function getLastSyncedAt(): string | null {
  try {
    return localStorage.getItem(LAST_SYNCED_KEY)
  } catch {
    return null
  }
}

/** 마지막 동기화 시각이 바뀔 때 listener를 부른다. 돌려주는 함수를 부르면 멈춘다 */
export function subscribeLastSyncedAt(listener: () => void): () => void {
  lastSyncedListeners.add(listener)
  return () => lastSyncedListeners.delete(listener)
}

function writeLastSyncedAt(time: string): void {
  try {
    localStorage.setItem(LAST_SYNCED_KEY, time)
  } catch {
    // 못 적으면 화면에 "동기화 전"으로 보일 뿐이다
  }
  lastSyncedListeners.forEach((listener) => listener())
}

// ---- 이름 받기 ----

/**
 * 사람 이름 표(profiles)를 통째로 받아 폰의 것을 바꾼다. 몇 줄 안 되고 개발자가 고칠 수 있는 표라,
 * 기록처럼 새것만 골라 받지 않고 매번 다 받아 덮어쓴다 (서버에서 지운 이름도 폰에서 지워진다)
 */
export const downloadProfiles = oneAtATime('이름 받기', async () => {
  const supabase = await connectedSupabase()
  if (supabase === null) return
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name')
    .overrideTypes<Profile[], { merge: false }>()
  if (error !== null) throw error
  // 지우기와 넣기를 한 묶음으로 한다. 그사이 화면이 이름 없는 표를 읽지 않게
  await db.transaction('rw', db.profiles, async () => {
    await db.profiles.clear()
    await db.profiles.bulkPut(data)
  })
})

// ---- 시작 ----

/** 올리고 나서 내려받고, 이름도 받는다 */
async function syncNow(): Promise<void> {
  await uploadPending()
  await downloadNew()
  await downloadProfiles()
}

/**
 * 앱이 열리고 로그인되어 있을 때 한 번 부른다: 지금 주고받고, 인터넷이 다시 연결될 때와
 * 앱 화면으로 돌아올 때마다 주고받는다. (홈 화면 앱은 꺼지지 않고 뒤에 있다가 다시 보이는 일이 많아서,
 * 돌아올 때 받지 않으면 다른 폰의 기록이 앱을 완전히 껐다 켤 때까지 안 보인다)
 * 돌려주는 함수를 부르면 감시를 멈춘다 (React useEffect의 정리 함수로 쓴다)
 */
export function startSync(): () => void {
  const onOnline = () => void syncNow()
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncNow()
  }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  void syncNow()
  return () => {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
