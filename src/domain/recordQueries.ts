// 기록 입력·이력 화면에 필요한 값을 기록에서 뽑는 순수 함수.
// 취소된 기록은 harvestCalc의 activeRecords로 걸러 낸 뒤 계산한다.

import { activeRecords, isLater } from './harvestCalc'
import type { AmountType, FarmRecord, FertilizerType, HarvestAmountRecord } from './types'

/** 약 목록. 취소되지 않은 약 기록의 약 이름을 모은다 (순서는 recentNames) */
export function pesticideNames(records: readonly FarmRecord[]): string[] {
  return recentNames(records, (r) => (r.type === 'spray' ? r.pesticide : null))
}

/**
 * 비료 목록. 취소되지 않은 비료(웃거름) 또는 관비 기록의 비료 이름을 모은다 (순서는 recentNames).
 * 비료(웃거름)와 관비는 따로 모은다. 뿌리는 비료와 물에 타는 비료가 한 목록에 섞이지 않게
 */
export function fertilizerNames(records: readonly FarmRecord[], type: FertilizerType): string[] {
  return recentNames(records, (r) =>
    (r.type === 'top_dressing' || r.type === 'fertigation') && r.type === type ? r.fertilizer : null,
  )
}

/**
 * 그 이름(약·비료)으로 마지막에 적은 양. 약·관비는 ml, 비료(웃거름)는 포.
 * 지난 이름을 고르면 이 양을 미리 채운다 (같은 약·비료는 보통 같은 양을 쓴다).
 * 취소되지 않은 type 기록 중 양을 적은 것만 본다 (모든 동). 없으면 null
 */
export function lastUsedAmount(records: readonly FarmRecord[], type: AmountType, name: string): number | null {
  let latest: FarmRecord | null = null
  let latestAmount: number | null = null
  for (const r of activeRecords(records)) {
    if (r.type !== type) continue
    const amount = amountOf(r)
    if (amount === null || nameOfAmount(r)?.trim() !== name.trim()) continue
    if (latest === null || isLater(r, latest)) {
      latest = r
      latestAmount = amount
    }
  }
  return latestAmount
}

/** 기록에 적은 양. 양을 적는 종류가 아니거나 안 적었으면 null */
function amountOf(r: FarmRecord): number | null {
  if (r.type === 'spray' || r.type === 'fertigation') return r.amount_ml ?? null
  if (r.type === 'top_dressing') return r.bags ?? null
  return null
}

/** 양을 적는 기록의 이름 (약 이름 또는 비료 이름) */
function nameOfAmount(r: FarmRecord): string | null | undefined {
  if (r.type === 'spray') return r.pesticide
  if (r.type === 'top_dressing' || r.type === 'fertigation') return r.fertilizer
  return null
}

/**
 * 직접 적은 문제 이름 목록. 취소되지 않은 문제 기록(모든 동, 해결된 것 포함)에서 모은다 (순서는 recentNames).
 * 문제 입력 화면에서 배수·균사 버튼 옆에 버튼으로 보여 준다
 */
export function problemNames(records: readonly FarmRecord[]): string[] {
  return recentNames(records, (r) => (r.type === 'problem' && r.problem === 'other' ? r.problem_name : null))
}

/**
 * 취소되지 않은 기록에서 nameOf로 뽑은 이름을 모은다.
 * 최근 기록의 이름이 앞에 오고, 같은 이름은 한 번만 나온다. 이름을 안 적은 기록은 건너뛴다
 */
function recentNames(
  records: readonly FarmRecord[],
  nameOf: (r: FarmRecord) => string | null | undefined,
): string[] {
  const names: { name: string; workDate: string; recordedAt: string }[] = []
  for (const r of activeRecords(records)) {
    const name = nameOf(r)?.trim()
    if (name) names.push({ name, workDate: r.work_date, recordedAt: r.recorded_at })
  }
  // 최근 순으로 줄 세운 뒤, 처음 나온 이름만 남긴다 (Set은 넣은 순서를 지킨다)
  names.sort((a, b) =>
    a.workDate !== b.workDate
      ? b.workDate.localeCompare(a.workDate)
      : Date.parse(b.recordedAt) - Date.parse(a.recordedAt),
  )
  return [...new Set(names.map((n) => n.name))]
}

/**
 * 수확 완료 기록(harvestId)에 붙은 수확량. 여러 번 입력했으면 가장 나중에 입력한 것.
 * 없거나, 수확 완료 기록이 취소됐으면 null
 */
export function latestHarvestAmount(records: readonly FarmRecord[], harvestId: string): HarvestAmountRecord | null {
  const active = activeRecords(records)
  if (!active.some((r) => r.type === 'harvest' && r.id === harvestId)) return null

  let latest: HarvestAmountRecord | null = null
  for (const r of active) {
    if (r.type !== 'harvest_amount' || r.target_id !== harvestId) continue
    if (latest === null || Date.parse(r.recorded_at) > Date.parse(latest.recorded_at)) latest = r
  }
  return latest
}

/**
 * 이력 화면에 보여줄 houseNo 동의 기록. 최근 기록이 앞 (작업 날짜가 늦은 순, 같은 날이면 나중에 입력한 순).
 * - 취소된 기록과 cancel 기록 자체는 뺀다 (화면에서는 취소된 기록을 숨긴다)
 * - 수확량은 수확마다 계산에 쓰는 것(가장 나중에 입력한 것) 하나만 남긴다. 수확 완료 기록이 취소됐으면 뺀다
 */
export function houseHistory(records: readonly FarmRecord[], houseNo: number): FarmRecord[] {
  return activeRecords(records)
    .filter((r) => r.house_no === houseNo)
    .filter((r) => r.type !== 'harvest_amount' || latestHarvestAmount(records, r.target_id)?.id === r.id)
    .sort((a, b) => (isLater(a, b) ? -1 : isLater(b, a) ? 1 : 0))
}
