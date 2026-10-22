import { describe, expect, it } from 'vitest'
import {
  activeRecords,
  addDays,
  daysBetween,
  getHouseStatus,
  harvestableDate,
  nextHarvestDate,
  sprayClearDate,
} from './harvestCalc'
import type { CancelRecord, FarmRecord, HarvestRecord, SprayRecord, TopDressingRecord } from './types'

// ---- 테스트용 기록 만들기 ----

const common = { memo: null, recorded_by: 'user-1', recorded_at: '2026-10-01T09:00:00+09:00' }

function spray(id: string, house_no: number, work_date: string, phi_days: number): SprayRecord {
  return { ...common, id, house_no, work_date, type: 'spray', pesticide: '테스트약', phi_days }
}

function harvest(id: string, house_no: number, work_date: string): HarvestRecord {
  return { ...common, id, house_no, work_date, type: 'harvest', amount: null, amount_unit: null }
}

function topDressing(id: string, house_no: number, work_date: string): TopDressingRecord {
  return { ...common, id, house_no, work_date, type: 'top_dressing' }
}

function cancel(id: string, house_no: number, target_id: string): CancelRecord {
  return { ...common, id, house_no, work_date: '2026-10-21', type: 'cancel', target_id }
}

// ---- 날짜 계산 ----

describe('addDays', () => {
  it('달과 해를 넘긴다', () => {
    expect(addDays('2026-10-25', 10)).toBe('2026-11-04')
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04')
  })

  it('윤년 2월 29일을 센다', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })

  it('0일을 더하면 그대로다', () => {
    expect(addDays('2026-10-21', 0)).toBe('2026-10-21')
  })

  it('형식이 틀리거나 없는 날짜면 에러를 낸다', () => {
    expect(() => addDays('2026-1-5', 1)).toThrow()
    expect(() => addDays('2026-10-21T00:00:00', 1)).toThrow()
    expect(() => addDays('2026-02-30', 1)).toThrow()
  })
})

describe('daysBetween', () => {
  it('뒤 날짜가 늦으면 양수, 같으면 0, 이르면 음수', () => {
    expect(daysBetween('2026-10-21', '2026-10-28')).toBe(7)
    expect(daysBetween('2026-10-21', '2026-10-21')).toBe(0)
    expect(daysBetween('2026-10-28', '2026-10-21')).toBe(-7)
  })

  it('해를 넘겨 센다', () => {
    expect(daysBetween('2026-12-25', '2027-01-05')).toBe(11)
  })
})

// ---- 취소 처리 ----

describe('activeRecords', () => {
  it('취소된 기록과 cancel 기록 자체를 뺀다', () => {
    const records = [spray('a', 1, '2026-10-01', 7), spray('b', 1, '2026-10-02', 7), cancel('c', 1, 'a')]
    expect(activeRecords(records).map((r) => r.id)).toEqual(['b'])
  })

  it('없는 기록을 가리키는 취소는 무시한다', () => {
    const records = [spray('a', 1, '2026-10-01', 7), cancel('c', 1, 'nothing')]
    expect(activeRecords(records).map((r) => r.id)).toEqual(['a'])
  })

  it('cancel을 취소하는 cancel은 무시한다: 원래 기록은 계속 취소된 상태다', () => {
    const records = [spray('a', 1, '2026-10-01', 7), cancel('c1', 1, 'a'), cancel('c2', 1, 'c1')]
    expect(activeRecords(records)).toEqual([])
  })

  it('같은 기록을 두 번 취소해도 문제없다', () => {
    const records = [spray('a', 1, '2026-10-01', 7), cancel('c1', 1, 'a'), cancel('c2', 1, 'a')]
    expect(activeRecords(records)).toEqual([])
  })
})

// ---- 약 때문에 벨 수 있는 날 ----

describe('sprayClearDate', () => {
  it('살포일 + phi_days', () => {
    expect(sprayClearDate([spray('a', 1, '2026-10-10', 14)], 1)).toBe('2026-10-24')
  })

  it('가장 최근 살포가 아니라 (살포일 + phi_days)가 가장 늦은 날을 쓴다', () => {
    const records = [
      spray('a', 1, '2026-10-01', 30), // 10-31
      spray('b', 1, '2026-10-15', 7), // 10-22
    ]
    expect(sprayClearDate(records, 1)).toBe('2026-10-31')
  })

  it('취소된 약 기록은 계산에서 뺀다', () => {
    const records = [spray('a', 1, '2026-10-01', 30), spray('b', 1, '2026-10-15', 7), cancel('c', 1, 'a')]
    expect(sprayClearDate(records, 1)).toBe('2026-10-22')
  })

  it('다른 동의 약 기록은 보지 않는다', () => {
    expect(sprayClearDate([spray('a', 2, '2026-10-10', 14)], 1)).toBeNull()
  })

  it('약 기록이 없으면 null', () => {
    expect(sprayClearDate([harvest('h', 1, '2026-10-01')], 1)).toBeNull()
  })
})

// ---- 다음 수확 예정일 ----

describe('nextHarvestDate', () => {
  it('마지막 수확일 + 35일 (기본값)', () => {
    const records = [harvest('h1', 1, '2026-08-01'), harvest('h2', 1, '2026-09-10')]
    expect(nextHarvestDate(records, 1)).toBe('2026-10-15')
  })

  it('수확 주기를 인자로 바꿀 수 있다', () => {
    expect(nextHarvestDate([harvest('h', 1, '2026-09-10')], 1, 30)).toBe('2026-10-10')
  })

  it('입력 순서와 상관없이 가장 늦은 수확일을 쓴다', () => {
    const records = [harvest('h2', 1, '2026-09-10'), harvest('h1', 1, '2026-08-01')]
    expect(nextHarvestDate(records, 1)).toBe('2026-10-15')
  })

  it('마지막 수확 기록이 취소되면 그 전 수확일을 쓴다', () => {
    const records = [harvest('h1', 1, '2026-08-01'), harvest('h2', 1, '2026-09-10'), cancel('c', 1, 'h2')]
    expect(nextHarvestDate(records, 1)).toBe('2026-09-05')
  })

  it('수확 기록이 없으면 null', () => {
    expect(nextHarvestDate([spray('a', 1, '2026-10-01', 7)], 1)).toBeNull()
  })
})

// ---- 하우스 상태 ----

describe('getHouseStatus', () => {
  const today = '2026-10-21'

  it('기록이 하나도 없으면 ⚪ 기록 없음', () => {
    expect(getHouseStatus([], 1, today)).toEqual({
      kind: 'no_record',
      daysLeft: null,
      sprayClearDate: null,
      nextHarvestDate: null,
    })
  })

  it('약 대기 기간이면 🔴 약 대기, 남은 일수 표시', () => {
    const status = getHouseStatus([spray('a', 1, '2026-10-18', 7)], 1, today) // 10-25
    expect(status.kind).toBe('spray_wait')
    expect(status.daysLeft).toBe(4)
    expect(status.sprayClearDate).toBe('2026-10-25')
  })

  it('벨 수 있는 날 당일에는 약 대기가 아니다', () => {
    const records: FarmRecord[] = [spray('a', 1, '2026-10-14', 7), harvest('h', 1, '2026-09-01')] // 10-21
    expect(getHouseStatus(records, 1, today).kind).toBe('ready')
  })

  it('벨 수 있는 날 하루 전에는 D-1 약 대기', () => {
    const status = getHouseStatus([spray('a', 1, '2026-10-15', 7)], 1, today) // 10-22
    expect(status.kind).toBe('spray_wait')
    expect(status.daysLeft).toBe(1)
  })

  it('약 대기가 자라는 중보다 우선한다', () => {
    const records: FarmRecord[] = [
      harvest('h', 1, '2026-10-01'), // 다음 수확 11-05
      spray('a', 1, '2026-10-20', 30), // 벨 수 있는 날 11-19
    ]
    const status = getHouseStatus(records, 1, today)
    expect(status.kind).toBe('spray_wait')
    expect(status.daysLeft).toBe(29)
  })

  it('자라는 중이 약 대기보다 늦게 끝나도, 약 대기가 남아 있으면 약 대기로 표시한다', () => {
    const records: FarmRecord[] = [
      harvest('h', 1, '2026-10-10'), // 다음 수확 11-14
      spray('a', 1, '2026-10-20', 3), // 벨 수 있는 날 10-23
    ]
    const status = getHouseStatus(records, 1, today)
    expect(status.kind).toBe('spray_wait')
    expect(status.daysLeft).toBe(2)
    expect(status.nextHarvestDate).toBe('2026-11-14')
  })

  it('약 대기가 끝났고 다음 수확 예정일 전이면 🟡 자라는 중', () => {
    const records: FarmRecord[] = [harvest('h', 1, '2026-10-01'), spray('a', 1, '2026-10-05', 7)]
    const status = getHouseStatus(records, 1, today)
    expect(status.kind).toBe('growing')
    expect(status.daysLeft).toBe(15) // 11-05까지
  })

  it('다음 수확 예정일 당일이면 🟢 수확 가능', () => {
    const records = [harvest('h', 1, '2026-09-16')] // 10-21
    expect(getHouseStatus(records, 1, today)).toEqual({
      kind: 'ready',
      daysLeft: null,
      sprayClearDate: null,
      nextHarvestDate: '2026-10-21',
    })
  })

  it('수확 기록 없이 약 기록만 있고 약 대기가 끝났으면 ⚪ 기록 없음', () => {
    const status = getHouseStatus([spray('a', 1, '2026-10-01', 7)], 1, today)
    expect(status.kind).toBe('no_record')
    expect(status.sprayClearDate).toBe('2026-10-08')
  })

  it('웃거름 기록만 있으면 ⚪ 기록 없음', () => {
    expect(getHouseStatus([topDressing('t', 1, '2026-10-20')], 1, today).kind).toBe('no_record')
  })

  it('수확 기록이 없어도 약 대기 중이면 🔴 약 대기', () => {
    expect(getHouseStatus([spray('a', 1, '2026-10-20', 7)], 1, today).kind).toBe('spray_wait')
  })

  it('약 기록을 취소하면 약 대기가 풀린다', () => {
    const records: FarmRecord[] = [
      harvest('h', 1, '2026-09-01'),
      spray('a', 1, '2026-10-20', 7),
      cancel('c', 1, 'a'),
    ]
    expect(getHouseStatus(records, 1, today).kind).toBe('ready')
  })

  it('모든 기록이 취소되면 ⚪ 기록 없음', () => {
    const records = [harvest('h', 1, '2026-10-01'), cancel('c', 1, 'h')]
    expect(getHouseStatus(records, 1, today).kind).toBe('no_record')
  })

  it('여러 동의 기록이 섞여 있어도 해당 동만 계산한다', () => {
    const records: FarmRecord[] = [
      spray('a', 2, '2026-10-20', 30), // 2번 동 약 대기
      harvest('h', 1, '2026-09-01'), // 1번 동 수확 가능
    ]
    expect(getHouseStatus(records, 1, today).kind).toBe('ready')
    expect(getHouseStatus(records, 2, today).kind).toBe('spray_wait')
  })

  it('수확 주기를 바꾸면 상태가 달라진다', () => {
    const records = [harvest('h', 1, '2026-09-21')] // 35일이면 10-26, 30일이면 10-21
    expect(getHouseStatus(records, 1, today).kind).toBe('growing')
    expect(getHouseStatus(records, 1, today, 30).kind).toBe('ready')
  })
})

// ---- 벨 수 있는 날 (정렬용) ----

describe('harvestableDate', () => {
  const today = '2026-10-21'

  it('약 기록이 없으면 다음 수확 예정일', () => {
    const status = getHouseStatus([harvest('h', 1, '2026-10-01')], 1, today)
    expect(harvestableDate(status)).toBe('2026-11-05')
  })

  it('약 때문에 벨 수 있는 날이 더 늦으면 그날', () => {
    const records = [harvest('h', 1, '2026-09-10'), spray('a', 1, '2026-10-18', 7)] // 수확 예정 10-15, 약 10-25
    expect(harvestableDate(getHouseStatus(records, 1, today))).toBe('2026-10-25')
  })

  it('다음 수확 예정일이 더 늦으면 그날', () => {
    const records = [harvest('h', 1, '2026-10-10'), spray('a', 1, '2026-10-18', 7)] // 수확 예정 11-14, 약 10-25
    expect(harvestableDate(getHouseStatus(records, 1, today))).toBe('2026-11-14')
  })

  it('수확 가능(🟢)이면 이미 지난 날짜가 나온다', () => {
    const status = getHouseStatus([harvest('h', 1, '2026-09-01')], 1, today)
    expect(status.kind).toBe('ready')
    expect(harvestableDate(status)).toBe('2026-10-06')
  })

  it('수확 기록이 없으면 약 기록이 있어도 null', () => {
    expect(harvestableDate(getHouseStatus([], 1, today))).toBeNull()
    expect(harvestableDate(getHouseStatus([spray('a', 1, '2026-10-18', 7)], 1, today))).toBeNull()
  })
})
