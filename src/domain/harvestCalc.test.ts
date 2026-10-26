import { describe, expect, it } from 'vitest'
import { activeRecords, addDays, daysBetween, getHouseStatus, lastHarvestRecord, problemOf } from './harvestCalc'
import type {
  CancelRecord,
  FarmRecord,
  FertigationRecord,
  HarvestAmountRecord,
  HarvestRecord,
  HarvestStartRecord,
  HouseProblem,
  Problem,
  ProblemRecord,
  SprayRecord,
  TopDressingRecord,
} from './types'

// ---- 테스트용 기록 만들기 ----

const common = { memo: null, recorded_by: 'user-1', recorded_at: '2026-10-01T09:00:00+09:00' }

function spray(id: string, house_no: number, work_date: string): SprayRecord {
  return { ...common, id, house_no, work_date, type: 'spray', pesticide: '테스트약' }
}

function harvest(id: string, house_no: number, work_date: string, cycle_days = 35): HarvestRecord {
  return { ...common, id, house_no, work_date, type: 'harvest', cycle_days }
}

function harvestStart(id: string, house_no: number, work_date: string): HarvestStartRecord {
  return { ...common, id, house_no, work_date, type: 'harvest_start' }
}

function problem(
  id: string,
  house_no: number,
  work_date: string,
  kind: HouseProblem,
  resolved = false,
): ProblemRecord {
  return { ...common, id, house_no, work_date, type: 'problem', problem: kind, resolved }
}

/** 직접 적은 문제 (8단계) */
function otherProblem(id: string, house_no: number, work_date: string, name: string, resolved = false): ProblemRecord {
  return { ...common, id, house_no, work_date, type: 'problem', problem: 'other', problem_name: name, resolved }
}

const DRAINAGE: Problem = { kind: 'drainage' }
const MYCELIUM: Problem = { kind: 'mycelium' }

function harvestAmount(id: string, house_no: number, target_id: string): HarvestAmountRecord {
  return { ...common, id, house_no, work_date: '2026-10-21', type: 'harvest_amount', target_id, boxes: 3, bunches: 5 }
}

function topDressing(id: string, house_no: number, work_date: string): TopDressingRecord {
  return { ...common, id, house_no, work_date, type: 'top_dressing' }
}

function fertigation(id: string, house_no: number, work_date: string): FertigationRecord {
  return { ...common, id, house_no, work_date, type: 'fertigation' }
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
    const records = [spray('a', 1, '2026-10-01'), spray('b', 1, '2026-10-02'), cancel('c', 1, 'a')]
    expect(activeRecords(records).map((r) => r.id)).toEqual(['b'])
  })

  it('없는 기록을 가리키는 취소는 무시한다', () => {
    const records = [spray('a', 1, '2026-10-01'), cancel('c', 1, 'nothing')]
    expect(activeRecords(records).map((r) => r.id)).toEqual(['a'])
  })

  it('cancel을 취소하는 cancel은 무시한다: 원래 기록은 계속 취소된 상태다', () => {
    const records = [spray('a', 1, '2026-10-01'), cancel('c1', 1, 'a'), cancel('c2', 1, 'c1')]
    expect(activeRecords(records)).toEqual([])
  })

  it('같은 기록을 두 번 취소해도 문제없다', () => {
    const records = [spray('a', 1, '2026-10-01'), cancel('c1', 1, 'a'), cancel('c2', 1, 'a')]
    expect(activeRecords(records)).toEqual([])
  })
})

// ---- 하우스 상태 ----

describe('getHouseStatus', () => {
  const today = '2026-10-21'

  it('기록이 하나도 없으면 ⚪ 수확 기록 없음', () => {
    expect(getHouseStatus([], 1, today)).toEqual({
      kind: 'no_record',
      daysSinceHarvestStart: null,
      daysSinceHarvest: null,
      daysSinceSpray: null,
      readyDate: null,
      problems: [],
    })
  })

  it('약·웃거름·관비 기록만 있으면 ⚪ 수확 기록 없음, 약 후 일수는 센다', () => {
    const records: FarmRecord[] = [
      spray('a', 1, '2026-10-18'),
      topDressing('t', 1, '2026-10-10'),
      fertigation('f', 1, '2026-10-12'),
    ]
    expect(getHouseStatus(records, 1, today)).toEqual({
      kind: 'no_record',
      daysSinceHarvestStart: null,
      daysSinceHarvest: null,
      daysSinceSpray: 3,
      readyDate: null,
      problems: [],
    })
  })

  it('수확 가능일 전이면 자라는 중, 수확 후 일수와 수확 가능일', () => {
    expect(getHouseStatus([harvest('h', 1, '2026-10-01')], 1, today)).toEqual({
      kind: 'growing',
      daysSinceHarvestStart: null,
      daysSinceHarvest: 20,
      daysSinceSpray: null,
      readyDate: '2026-11-05',
      problems: [],
    })
  })

  it('수확 가능일 당일이면 🟢 수확 가능', () => {
    const status = getHouseStatus([harvest('h', 1, '2026-09-16')], 1, today) // 09-16 + 35일 = 10-21
    expect(status.kind).toBe('ready')
    expect(status.daysSinceHarvest).toBe(35)
  })

  it('수확 가능일 하루 전이면 아직 자라는 중', () => {
    expect(getHouseStatus([harvest('h', 1, '2026-09-17')], 1, today).kind).toBe('growing') // 10-22
  })

  it('수확 가능일이 지나면 🟢 수확 가능', () => {
    expect(getHouseStatus([harvest('h', 1, '2026-09-01')], 1, today).kind).toBe('ready')
  })

  it('기본값이 아니라 그 수확 기록에 적힌 일수를 쓴다', () => {
    const status = getHouseStatus([harvest('h', 1, '2026-09-16', 40)], 1, today) // 40일이면 10-26
    expect(status.kind).toBe('growing')
    expect(status.readyDate).toBe('2026-10-26')
  })

  it('오늘 수확하면 수확 후 0일', () => {
    expect(getHouseStatus([harvest('h', 1, today)], 1, today).daysSinceHarvest).toBe(0)
  })

  it('오늘 약을 치면 약 후 0일', () => {
    expect(getHouseStatus([spray('a', 1, today)], 1, today).daysSinceSpray).toBe(0)
  })

  it('약을 쳐도 수확 가능 판단은 바뀌지 않는다 (앱은 약 때문에 벨 수 있는지 판단하지 않는다)', () => {
    const records: FarmRecord[] = [harvest('h', 1, '2026-09-01'), spray('a', 1, '2026-10-20')]
    const status = getHouseStatus(records, 1, today)
    expect(status.kind).toBe('ready')
    expect(status.daysSinceSpray).toBe(1)
  })

  it('약을 여러 번 쳤으면 마지막으로 친 날부터 센다', () => {
    const records = [spray('a', 1, '2026-10-01'), spray('b', 1, '2026-10-15'), spray('c', 1, '2026-10-05')]
    expect(getHouseStatus(records, 1, today).daysSinceSpray).toBe(6)
  })

  it('입력 순서와 상관없이 가장 늦은 수확 기록을 쓴다', () => {
    const records = [harvest('h2', 1, '2026-09-10', 30), harvest('h1', 1, '2026-08-01', 50)]
    const status = getHouseStatus(records, 1, today)
    expect(status.daysSinceHarvest).toBe(41)
    expect(status.readyDate).toBe('2026-10-10') // h2의 30일을 쓴다
  })

  it('같은 날 수확 기록이 둘이면 나중에 입력한 기록의 일수를 쓴다', () => {
    const early = { ...harvest('h1', 1, '2026-10-01', 30), recorded_at: '2026-10-01T09:00:00+09:00' }
    const late = { ...harvest('h2', 1, '2026-10-01', 40), recorded_at: '2026-10-01T18:00:00+09:00' }
    expect(getHouseStatus([late, early], 1, today).readyDate).toBe('2026-11-10')
  })

  it('입력 시각을 비교할 때 시간대 표기가 달라도 같은 순간으로 본다', () => {
    // 09:00Z는 한국 시간 18:00이므로 h1이 나중에 입력한 기록이다
    const h1 = { ...harvest('h1', 1, '2026-10-01', 30), recorded_at: '2026-10-01T09:00:00Z' }
    const h2 = { ...harvest('h2', 1, '2026-10-01', 40), recorded_at: '2026-10-01T10:00:00+09:00' }
    expect(getHouseStatus([h1, h2], 1, today).readyDate).toBe('2026-10-31')
  })

  it('마지막 수확 기록이 취소되면 그 전 수확 기록을 쓴다', () => {
    const records = [harvest('h1', 1, '2026-08-01'), harvest('h2', 1, '2026-10-10'), cancel('c', 1, 'h2')]
    const status = getHouseStatus(records, 1, today)
    expect(status.kind).toBe('ready')
    expect(status.daysSinceHarvest).toBe(81)
  })

  it('모든 수확 기록이 취소되면 ⚪ 수확 기록 없음', () => {
    const records = [harvest('h', 1, '2026-10-01'), cancel('c', 1, 'h')]
    expect(getHouseStatus(records, 1, today).kind).toBe('no_record')
  })

  it('약 기록을 취소하면 그 전 약부터 센다', () => {
    const records = [spray('a', 1, '2026-10-01'), spray('b', 1, '2026-10-20'), cancel('c', 1, 'b')]
    expect(getHouseStatus(records, 1, today).daysSinceSpray).toBe(20)
  })

  it('수확량 기록은 상태에 영향을 주지 않는다', () => {
    const records: FarmRecord[] = [harvest('h', 1, '2026-10-01'), harvestAmount('m', 1, 'h')]
    expect(getHouseStatus(records, 1, today)).toEqual(getHouseStatus([harvest('h', 1, '2026-10-01')], 1, today))
  })

  it('여러 동의 기록이 섞여 있어도 해당 동만 계산한다', () => {
    const records: FarmRecord[] = [
      harvest('h2', 2, '2026-10-20'),
      spray('a2', 2, '2026-10-21'),
      harvest('h1', 1, '2026-09-01'),
    ]
    expect(getHouseStatus(records, 1, today)).toEqual({
      kind: 'ready',
      daysSinceHarvestStart: null,
      daysSinceHarvest: 50,
      daysSinceSpray: null,
      readyDate: '2026-10-06',
      problems: [],
    })
    expect(getHouseStatus(records, 2, today).kind).toBe('growing')
  })
})

// ---- 수확 중 ----

describe('getHouseStatus: 수확 중', () => {
  const today = '2026-10-21'

  it('수확 시작만 있고 완료가 없으면 수확 중, 시작한 날은 시작 후 0일', () => {
    expect(getHouseStatus([harvestStart('s', 1, today)], 1, today)).toEqual({
      kind: 'harvesting',
      daysSinceHarvestStart: 0,
      daysSinceHarvest: null,
      daysSinceSpray: null,
      readyDate: null,
      problems: [],
    })
  })

  it('시작 다음 날이면 시작 후 1일', () => {
    expect(getHouseStatus([harvestStart('s', 1, '2026-10-20')], 1, today).daysSinceHarvestStart).toBe(1)
  })

  it('수확 중이어도 지난 수확 완료 기준 일수와 약 후 일수는 그대로 센다', () => {
    const records: FarmRecord[] = [
      harvest('h1', 1, '2026-09-10'),
      spray('a', 1, '2026-10-18'),
      harvestStart('s', 1, '2026-10-20'),
    ]
    expect(getHouseStatus(records, 1, today)).toEqual({
      kind: 'harvesting',
      daysSinceHarvestStart: 1,
      daysSinceHarvest: 41,
      daysSinceSpray: 3,
      readyDate: '2026-10-15',
      problems: [],
    })
  })

  it('시작 후 완료하면 수확 중이 끝나고, 완료한 날부터 센다', () => {
    const records = [harvestStart('s', 1, '2026-10-19'), harvest('h', 1, '2026-10-20')]
    const status = getHouseStatus(records, 1, today)
    expect(status.kind).toBe('growing')
    expect(status.daysSinceHarvestStart).toBeNull()
    expect(status.daysSinceHarvest).toBe(1)
    expect(status.readyDate).toBe('2026-11-24') // 10-20 + 35일
  })

  it('같은 날 시작하고 완료하면 (완료를 나중에 입력) 수확 중이 아니다', () => {
    const s = { ...harvestStart('s', 1, today), recorded_at: '2026-10-21T08:00:00+09:00' }
    const h = { ...harvest('h', 1, today), recorded_at: '2026-10-21T17:00:00+09:00' }
    expect(getHouseStatus([h, s], 1, today).kind).toBe('growing')
  })

  it('시작 없이 완료만 눌러도 된다 (하루에 끝난 수확)', () => {
    const status = getHouseStatus([harvest('h', 1, today)], 1, today)
    expect(status.kind).toBe('growing')
    expect(status.daysSinceHarvest).toBe(0)
  })

  it('지난 수확을 완료한 뒤 새로 시작하면 다시 수확 중', () => {
    const records = [harvestStart('s1', 1, '2026-09-09'), harvest('h1', 1, '2026-09-10'), harvestStart('s2', 1, today)]
    expect(getHouseStatus(records, 1, today).kind).toBe('harvesting')
  })

  it('수확 시작 기록을 취소하면 수확 중이 아니다', () => {
    const records = [harvest('h1', 1, '2026-09-01'), harvestStart('s', 1, today), cancel('c', 1, 's')]
    expect(getHouseStatus(records, 1, today).kind).toBe('ready')
  })

  it('다른 동의 수확 시작은 보지 않는다', () => {
    const records = [harvest('h1', 1, '2026-09-01'), harvestStart('s', 2, today)]
    expect(getHouseStatus(records, 1, today).kind).toBe('ready')
    expect(getHouseStatus(records, 2, today).kind).toBe('harvesting')
  })
})

// ---- 하우스 문제 ----

describe('getHouseStatus: 문제', () => {
  const today = '2026-10-21'
  const problemsOf = (records: FarmRecord[], houseNo = 1) => getHouseStatus(records, houseNo, today).problems

  it('문제 기록이 없으면 이상 없음 (빈 배열)', () => {
    expect(problemsOf([harvest('h', 1, '2026-10-01')])).toEqual([])
  })

  it('"생김" 기록이 있으면 그 문제가 있다', () => {
    expect(problemsOf([problem('p', 1, '2026-10-01', 'drainage')])).toEqual([DRAINAGE])
  })

  it('생긴 뒤 "해결됨" 기록이 있으면 없어진다', () => {
    const records = [problem('p1', 1, '2026-09-01', 'drainage'), problem('p2', 1, '2026-10-10', 'drainage', true)]
    expect(problemsOf(records)).toEqual([])
  })

  it('해결된 뒤 다시 생기면 다시 있다', () => {
    const records = [
      problem('p1', 1, '2026-09-01', 'drainage'),
      problem('p2', 1, '2026-09-20', 'drainage', true),
      problem('p3', 1, '2026-10-10', 'drainage'),
    ]
    expect(problemsOf(records)).toEqual([DRAINAGE])
  })

  it('두 문제는 따로 판단하고, 입력 순서와 상관없이 배수 → 균사 순서로 준다', () => {
    const records = [
      problem('m', 1, '2026-10-01', 'mycelium'),
      problem('d1', 1, '2026-09-01', 'drainage'),
      problem('d2', 1, '2026-10-05', 'drainage', true), // 배수만 해결
      problem('d3', 1, '2026-10-15', 'drainage'), // 배수 다시 생김
    ]
    expect(problemsOf(records)).toEqual([DRAINAGE, MYCELIUM])
  })

  it('한 문제가 해결돼도 다른 문제는 남는다', () => {
    const records = [
      problem('d', 1, '2026-09-01', 'drainage'),
      problem('m', 1, '2026-09-01', 'mycelium'),
      problem('m2', 1, '2026-10-01', 'mycelium', true),
    ]
    expect(problemsOf(records)).toEqual([DRAINAGE])
  })

  it('"생김" 기록을 취소하면 없어진다', () => {
    expect(problemsOf([problem('p', 1, '2026-10-01', 'drainage'), cancel('c', 1, 'p')])).toEqual([])
  })

  it('"해결됨" 기록을 취소하면 다시 있다', () => {
    const records = [
      problem('p1', 1, '2026-09-01', 'drainage'),
      problem('p2', 1, '2026-10-10', 'drainage', true),
      cancel('c', 1, 'p2'),
    ]
    expect(problemsOf(records)).toEqual([DRAINAGE])
  })

  it('같은 날 생김·해결됨이 둘 다 있으면 나중에 입력한 쪽을 따른다', () => {
    const found = { ...problem('p1', 1, today, 'drainage'), recorded_at: '2026-10-21T08:00:00+09:00' }
    const fixed = { ...problem('p2', 1, today, 'drainage', true), recorded_at: '2026-10-21T17:00:00+09:00' }
    expect(problemsOf([fixed, found])).toEqual([])
  })

  it('다른 동의 문제는 보지 않는다', () => {
    const records = [problem('p', 2, '2026-10-01', 'mycelium')]
    expect(problemsOf(records, 1)).toEqual([])
    expect(problemsOf(records, 2)).toEqual([MYCELIUM])
  })

  it('문제는 수확 상태에 영향을 주지 않는다', () => {
    const records: FarmRecord[] = [harvest('h', 1, '2026-09-01'), problem('p', 1, '2026-10-01', 'drainage')]
    expect(getHouseStatus(records, 1, today).kind).toBe('ready')
  })
})

describe('getHouseStatus: 직접 적은 문제 (8단계)', () => {
  const today = '2026-10-21'
  const problemsOf = (records: FarmRecord[], houseNo = 1) => getHouseStatus(records, houseNo, today).problems

  it('"생김"이면 있고, 같은 이름의 "해결됨"이 나중이면 없어진다', () => {
    expect(problemsOf([otherProblem('a', 1, '2026-10-01', '진딧물')])).toEqual([{ kind: 'other', name: '진딧물' }])
    const records = [otherProblem('a', 1, '2026-10-01', '진딧물'), otherProblem('b', 1, '2026-10-05', '진딧물', true)]
    expect(problemsOf(records)).toEqual([])
  })

  it('이름이 다르면 다른 문제다', () => {
    const records = [otherProblem('a', 1, '2026-10-01', '진딧물'), otherProblem('b', 1, '2026-10-05', '잎마름', true)]
    expect(problemsOf(records)).toEqual([{ kind: 'other', name: '진딧물' }])
  })

  it('앞뒤 빈칸은 떼고 같은 이름으로 본다', () => {
    const records = [otherProblem('a', 1, '2026-10-01', ' 진딧물'), otherProblem('b', 1, '2026-10-05', '진딧물 ', true)]
    expect(problemsOf(records)).toEqual([])
  })

  it('배수·균사가 먼저, 직접 적은 문제는 처음 기록된 순서로 (다시 생겨도 자리는 그대로)', () => {
    const records = [
      otherProblem('a1', 1, '2026-09-01', '진딧물'),
      otherProblem('b', 1, '2026-09-10', '잎마름'),
      otherProblem('a2', 1, '2026-09-20', '진딧물', true),
      otherProblem('a3', 1, '2026-10-01', '진딧물'), // 진딧물이 다시 생김
      problem('m', 1, '2026-10-05', 'mycelium'),
    ]
    expect(problemsOf(records)).toEqual([MYCELIUM, { kind: 'other', name: '진딧물' }, { kind: 'other', name: '잎마름' }])
  })

  it('취소된 기록과 이름이 빈 기록은 무시한다', () => {
    const records: FarmRecord[] = [
      otherProblem('a', 1, '2026-10-01', '진딧물'),
      cancel('c', 1, 'a'),
      otherProblem('b', 1, '2026-10-02', '  '),
    ]
    expect(problemsOf(records)).toEqual([])
  })
})

describe('problemOf', () => {
  it('배수·균사는 종류만, 직접 적은 문제는 이름(앞뒤 빈칸 뗌)까지', () => {
    expect(problemOf(problem('p', 1, '2026-10-01', 'drainage'))).toEqual(DRAINAGE)
    expect(problemOf(otherProblem('o', 1, '2026-10-01', ' 진딧물 '))).toEqual({ kind: 'other', name: '진딧물' })
  })

  it('직접 적은 문제인데 이름이 비었거나 없으면 null', () => {
    expect(problemOf(otherProblem('o', 1, '2026-10-01', ''))).toBeNull()
    expect(problemOf({ ...otherProblem('o', 1, '2026-10-01', 'x'), problem_name: null })).toBeNull()
  })
})

// ---- 마지막 수확 완료 기록 (수확량 입력에 씀) ----

describe('lastHarvestRecord', () => {
  it('그 동의 마지막 수확 완료 기록을 돌려준다', () => {
    const records: FarmRecord[] = [
      harvest('h1', 1, '2026-09-01'),
      harvest('h2', 1, '2026-10-10'),
      harvest('other', 2, '2026-10-20'),
      harvestStart('s', 1, '2026-10-21'),
    ]
    expect(lastHarvestRecord(records, 1)?.id).toBe('h2')
  })

  it('취소된 수확은 건너뛴다', () => {
    const records = [harvest('h1', 1, '2026-09-01'), harvest('h2', 1, '2026-10-10'), cancel('c', 1, 'h2')]
    expect(lastHarvestRecord(records, 1)?.id).toBe('h1')
  })

  it('수확 완료 기록이 없으면 null', () => {
    expect(lastHarvestRecord([harvestStart('s', 1, '2026-10-21')], 1)).toBeNull()
  })
})
