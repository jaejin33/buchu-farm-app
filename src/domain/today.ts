// 한국 시간(UTC+9) 기준 "오늘" 날짜. 앱에서 현재 시각을 읽는 곳은 여기 한 곳으로 모은다.
// 계산 함수(harvestCalc)에는 이 값을 인자로 넘긴다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 지금 시각 (ISO 문자열, UTC). 기록의 recorded_at(입력한 시각)에 쓴다 */
export function nowTimestamp(now: Date = new Date()): string {
  return now.toISOString()
}

/** 한국 시간 기준 오늘 ("YYYY-MM-DD"). 폰의 시간대 설정과 상관없이 같은 값이 나온다 */
export function todayInKorea(now: Date = new Date()): string {
  // UTC 시각에 9시간을 더한 뒤 UTC 날짜를 읽으면 한국 날짜가 된다
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}
