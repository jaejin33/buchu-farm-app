// 여러 화면에서 같이 쓰는 표시용 글자.

import type { HouseProblem } from '../domain/types'

// 문제 표시. 아이콘만으로는 뜻을 알기 어려워 글자를 함께 쓴다
export const PROBLEM_TAG: Record<HouseProblem, { icon: string; label: string }> = {
  drainage: { icon: '💧', label: '배수 불량' },
  mycelium: { icon: '🍄', label: '균사 많음' },
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** "2026-10-22" → "10월 22일 (목)" */
export function formatDate(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]
  return `${m}월 ${d}일 (${weekday})`
}
