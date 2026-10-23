// fake-indexeddb: 테스트(Node)에는 브라우저의 IndexedDB가 없어서, 메모리에서 흉내 내는 것을 대신 끼운다.
// db.ts보다 먼저 불러와야 하므로 맨 위에 둔다
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentUser } from './auth'
import { db } from './db'
import { LOCAL_USER_ID, addRecord, getAllRecords, removeTestRecords } from './recordRepository'
import { uploadPending } from './syncService'

// 로그인은 진짜 Supabase가 필요해서, "이 폰에서 로그인한 사람"을 돌려주는 함수만 가짜로 바꾼다.
// vi.mock은 Java의 Mockito.when(...).thenReturn(...)처럼 진짜 대신 정해 둔 값을 돌려주게 한다
vi.mock('./auth', () => ({ getCurrentUser: vi.fn() }))
// 서버로 올리기도 가짜로 바꿔, 불렸는지만 본다 (올리기 자체는 syncService.test.ts에서 시험한다)
vi.mock('./syncService', () => ({ uploadPending: vi.fn() }))

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const USER_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(async () => {
  await db.records.clear()
  vi.mocked(getCurrentUser).mockReturnValue({ id: USER_ID, email: 'test@example.com' })
})

describe('addRecord', () => {
  it('id·입력한 사람·입력 시각을 채워 저장한다', async () => {
    const saved = await addRecord({ type: 'spray', house_no: 3, work_date: '2026-10-22', pesticide: '가약', memo: null })

    expect(saved.id).toMatch(UUID_PATTERN)
    expect(saved.recorded_by).toBe(USER_ID) // 로그인한 사람
    expect(Number.isNaN(Date.parse(saved.recorded_at))).toBe(false)
    expect(await getAllRecords()).toEqual([{ ...saved, synced: 0 }])
  })

  it('저장할 때마다 다른 id가 붙는다', async () => {
    const input = { type: 'top_dressing', house_no: 1, work_date: '2026-10-22', memo: null } as const
    const a = await addRecord(input)
    const b = await addRecord(input)
    expect(a.id).not.toBe(b.id)
    expect(await getAllRecords()).toHaveLength(2)
  })

  it('아직 서버로 안 보낸 기록(synced = 0)을 색인으로 찾을 수 있다', async () => {
    await addRecord({ type: 'fertigation', house_no: 1, work_date: '2026-10-22', memo: null })
    expect(await db.records.where('synced').equals(0).count()).toBe(1)
  })

  it('저장한 뒤 서버로 올리기를 시작한다', async () => {
    vi.mocked(uploadPending).mockClear()
    await addRecord({ type: 'fertigation', house_no: 1, work_date: '2026-10-22', memo: null })
    expect(uploadPending).toHaveBeenCalledTimes(1)
  })

  it('로그인 전에는 저장하지 않는다', async () => {
    vi.mocked(getCurrentUser).mockReturnValue(null)
    await expect(addRecord({ type: 'fertigation', house_no: 1, work_date: '2026-10-22', memo: null })).rejects.toThrow()
    expect(await getAllRecords()).toHaveLength(0)
  })
})

describe('removeTestRecords', () => {
  it('로그인 전 시험 기록(임시 입력자)만 지우고, 로그인한 사람의 기록은 남긴다', async () => {
    const mine = await addRecord({ type: 'top_dressing', house_no: 2, work_date: '2026-10-22', memo: null })
    await db.records.add({
      id: '22222222-2222-4222-8222-222222222222',
      type: 'top_dressing',
      house_no: 1,
      work_date: '2026-10-21',
      memo: null,
      recorded_by: LOCAL_USER_ID,
      recorded_at: '2026-10-21T09:00:00.000Z',
      synced: 0,
    })

    await removeTestRecords()

    expect((await getAllRecords()).map((r) => r.id)).toEqual([mine.id])
  })
})
