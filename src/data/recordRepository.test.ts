// fake-indexeddb: 테스트(Node)에는 브라우저의 IndexedDB가 없어서, 메모리에서 흉내 내는 것을 대신 끼운다.
// db.ts보다 먼저 불러와야 하므로 맨 위에 둔다
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentUser } from './auth'
import { db, type StoredRecord } from './db'
import { getHouseStatus } from '../domain/harvestCalc'
import { houseHistory, latestHarvestAmount } from '../domain/recordQueries'
import { LOCAL_USER_ID, addRecord, addRecords, editRecord, getAllRecords, removeTestRecords } from './recordRepository'
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

describe('addRecords', () => {
  it('섞어 친 약을 이름마다 기록 하나씩, 같은 입력 시각으로 한 번에 저장한다', async () => {
    vi.mocked(uploadPending).mockClear()
    const saved = await addRecords([
      { type: 'spray', house_no: 3, work_date: '2026-10-29', pesticide: '가약', amount_ml: 20, memo: null },
      { type: 'spray', house_no: 3, work_date: '2026-10-29', pesticide: '나약', amount_ml: null, memo: null },
    ])

    expect(saved.map((r) => r.type === 'spray' && r.pesticide)).toEqual(['가약', '나약'])
    expect(saved[0].id).not.toBe(saved[1].id)
    expect(saved[0].recorded_at).toBe(saved[1].recorded_at)
    expect(saved.every((r) => r.recorded_by === USER_ID)).toBe(true)
    expect(await getAllRecords()).toHaveLength(2)
    expect(uploadPending).toHaveBeenCalledTimes(1) // 올리기는 한 번만 시작한다
  })

  it('하나라도 저장하지 못하면 아무것도 남기지 않는다', async () => {
    const existing = await addRecord({ type: 'spray', house_no: 3, work_date: '2026-10-28', pesticide: '가약', memo: null })
    // 같은 id가 이미 있게 만들어 두 번째 기록이 실패하게 한다
    const ids = ['22222222-2222-4222-8222-222222222222', existing.id]
    const spy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => ids.shift() as ReturnType<Crypto['randomUUID']>)

    await expect(
      addRecords([
        { type: 'spray', house_no: 3, work_date: '2026-10-29', pesticide: '가약', memo: null },
        { type: 'spray', house_no: 3, work_date: '2026-10-29', pesticide: '나약', memo: null },
      ]),
    ).rejects.toThrow()
    spy.mockRestore()
    expect(await getAllRecords()).toEqual([{ ...existing, synced: 0 }])
  })
})

describe('editRecord', () => {
  const TODAY = '2026-10-27'

  it('원래 기록의 취소 + 새 기록을 추가하고, 이력에는 새 기록만 보인다', async () => {
    const original = await addRecord({ type: 'spray', house_no: 3, work_date: '2026-10-25', pesticide: '가약', amount_ml: 20, memo: null })

    const edited = await editRecord(original, { type: 'spray', house_no: 3, work_date: '2026-10-26', pesticide: '나약', amount_ml: 30, memo: null }, TODAY)

    const all = await getAllRecords()
    expect(all).toHaveLength(3) // 원래 기록은 그대로 남는다 (바꾸거나 지우지 않음)
    expect(all.find((r) => r.id === original.id)).toEqual({ ...original, synced: 0 })
    expect(all).toContainEqual(
      expect.objectContaining({ type: 'cancel', target_id: original.id, work_date: TODAY, recorded_by: USER_ID, synced: 0 }),
    )
    expect(houseHistory(all, 3)).toEqual([expect.objectContaining({ id: edited.id, work_date: '2026-10-26', pesticide: '나약', amount_ml: 30 })])
  })

  it('새 기록은 원래 기록의 입력 시각을 이어받아, 같은 날 기록끼리의 순서가 바뀌지 않는다', async () => {
    // 같은 날 아침에 시작, 저녁에 완료
    const base = { house_no: 5, work_date: '2026-10-26', memo: null, recorded_by: USER_ID, synced: 1 } as const
    const start: StoredRecord = { ...base, id: '33333333-3333-4333-8333-333333333333', type: 'harvest_start', recorded_at: '2026-10-25T23:00:00.000Z' }
    const harvest: StoredRecord = { ...base, id: '44444444-4444-4444-8444-444444444444', type: 'harvest', cycle_days: 35, recorded_at: '2026-10-26T09:00:00.000Z' }
    await db.records.bulkAdd([start, harvest])

    // 바꾼 것 없이 저장해도, 수확 시작이 완료보다 나중이 되어 "수확 중"으로 보이면 안 된다
    const edited = await editRecord(start, { type: 'harvest_start', house_no: 5, work_date: '2026-10-26', memo: null }, TODAY)

    expect(edited.recorded_at).toBe(start.recorded_at)
    expect(getHouseStatus(await getAllRecords(), 5, TODAY).kind).not.toBe('harvesting')
  })

  it('수확 완료를 수정하면 그 수확량이 새 수확 완료 기록으로 옮겨진다', async () => {
    const harvest = await addRecord({ type: 'harvest', house_no: 7, work_date: '2026-10-25', cycle_days: 35, memo: null })
    await addRecord({ type: 'harvest_amount', house_no: 7, work_date: '2026-10-26', target_id: harvest.id, boxes: 3, bunches: 5, memo: null })

    const edited = await editRecord(harvest, { type: 'harvest', house_no: 7, work_date: '2026-10-24', cycle_days: 40, memo: null }, TODAY)

    const all = await getAllRecords()
    expect(latestHarvestAmount(all, harvest.id)).toBeNull() // 원래 수확은 취소됐다
    expect(latestHarvestAmount(all, edited.id)).toEqual(
      expect.objectContaining({ boxes: 3, bunches: 5, work_date: '2026-10-26', house_no: 7 }),
    )
  })

  it('수확량이 없는 수확 완료를 수정하면 수확량을 만들지 않는다', async () => {
    const harvest = await addRecord({ type: 'harvest', house_no: 7, work_date: '2026-10-25', cycle_days: 35, memo: null })
    await editRecord(harvest, { type: 'harvest', house_no: 7, work_date: '2026-10-25', cycle_days: 30, memo: null }, TODAY)
    expect((await getAllRecords()).filter((r) => r.type === 'harvest_amount')).toHaveLength(0)
  })

  it('종류는 바꿀 수 없고, 아무것도 저장하지 않는다', async () => {
    const original = await addRecord({ type: 'spray', house_no: 3, work_date: '2026-10-25', pesticide: null, memo: null })
    await expect(
      editRecord(original, { type: 'fertigation', house_no: 3, work_date: '2026-10-25', memo: null }, TODAY),
    ).rejects.toThrow()
    expect(await getAllRecords()).toHaveLength(1)
  })

  it('저장한 뒤 서버로 올리기를 시작한다', async () => {
    const original = await addRecord({ type: 'fertigation', house_no: 1, work_date: '2026-10-22', memo: null })
    vi.mocked(uploadPending).mockClear()
    await editRecord(original, { type: 'fertigation', house_no: 1, work_date: '2026-10-23', memo: null }, TODAY)
    expect(uploadPending).toHaveBeenCalledTimes(1)
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
