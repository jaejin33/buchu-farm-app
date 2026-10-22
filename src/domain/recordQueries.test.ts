import { describe, expect, it } from 'vitest'
import { houseHistory, latestHarvestAmount, pesticideNames } from './recordQueries'
import type { CancelRecord, FarmRecord, HarvestAmountRecord, HarvestRecord, SprayRecord } from './types'

// ---- 테스트용 기록 만들기 ----

const common = { house_no: 1, memo: null, recorded_by: 'user-1', recorded_at: '2026-10-01T09:00:00+09:00' }

function spray(id: string, work_date: string, pesticide: string | null): SprayRecord {
  return { ...common, id, work_date, type: 'spray', pesticide }
}

function harvest(id: string, work_date: string): HarvestRecord {
  return { ...common, id, work_date, type: 'harvest', cycle_days: 35 }
}

function amount(id: string, target_id: string, recorded_at: string, boxes: number): HarvestAmountRecord {
  return { ...common, id, work_date: '2026-10-21', recorded_at, type: 'harvest_amount', target_id, boxes, bunches: 0 }
}

function cancel(id: string, target_id: string): CancelRecord {
  return { ...common, id, work_date: '2026-10-21', type: 'cancel', target_id }
}

// ---- 약 목록 ----

describe('pesticideNames', () => {
  it('최근에 친 약이 앞에 오고, 같은 이름은 한 번만 나온다', () => {
    const records = [spray('a', '2026-10-01', '가약'), spray('b', '2026-10-10', '나약'), spray('c', '2026-10-05', '가약')]
    expect(pesticideNames(records)).toEqual(['나약', '가약'])
  })

  it('같은 날이면 나중에 입력한 약이 앞에 온다', () => {
    const early = { ...spray('a', '2026-10-10', '가약'), recorded_at: '2026-10-10T08:00:00+09:00' }
    const late = { ...spray('b', '2026-10-10', '나약'), recorded_at: '2026-10-10T17:00:00+09:00' }
    expect(pesticideNames([early, late])).toEqual(['나약', '가약'])
  })

  it('이름을 안 적은 약 기록은 건너뛴다', () => {
    const records = [spray('a', '2026-10-01', null), spray('b', '2026-10-02', '  '), spray('c', '2026-10-03', '가약')]
    expect(pesticideNames(records)).toEqual(['가약'])
  })

  it('앞뒤 빈칸은 떼고 같은 이름으로 본다', () => {
    const records = [spray('a', '2026-10-01', ' 가약 '), spray('b', '2026-10-02', '가약')]
    expect(pesticideNames(records)).toEqual(['가약'])
  })

  it('취소된 약 기록의 이름은 목록에 넣지 않는다', () => {
    const records: FarmRecord[] = [spray('a', '2026-10-01', '가약'), spray('b', '2026-10-02', '잘못적은약'), cancel('c', 'b')]
    expect(pesticideNames(records)).toEqual(['가약'])
  })

  it('약 기록이 없으면 빈 목록', () => {
    expect(pesticideNames([harvest('h', '2026-10-01')])).toEqual([])
  })
})

// ---- 수확량 ----

describe('latestHarvestAmount', () => {
  it('수확량이 없으면 null', () => {
    expect(latestHarvestAmount([harvest('h', '2026-10-20')], 'h')).toBeNull()
  })

  it('여러 번 입력했으면 가장 나중에 입력한 것을 쓴다', () => {
    const records = [
      harvest('h', '2026-10-20'),
      amount('a2', 'h', '2026-10-21T09:00:00+09:00', 5),
      amount('a1', 'h', '2026-10-21T07:00:00+09:00', 3),
    ]
    expect(latestHarvestAmount(records, 'h')?.id).toBe('a2')
  })

  it('취소된 수확량은 건너뛴다', () => {
    const records: FarmRecord[] = [
      harvest('h', '2026-10-20'),
      amount('a1', 'h', '2026-10-21T07:00:00+09:00', 3),
      amount('a2', 'h', '2026-10-21T09:00:00+09:00', 5),
      cancel('c', 'a2'),
    ]
    expect(latestHarvestAmount(records, 'h')?.id).toBe('a1')
  })

  it('수확 완료 기록이 취소됐으면 수확량도 무시한다', () => {
    const records: FarmRecord[] = [
      harvest('h', '2026-10-20'),
      amount('a', 'h', '2026-10-21T07:00:00+09:00', 3),
      cancel('c', 'h'),
    ]
    expect(latestHarvestAmount(records, 'h')).toBeNull()
  })

  it('다른 수확에 붙은 수확량은 보지 않는다', () => {
    const records = [
      harvest('h1', '2026-09-10'),
      harvest('h2', '2026-10-20'),
      amount('a', 'h1', '2026-09-11T07:00:00+09:00', 3),
    ]
    expect(latestHarvestAmount(records, 'h2')).toBeNull()
  })
})

// ---- 이력 ----

describe('houseHistory', () => {
  const ids = (records: FarmRecord[]) => houseHistory(records, 1).map((r) => r.id)

  it('그 동의 기록만, 작업 날짜가 늦은 순으로', () => {
    const records = [
      spray('a', '2026-10-01', '가약'),
      harvest('b', '2026-10-10'),
      { ...spray('other', '2026-10-15', '가약'), house_no: 2 },
      spray('c', '2026-10-05', null),
    ]
    expect(ids(records)).toEqual(['b', 'c', 'a'])
  })

  it('같은 날이면 나중에 입력한 기록이 앞', () => {
    const early = { ...spray('a', '2026-10-10', '가약'), recorded_at: '2026-10-10T08:00:00+09:00' }
    const late = { ...harvest('b', '2026-10-10'), recorded_at: '2026-10-10T17:00:00+09:00' }
    expect(ids([early, late])).toEqual(['b', 'a'])
  })

  it('취소된 기록과 cancel 기록은 보이지 않는다', () => {
    const records: FarmRecord[] = [spray('a', '2026-10-01', '가약'), spray('b', '2026-10-02', '나약'), cancel('c', 'b')]
    expect(ids(records)).toEqual(['a'])
  })

  it('수확량은 수확마다 가장 나중에 입력한 것 하나만 보인다', () => {
    const records = [
      harvest('h', '2026-10-20'),
      amount('a1', 'h', '2026-10-21T07:00:00+09:00', 3),
      amount('a2', 'h', '2026-10-21T09:00:00+09:00', 5),
    ]
    expect(ids(records)).toEqual(['a2', 'h'])
  })

  it('나중 수확량을 취소하면 그 전 수확량이 다시 보인다', () => {
    const records: FarmRecord[] = [
      harvest('h', '2026-10-20'),
      amount('a1', 'h', '2026-10-21T07:00:00+09:00', 3),
      amount('a2', 'h', '2026-10-21T09:00:00+09:00', 5),
      cancel('c', 'a2'),
    ]
    expect(ids(records)).toEqual(['a1', 'h'])
  })

  it('수확 완료 기록을 취소하면 그 수확량도 보이지 않는다', () => {
    const records: FarmRecord[] = [
      harvest('h', '2026-10-20'),
      amount('a', 'h', '2026-10-21T07:00:00+09:00', 3),
      cancel('c', 'h'),
    ]
    expect(ids(records)).toEqual([])
  })
})
