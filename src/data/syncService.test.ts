// fake-indexeddb: 테스트(Node)에는 브라우저의 IndexedDB가 없어서 메모리에서 흉내 내는 것을 끼운다 (db.ts보다 먼저)
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type StoredRecord } from './db'
import {
  downloadNew,
  downloadProfiles,
  fromRow,
  getLastSyncedAt,
  subscribeLastSyncedAt,
  uploadPending,
  type RecordRow,
} from './syncService'

// 진짜 Supabase 대신, 보낸 기록을 받아 정해 둔 답을 돌려주는 가짜를 끼운다.
// vi.mock은 파일 맨 위로 끌어올려져 실행되므로, 안에서 쓰는 가짜 함수도 vi.hoisted로 먼저 만든다
const { insert, getSession, gte, range, fetchPage, fetchProfiles } = vi.hoisted(() => ({
  insert: vi.fn(),
  getSession: vi.fn(),
  gte: vi.fn(), // 내려받기의 "이 시각 이후" 조건
  range: vi.fn(), // 내려받기의 "몇 번째부터 몇 번째까지"
  fetchPage: vi.fn(), // 내려받기 요청 한 번의 답 ({ data, error })
  fetchProfiles: vi.fn(), // 이름 받기 요청의 답 ({ data, error })
}))
vi.mock('./supabase', () => {
  // select('*').gte(...).order(...).order(...).range(...).overrideTypes() 처럼 이어 부르는 것을 흉내 낸다
  const query = {
    gte: (...args: unknown[]) => (gte(...args), query),
    order: () => query,
    range: (...args: unknown[]) => (range(...args), query),
    overrideTypes: () => fetchPage(),
  }
  return {
    getSupabase: () => ({
      auth: { getSession },
      from: (table: string) =>
        table === 'profiles'
          ? { select: () => ({ overrideTypes: () => fetchProfiles() }) }
          : { insert, select: () => query },
    }),
  }
})

const LOGGED_IN = { data: { session: { access_token: 'token' } } }
const OK = { error: null }
const DUPLICATE = { error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
const REJECTED = { error: { code: '42501', message: 'new row violates row-level security policy' } }
const USER_A = '22222222-2222-4222-8222-222222222222'
const USER_B = '33333333-3333-4333-8333-333333333333'
const LAST_RECEIVED_KEY = 'buchu-farm:last-received-at'

let nextNo = 1
/** 기록 id (끝자리만 다르게) */
function nextId(): string {
  return `11111111-1111-4111-8111-${String(nextNo++).padStart(12, '0')}`
}

/** 폰에 저장된 기록 하나 */
function stored(synced: 0 | 1): StoredRecord {
  return {
    id: nextId(),
    type: 'top_dressing',
    house_no: 1,
    work_date: '2026-10-23',
    memo: null,
    recorded_by: USER_A,
    recorded_at: '2026-10-23T01:00:00.000Z',
    synced,
  }
}

/** 서버에서 내려오는 한 줄. 그 종류에 없는 칸은 null이다 */
function row(fields: Partial<RecordRow> = {}): RecordRow {
  return {
    id: nextId(),
    house_no: 3,
    work_date: '2026-10-23',
    type: 'top_dressing',
    pesticide: null,
    fertilizer: null,
    cycle_days: null,
    boxes: null,
    bunches: null,
    problem: null,
    resolved: null,
    target_id: null,
    memo: null,
    recorded_by: USER_B,
    recorded_at: '2026-10-23T01:00:00.5+00:00',
    received_at: '2026-10-23T01:00:01.123456+00:00',
    ...fields,
  }
}

async function syncedOf(id: string) {
  return (await db.records.get(id))?.synced
}

beforeEach(async () => {
  await db.records.clear()
  await db.profiles.clear()
  insert.mockReset().mockResolvedValue(OK)
  getSession.mockReset().mockResolvedValue(LOGGED_IN)
  gte.mockReset()
  range.mockReset()
  fetchPage.mockReset().mockResolvedValue({ data: [], error: null })
  fetchProfiles.mockReset().mockResolvedValue({ data: [], error: null })
  vi.stubGlobal('navigator', { onLine: true })
  // 테스트(Node)의 localStorage 대신 메모리에 두는 가짜
  const saved = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => saved.get(k) ?? null,
    setItem: (k: string, v: string) => void saved.set(k, v),
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {}) // 실패 테스트의 경고 글이 결과 화면을 덮지 않게
})

describe('uploadPending', () => {
  it('안 보낸 기록만 보내고, 보낸 기록은 synced = 1로 바꾼다', async () => {
    const pending = stored(0)
    const done = stored(1)
    await db.records.bulkAdd([pending, done])

    await uploadPending()

    expect(insert).toHaveBeenCalledTimes(1)
    const { synced: _synced, ...sent } = pending
    expect(insert).toHaveBeenCalledWith(sent) // 폰에서만 쓰는 synced는 빼고 보낸다
    expect(await syncedOf(pending.id)).toBe(1)
  })

  it('"이미 같은 id가 있다" 에러는 보낸 것으로 본다', async () => {
    const r = stored(0)
    await db.records.add(r)
    insert.mockResolvedValue(DUPLICATE)

    await uploadPending()

    expect(await syncedOf(r.id)).toBe(1)
  })

  it('거절된 기록은 남겨 두고, 다음 기록은 계속 보낸다', async () => {
    const rejected = stored(0)
    const ok = stored(0)
    await db.records.bulkAdd([rejected, ok])
    insert.mockResolvedValueOnce(REJECTED).mockResolvedValueOnce(OK)

    await uploadPending()

    expect(insert).toHaveBeenCalledTimes(2)
    expect(await syncedOf(rejected.id)).toBe(0) // 다음에 다시 보낸다
    expect(await syncedOf(ok.id)).toBe(1)
  })

  it('인터넷이 끊겨 있으면 보내지 않는다', async () => {
    const r = stored(0)
    await db.records.add(r)
    vi.stubGlobal('navigator', { onLine: false })

    await uploadPending()

    expect(insert).not.toHaveBeenCalled()
    expect(await syncedOf(r.id)).toBe(0)
  })

  it('로그인 표(토큰)를 새로 받지 못하면 보내지 않는다', async () => {
    const r = stored(0)
    await db.records.add(r)
    getSession.mockResolvedValue({ data: { session: null } })

    await uploadPending()

    expect(insert).not.toHaveBeenCalled()
    expect(await syncedOf(r.id)).toBe(0)
  })

  it('보내는 중에 에러가 나도 던지지 않고, 기록은 남겨 둔다', async () => {
    const r = stored(0)
    await db.records.add(r)
    insert.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(uploadPending()).resolves.toBeUndefined()
    expect(await syncedOf(r.id)).toBe(0)
  })

  it('여러 번 겹쳐 불러도 같은 기록을 두 번 보내지 않는다', async () => {
    const r = stored(0)
    await db.records.add(r)

    await Promise.all([uploadPending(), uploadPending(), uploadPending()])

    expect(insert).toHaveBeenCalledTimes(1)
    expect(await syncedOf(r.id)).toBe(1)
  })

  it('보내는 중에 새로 저장된 기록도 이어서 보낸다', async () => {
    const first = stored(0)
    const second = stored(0)
    await db.records.add(first)
    // 첫 기록을 보내는 도중에 두 번째 기록이 저장되고 올리기가 다시 불린다 (저장 직후 올리기)
    insert.mockImplementationOnce(async () => {
      await db.records.add(second)
      void uploadPending()
      return OK
    })

    await uploadPending()

    expect(await syncedOf(first.id)).toBe(1)
    expect(await syncedOf(second.id)).toBe(1)
  })
})

describe('downloadNew', () => {
  it('처음에는 처음부터 받아, 폰에 보낸 기록(synced = 1)으로 추가한다', async () => {
    const r = row({ type: 'spray', pesticide: '가약' })
    fetchPage.mockResolvedValueOnce({ data: [r], error: null })

    await downloadNew()

    expect(gte).not.toHaveBeenCalled() // 처음이라 시각 조건 없음
    expect(await db.records.get(r.id)).toEqual({
      id: r.id,
      type: 'spray',
      house_no: 3,
      work_date: '2026-10-23',
      pesticide: '가약',
      memo: null,
      recorded_by: USER_B,
      recorded_at: '2026-10-23T01:00:00.500Z', // 폰에서 만든 기록과 같은 모양으로
      synced: 1,
    })
    expect(localStorage.getItem(LAST_RECEIVED_KEY)).toBe(r.received_at)
  })

  it('다음에는 마지막으로 받은 시각보다 5분 앞부터 받는다 (경계에서 놓치지 않게)', async () => {
    localStorage.setItem(LAST_RECEIVED_KEY, '2026-10-23T01:10:00.000+00:00')

    await downloadNew()

    expect(gte).toHaveBeenCalledWith('received_at', '2026-10-23T01:05:00.000Z')
  })

  it('폰에 이미 있는 기록은 건드리지 않는다 (아직 안 보낸 내 기록도 그대로)', async () => {
    const mine = stored(0)
    await db.records.add(mine)
    const same = row({ id: mine.id, house_no: 9, recorded_by: USER_A })
    const other = row()
    fetchPage.mockResolvedValueOnce({ data: [same, other], error: null })

    await downloadNew()

    expect(await db.records.get(mine.id)).toEqual(mine)
    expect(await syncedOf(other.id)).toBe(1)
    expect(await db.records.count()).toBe(2)
  })

  it('한 번에 1000건씩 끊어 받고, 1000건보다 적게 오면 멈춘다', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, i) =>
      row({ received_at: `2026-10-23T01:00:00.${String(i).padStart(3, '0')}+00:00` }),
    )
    const last = row({ received_at: '2026-10-23T02:00:00+00:00' })
    fetchPage
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: [last], error: null })

    await downloadNew()

    expect(range.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ])
    expect(await db.records.count()).toBe(1001)
    expect(localStorage.getItem(LAST_RECEIVED_KEY)).toBe(last.received_at)
  })

  it('받다가 에러가 나면 던지지 않고, 마지막으로 받은 시각도 그대로 둔다', async () => {
    localStorage.setItem(LAST_RECEIVED_KEY, '2026-10-23T01:10:00.000+00:00')
    fetchPage.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'permission denied' } })

    await expect(downloadNew()).resolves.toBeUndefined()
    expect(localStorage.getItem(LAST_RECEIVED_KEY)).toBe('2026-10-23T01:10:00.000+00:00')
    expect(await db.records.count()).toBe(0)
  })

  it('인터넷이 끊겨 있거나 로그인 표를 못 받으면 받지 않는다', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    await downloadNew()
    vi.stubGlobal('navigator', { onLine: true })
    getSession.mockResolvedValue({ data: { session: null } })
    await downloadNew()

    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('끝까지 받으면 마지막 동기화 시각을 적고, 화면에 알린다', async () => {
    const listener = vi.fn()
    const stop = subscribeLastSyncedAt(listener)
    fetchPage.mockResolvedValueOnce({ data: [row()], error: null })

    const before = Date.now()
    await downloadNew()
    stop()

    const synced = getLastSyncedAt()
    expect(synced).not.toBeNull()
    expect(Date.parse(synced ?? '')).toBeGreaterThanOrEqual(before)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('받다가 에러가 나거나 인터넷이 끊겨 있으면 마지막 동기화 시각은 그대로 둔다', async () => {
    fetchPage.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'permission denied' } })
    await downloadNew()
    vi.stubGlobal('navigator', { onLine: false })
    await downloadNew()

    expect(getLastSyncedAt()).toBeNull()
  })

  it('알 수 없는 기록은 건너뛰고 나머지는 추가한다', async () => {
    const broken = row({ type: 'harvest', cycle_days: null })
    const ok = row()
    fetchPage.mockResolvedValueOnce({ data: [broken, ok], error: null })

    await downloadNew()

    expect(await db.records.get(broken.id)).toBeUndefined()
    expect(await syncedOf(ok.id)).toBe(1)
  })
})

describe('downloadProfiles', () => {
  it('서버의 이름 표로 폰의 것을 통째로 바꾼다 (서버에서 지운 이름은 폰에서도 지워진다)', async () => {
    await db.profiles.bulkAdd([
      { id: USER_A, name: '예전 이름' },
      { id: USER_B, name: '지워질 사람' },
    ])
    fetchProfiles.mockResolvedValueOnce({ data: [{ id: USER_A, name: '아버지' }], error: null })

    await downloadProfiles()

    expect(await db.profiles.toArray()).toEqual([{ id: USER_A, name: '아버지' }])
  })

  it('받다가 에러가 나면 던지지 않고, 폰의 이름 표는 그대로 둔다', async () => {
    await db.profiles.add({ id: USER_A, name: '아버지' })
    fetchProfiles.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'permission denied' } })

    await expect(downloadProfiles()).resolves.toBeUndefined()
    expect(await db.profiles.toArray()).toEqual([{ id: USER_A, name: '아버지' }])
  })

  it('인터넷이 끊겨 있으면 받지 않는다', async () => {
    vi.stubGlobal('navigator', { onLine: false })

    await downloadProfiles()

    expect(fetchProfiles).not.toHaveBeenCalled()
  })
})

describe('fromRow', () => {
  it('종류마다 그 종류의 칸만 남긴다', () => {
    const target = nextId()
    expect(fromRow(row({ type: 'harvest', cycle_days: 35 }))).toMatchObject({ type: 'harvest', cycle_days: 35 })
    expect(fromRow(row({ type: 'harvest_amount', target_id: target, boxes: 12, bunches: 3 }))).toMatchObject({
      type: 'harvest_amount',
      target_id: target,
      boxes: 12,
      bunches: 3,
    })
    expect(fromRow(row({ type: 'problem', problem: 'drainage', resolved: false }))).toMatchObject({
      type: 'problem',
      problem: 'drainage',
      resolved: false,
    })
    expect(fromRow(row({ type: 'cancel', target_id: target }))).toMatchObject({ type: 'cancel', target_id: target })
    expect(fromRow(row({ type: 'spray', pesticide: null }))).toMatchObject({ type: 'spray', pesticide: null })
    expect(fromRow(row({ type: 'top_dressing', fertilizer: '가비료' }))).toMatchObject({
      type: 'top_dressing',
      fertilizer: '가비료',
    })
    expect(fromRow(row({ type: 'fertigation', fertilizer: null }))).toMatchObject({ type: 'fertigation', fertilizer: null })

    const topDressing = fromRow(row({ type: 'top_dressing' }))
    expect(topDressing).not.toHaveProperty('pesticide')
    expect(topDressing).not.toHaveProperty('received_at') // 서버에서만 쓰는 칸
  })

  it('꼭 있어야 할 칸이 비었거나 모르는 종류면 null', () => {
    expect(fromRow(row({ type: 'harvest', cycle_days: null }))).toBeNull()
    expect(fromRow(row({ type: 'harvest_amount', target_id: nextId(), boxes: null, bunches: 3 }))).toBeNull()
    expect(fromRow(row({ type: 'problem', problem: 'mycelium', resolved: null }))).toBeNull()
    expect(fromRow(row({ type: 'cancel', target_id: null }))).toBeNull()
    expect(fromRow(row({ type: 'weeding' as RecordRow['type'] }))).toBeNull()
  })
})
