// fake-indexeddb: 테스트(Node)에는 브라우저의 IndexedDB가 없어서, 메모리에서 흉내 내는 것을 대신 끼운다.
// db.ts보다 먼저 불러와야 하므로 맨 위에 둔다
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { LOCAL_USER_ID, addRecord, getAllRecords } from './recordRepository'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

beforeEach(async () => {
  await db.records.clear()
})

describe('addRecord', () => {
  it('id·입력한 사람·입력 시각을 채워 저장한다', async () => {
    const saved = await addRecord({ type: 'spray', house_no: 3, work_date: '2026-10-22', pesticide: '가약', memo: null })

    expect(saved.id).toMatch(UUID_PATTERN)
    expect(saved.recorded_by).toBe(LOCAL_USER_ID)
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
})
