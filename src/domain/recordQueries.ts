// 기록 입력 화면에 필요한 값을 기록에서 뽑는 순수 함수.
// 취소된 기록은 harvestCalc의 activeRecords로 걸러 낸 뒤 계산한다.

import { activeRecords } from './harvestCalc'
import type { FarmRecord, HarvestAmountRecord } from './types'

/**
 * 약 목록. 취소되지 않은 약 기록의 약 이름을 모은다.
 * 최근에 친 약이 앞에 오고, 같은 이름은 한 번만 나온다. 이름을 안 적은 기록은 건너뛴다
 */
export function pesticideNames(records: readonly FarmRecord[]): string[] {
  const names: { name: string; workDate: string; recordedAt: string }[] = []
  for (const r of activeRecords(records)) {
    const name = r.type === 'spray' ? r.pesticide?.trim() : undefined
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
