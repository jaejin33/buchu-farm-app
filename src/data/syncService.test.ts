// fake-indexeddb: 테스트(Node)에는 브라우저의 IndexedDB가 없어서 메모리에서 흉내 내는 것을 끼운다 (db.ts보다 먼저)
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type StoredRecord } from './db'
import { uploadPending } from './syncService'

// 진짜 Supabase 대신, 보낸 기록을 받아 정해 둔 답을 돌려주는 가짜를 끼운다.
// vi.mock은 파일 맨 위로 끌어올려져 실행되므로, 안에서 쓰는 가짜 함수도 vi.hoisted로 먼저 만든다
const { insert, getSession } = vi.hoisted(() => ({ insert: vi.fn(), getSession: vi.fn() }))
vi.mock('./supabase', () => ({
  getSupabase: () => ({ auth: { getSession }, from: () => ({ insert }) }),
}))

const LOGGED_IN = { data: { session: { access_token: 'token' } } }
const OK = { error: null }
const DUPLICATE = { error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
const REJECTED = { error: { code: '42501', message: 'new row violates row-level security policy' } }

let nextNo = 1
/** 폰에 저장된 기록 하나를 만든다 (id 끝자리만 다르게) */
function stored(synced: 0 | 1): StoredRecord {
  const n = String(nextNo++).padStart(12, '0')
  return {
    id: `11111111-1111-4111-8111-${n}`,
    type: 'top_dressing',
    house_no: 1,
    work_date: '2026-10-23',
    memo: null,
    recorded_by: '22222222-2222-4222-8222-222222222222',
    recorded_at: '2026-10-23T01:00:00.000Z',
    synced,
  }
}

async function syncedOf(id: string) {
  return (await db.records.get(id))?.synced
}

beforeEach(async () => {
  await db.records.clear()
  insert.mockReset().mockResolvedValue(OK)
  getSession.mockReset().mockResolvedValue(LOGGED_IN)
  vi.stubGlobal('navigator', { onLine: true })
  vi.spyOn(console, 'warn').mockImplementation(() => {}) // 실패 테스트의 경고 글이 결과 화면을 덮지 않게
})

describe('uploadPending', () => {
  it('안 보낸 기록만 보내고, 보낸 기록은 synced = 1로 바꾼다', async () => {
    const pending = stored(0)
    const done = stored(1)
    await db.records.bulkAdd([pending, done])

    await uploadPending()

    expect(insert).toHaveBeenCalledTimes(1)
    const { synced: _synced, ...row } = pending
    expect(insert).toHaveBeenCalledWith(row) // 폰에서만 쓰는 synced는 빼고 보낸다
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
