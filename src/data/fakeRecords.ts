// 2단계용 가짜 기록. 3단계에서 Dexie 저장을 붙이면 이 파일은 지운다.
// 언제 열어도 네 가지 상태가 골고루 보이도록, 날짜를 "오늘로부터 며칠 전"으로 만든다.
// id는 원래 UUID지만, crypto.randomUUID()는 http 주소(폰에서 PC 개발 서버 접속)에서 동작하지 않아 가짜 id를 쓴다.

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

  const harvest = (houseNo: number, daysAgo: number): FarmRecord => ({
    ...base(houseNo, daysAgo),
    type: 'harvest',
    amount: null,
    amount_unit: null,
  })
  const spray = (houseNo: number, daysAgo: number, phiDays: number): FarmRecord => ({
    ...base(houseNo, daysAgo),
    type: 'spray',
    pesticide: '가짜약',
    phi_days: phiDays,
  })
  const topDressing = (houseNo: number, daysAgo: number): FarmRecord => ({
    ...base(houseNo, daysAgo),
    type: 'top_dressing',
  })
  const fertigation = (houseNo: number, daysAgo: number): FarmRecord => ({
    ...base(houseNo, daysAgo),
    type: 'fertigation',
  })
  const cancel = (houseNo: number, target: FarmRecord): FarmRecord => ({
    ...base(houseNo, 0),
    type: 'cancel',
    target_id: target.id,
  })

  // 12번 동: 3일 전 수확을 잘못 입력했다가 취소함 → 37일 전 수확 기준으로 🟢
  const wrongHarvest = harvest(12, 3)

  // 수확 주기 35일 기준. 오른쪽 주석은 화면에 나와야 하는 상태
  return [
    harvest(1, 40), // 🟢
    harvest(2, 36), // 🟢
    harvest(3, 33), // 🟡 D-2
    harvest(4, 20), // 🟡 D-15
    harvest(5, 5), // 🟡 D-30
    harvest(6, 38), spray(6, 2, 7), // 🔴 D-5
    harvest(7, 30), spray(7, 1, 14), // 🔴 D-13
    // 8번 동: 기록 없음 ⚪
    harvest(9, 35), // 🟢 (오늘이 예정일)
    harvest(10, 12), topDressing(10, 11), // 🟡 D-23
    spray(11, 3, 7), // 🔴 D-4 (수확 기록은 없음)
    harvest(12, 37), wrongHarvest, cancel(12, wrongHarvest), // 🟢
    harvest(13, 28), fertigation(13, 10), // 🟡 D-7
    topDressing(14, 20), // ⚪ (웃거름만 있음)
    harvest(15, 45), spray(15, 10, 7), // 🟢 (약 대기 끝남)
    harvest(16, 1), // 🟡 D-34
    harvest(17, 34), // 🟡 D-1
    harvest(18, 25), // 🟡 D-10
    harvest(19, 39), // 🟢
    harvest(20, 15), // 🟡 D-20
    harvest(21, 36), spray(21, 5, 6), // 🔴 D-1
    harvest(22, 8), // 🟡 D-27
    // 23번 동: 기록 없음 ⚪
    harvest(24, 31), // 🟡 D-4
    harvest(25, 42), // 🟢
  ]
}
