// 수확 가능일 계산. 안전과 관련된 계산이라 순수 함수로만 만들고 모두 테스트한다.
// "오늘"은 항상 인자로 받는다. 이 파일 안에서는 현재 시각을 읽지 않는다.

import type { FarmRecord, HarvestRecord, SprayRecord } from './types'

/** 수확 주기 기본값 (미확정: 고정 35일인지, 동마다 다른지 확인 필요) */
export const DEFAULT_HARVEST_CYCLE_DAYS = 35

export type HouseStatusKind =
  | 'spray_wait' // 🔴 약 대기
  | 'growing' // 🟡 자라는 중
  | 'ready' // 🟢 수확 가능
  | 'no_record' // ⚪ 기록 없음

export interface HouseStatus {
  kind: HouseStatusKind
  /** D-n의 n. 약 대기·자라는 중일 때만 값이 있다 */
  daysLeft: number | null
  /** 약 때문에 벨 수 있는 날. 약 기록이 없으면 null */
  sprayClearDate: string | null
  /** 다음 수확 예정일. 수확 기록이 없으면 null */
  nextHarvestDate: string | null
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

// ---- 수확 가능일 ----
// 날짜가 "YYYY-MM-DD" 형식이라 문자열 크기 비교가 곧 날짜 비교다 ("2026-10-09" < "2026-10-21").

/** 약 때문에 벨 수 있는 날 = 살아 있는 spray 기록 중 (살포일 + phi_days)가 가장 늦은 날 */
export function sprayClearDate(records: readonly FarmRecord[], houseNo: number): string | null {
  const sprays = activeRecords(records).filter(
    (r): r is SprayRecord => r.type === 'spray' && r.house_no === houseNo,
  )
  let latest: string | null = null
  for (const s of sprays) {
    const clear = addDays(s.work_date, s.phi_days)
    if (latest === null || clear > latest) latest = clear
  }
  return latest
}

/** 다음 수확 예정일 = 마지막 harvest 기록일 + 수확 주기 일수 */
export function nextHarvestDate(
  records: readonly FarmRecord[],
  houseNo: number,
  cycleDays: number = DEFAULT_HARVEST_CYCLE_DAYS,
): string | null {
  const harvests = activeRecords(records).filter(
    (r): r is HarvestRecord => r.type === 'harvest' && r.house_no === houseNo,
  )
  let last: string | null = null
  for (const h of harvests) {
    if (last === null || h.work_date > last) last = h.work_date
  }
  return last === null ? null : addDays(last, cycleDays)
}

// ---- 하우스 상태 ----

/**
 * 하우스 상태를 우선순위대로 정한다.
 * 1. 🔴 약 대기: 오늘 < 약 때문에 벨 수 있는 날
 * 2. 🟡 자라는 중: 오늘 < 다음 수확 예정일
 * 3. 🟢 수확 가능: 마지막 수확 후 주기가 지났고 약 대기도 아님
 * 4. ⚪ 기록 없음: 수확 기록이 없어 자랐는지 판단할 수 없음 (약·비료 기록만 있어도 여기에 해당)
 *
 * records에는 모든 동의 기록을 넣어도 된다. houseNo 동의 기록만 골라 계산한다.
 */
export function getHouseStatus(
  records: readonly FarmRecord[],
  houseNo: number,
  today: string,
  cycleDays: number = DEFAULT_HARVEST_CYCLE_DAYS,
): HouseStatus {
  const clear = sprayClearDate(records, houseNo)
  const next = nextHarvestDate(records, houseNo, cycleDays)
  const base = { sprayClearDate: clear, nextHarvestDate: next }

  if (clear !== null && today < clear) {
    return { kind: 'spray_wait', daysLeft: daysBetween(today, clear), ...base }
  }
  if (next === null) {
    return { kind: 'no_record', daysLeft: null, ...base }
  }
  if (today < next) {
    return { kind: 'growing', daysLeft: daysBetween(today, next), ...base }
  }
  return { kind: 'ready', daysLeft: null, ...base }
}

/**
 * 벨 수 있는 날 = 약 때문에 벨 수 있는 날과 다음 수확 예정일 중 늦은 날. 하우스 목록 정렬에 쓴다.
 * 수확 기록이 없으면 자랐는지 알 수 없으므로 null이다 (약 기록이 있어도 마찬가지).
 * 이미 지난 날짜일 수 있다 (🟢 수확 가능).
 */
export function harvestableDate(status: HouseStatus): string | null {
  const { sprayClearDate: clear, nextHarvestDate: next } = status
  if (next === null) return null
  if (clear !== null && clear > next) return clear
  return next
}
