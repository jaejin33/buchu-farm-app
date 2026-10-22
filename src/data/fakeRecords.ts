// 2단계용 가짜 기록. 3단계에서 Dexie 저장을 붙이면 이 파일은 지운다.
// 언제 열어도 여러 상황이 골고루 보이도록, 날짜를 "오늘로부터 며칠 전"으로 만든다.
// id는 원래 UUID지만, crypto.randomUUID()는 http 주소(폰에서 PC 개발 서버 접속)에서 동작하지 않아 가짜 id를 쓴다.

import { DEFAULT_CYCLE_DAYS } from '../config/farm'
import { addDays } from '../domain/harvestCalc'
import type { FarmRecord } from '../domain/types'

export function makeFakeRecords(today: string): FarmRecord[] {
  let seq = 0

  /** daysAgo일 전에 houseNo 동에 한 기록의 공통 항목 */
  function base(houseNo: number, daysAgo: number) {
    seq += 1
    const work_date = addDays(today, -daysAgo)
    return {
      id: `fake-${seq}`,
      house_no: houseNo,
      work_date,
      memo: null,
      recorded_by: seq % 2 === 0 ? 'fake-father' : 'fake-brother',
      recorded_at: `${work_date}T09:00:00+09:00`,
    }
  }

  const harvest = (houseNo: number, daysAgo: number, cycleDays = DEFAULT_CYCLE_DAYS): FarmRecord => ({
    ...base(houseNo, daysAgo),
    type: 'harvest',
    cycle_days: cycleDays,
  })
  const harvestAmount = (target: FarmRecord, boxes: number, bunches: number): FarmRecord => ({
    ...base(target.house_no, 0),
    type: 'harvest_amount',
    target_id: target.id,
    boxes,
    bunches,
  })
  const spray = (houseNo: number, daysAgo: number): FarmRecord => ({
    ...base(houseNo, daysAgo),
    type: 'spray',
    pesticide: '가짜약',
  })
  const topDressing = (houseNo: number, daysAgo: number): FarmRecord => ({
    ...base(houseNo, daysAgo),
    type: 'top_dressing',
  })
  const fertigation = (houseNo: number, daysAgo: number): FarmRecord => ({
    ...base(houseNo, daysAgo),
    type: 'fertigation',
  })
  const cancel = (target: FarmRecord): FarmRecord => ({
    ...base(target.house_no, 0),
    type: 'cancel',
    target_id: target.id,
  })

  // 12번 동: 3일 전 수확을 잘못 입력했다가 취소함 → 37일 전 수확 기준으로 🟢
  const wrongHarvest = harvest(12, 3)
  // 5번 동: 어제 수확, 오늘 아침 수확량 입력
  const yesterdayHarvest = harvest(5, 1)

  // 오른쪽 주석은 화면에 나와야 하는 내용 (수확 가능까지 기본 35일)
  return [
    harvest(1, 40), // 🟢 수확 후 40일
    harvest(2, 36), // 🟢 수확 후 36일
    harvest(3, 33), // 수확 후 33일
    harvest(4, 20), // 수확 후 20일
    yesterdayHarvest, harvestAmount(yesterdayHarvest, 3, 5), // 수확 후 1일
    harvest(6, 38), spray(6, 2), // 🟢 수확 후 38일, 약 후 2일
    harvest(7, 30), spray(7, 0), // 수확 후 30일, 오늘 약
    // 8번 동: 기록 없음 ⚪
    harvest(9, 35), // 🟢 수확 후 35일 (오늘이 수확 가능일)
    harvest(10, 12), topDressing(10, 11), // 수확 후 12일
    spray(11, 3), // ⚪ 수확 기록 없음, 약 후 3일
    harvest(12, 37), wrongHarvest, cancel(wrongHarvest), // 🟢 수확 후 37일
    harvest(13, 28), fertigation(13, 10), // 수확 후 28일
    topDressing(14, 20), // ⚪ 수확 기록 없음 (웃거름만 있음)
    harvest(15, 45), spray(15, 10), // 🟢 수확 후 45일, 약 후 10일
    harvest(16, 0), // 오늘 수확
    harvest(17, 38, 40), // 수확 후 38일 (이 동은 40일로 적음 → 아직 🟢 아님)
    harvest(18, 25), spray(18, 5), // 수확 후 25일, 약 후 5일
    harvest(19, 39), // 🟢 수확 후 39일
    harvest(20, 15), // 수확 후 15일
    harvest(21, 36), spray(21, 1), // 🟢 수확 후 36일, 약 후 1일
    harvest(22, 8), // 수확 후 8일
    // 23번 동: 기록 없음 ⚪
    harvest(24, 31), // 수확 후 31일
    harvest(25, 42), // 🟢 수확 후 42일
  ]
}
