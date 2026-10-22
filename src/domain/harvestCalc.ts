// 경과 일수와 수확 가능 계산. 순수 함수로만 만들고 모두 테스트한다.
// "오늘"은 항상 인자로 받는다. 이 파일 안에서는 현재 시각을 읽지 않는다.
// 앱은 약 때문에 벨 수 있는지 판단하지 않는다 (예외가 많아 사람이 판단한다). 며칠 지났는지만 센다.

import type { FarmRecord, HarvestRecord, SprayRecord } from './types'

export type HouseStatusKind =
  | 'ready' // 🟢 수확 가능
  | 'growing' // 자라는 중. 따로 표시하지 않고 경과 일수만 보여준다
  | 'no_record' // ⚪ 수확 기록 없음

export interface HouseStatus {
  kind: HouseStatusKind
  /** 마지막 수확 후 며칠. 당일은 0. 수확 기록이 없으면 null */
  daysSinceHarvest: number | null
  /** 마지막 약 후 며칠. 당일은 0. 약 기록이 없으면 null */
  daysSinceSpray: number | null
  /** 수확 가능일 = 마지막 수확일 + 그 기록의 cycle_days. 수확 기록이 없으면 null. 목록 정렬에 쓴다 */
  readyDate: string | null
}

// ---- 날짜 계산 ----
// "YYYY-MM-DD" 문자열을 "1970-01-01부터 며칠째"인 정수로 바꿔 더하고 뺀다.
// UTC 기준으로만 계산하므로 폰의 시간대 설정에 영향을 받지 않는다.

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function toDayNumber(date: string): number {
  const match = DATE_PATTERN.exec(date)
  if (!match) throw new Error(`날짜 형식이 아닙니다: ${date}`)
  const [, y, m, d] = match
  const dayNumber = Date.UTC(Number(y), Number(m) - 1, Number(d)) / MS_PER_DAY
  // 2026-02-30 같은 없는 날짜는 Date.UTC가 3월로 넘겨 버리므로, 되돌려서 같은지 확인한다
  if (fromDayNumber(dayNumber) !== date) throw new Error(`없는 날짜입니다: ${date}`)
  return dayNumber
}

function fromDayNumber(dayNumber: number): string {
  return new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10)
}

/** date에 days일을 더한 날짜 */
export function addDays(date: string, days: number): string {
  return fromDayNumber(toDayNumber(date) + days)
}

/** from에서 to까지 며칠인지 (to가 더 늦으면 양수) */
export function daysBetween(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from)
}

// ---- 기록 정리 ----

/**
 * 취소된 기록과 cancel 기록 자체를 뺀 "살아 있는" 기록만 돌려준다.
 * - cancel 기록은 취소할 수 없다: cancel을 가리키는 cancel은 무시한다
 * - target_id가 없는 기록을 가리키면 무시한다
 */
export function activeRecords(records: readonly FarmRecord[]): FarmRecord[] {
  const cancelIds = new Set(records.filter((r) => r.type === 'cancel').map((r) => r.id))
  // cancel이 아닌 기록을 가리키는 취소만 유효하다 (없는 id를 가리키는 취소는 아무것도 지우지 않으므로 자연히 무시된다)
  const canceledIds = new Set(
    records
      .filter((r) => r.type === 'cancel')
      .map((r) => r.target_id)
      .filter((targetId) => !cancelIds.has(targetId)),
  )
  return records.filter((r) => r.type !== 'cancel' && !canceledIds.has(r.id))
}

// ---- 마지막 기록 ----

/** a가 b보다 나중 기록인가. 작업 날짜가 늦은 쪽, 같은 날이면 나중에 입력한 쪽 */
function isLater(a: FarmRecord, b: FarmRecord): boolean {
  if (a.work_date !== b.work_date) return a.work_date > b.work_date
  return Date.parse(a.recorded_at) > Date.parse(b.recorded_at)
}

/** 살아 있는 기록 중 isTarget에 맞는 마지막 기록. 없으면 null */
function lastOf<T extends FarmRecord>(
  records: readonly FarmRecord[],
  isTarget: (r: FarmRecord) => r is T,
): T | null {
  let last: T | null = null
  for (const r of activeRecords(records)) {
    if (isTarget(r) && (last === null || isLater(r, last))) last = r
  }
  return last
}

// ---- 하우스 상태 ----

/**
 * 하우스 상태와 경과 일수.
 * - 🟢 수확 가능: 오늘 ≥ 마지막 수확일 + 그 기록의 cycle_days
 * - 자라는 중: 아직 수확 가능일 전
 * - ⚪ 수확 기록 없음: 자랐는지 판단할 근거가 없음 (약·비료 기록만 있어도 여기에 해당)
 * 약 기록은 상태에 영향을 주지 않고 경과 일수만 센다.
 *
 * records에는 모든 동의 기록을 넣어도 된다. houseNo 동의 기록만 골라 계산한다.
 */
export function getHouseStatus(records: readonly FarmRecord[], houseNo: number, today: string): HouseStatus {
  const harvest = lastOf(records, (r): r is HarvestRecord => r.type === 'harvest' && r.house_no === houseNo)
  const spray = lastOf(records, (r): r is SprayRecord => r.type === 'spray' && r.house_no === houseNo)
  const daysSinceSpray = spray === null ? null : daysBetween(spray.work_date, today)

  if (harvest === null) {
    return { kind: 'no_record', daysSinceHarvest: null, daysSinceSpray, readyDate: null }
  }
  const readyDate = addDays(harvest.work_date, harvest.cycle_days)
  return {
    kind: today >= readyDate ? 'ready' : 'growing',
    daysSinceHarvest: daysBetween(harvest.work_date, today),
    daysSinceSpray,
    readyDate,
  }
}
