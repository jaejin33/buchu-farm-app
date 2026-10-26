// 여러 화면에서 같이 쓰는 표시용 글자.

import { daysBetween } from '../domain/harvestCalc'
import type { HouseProblem, Problem, Profile } from '../domain/types'

// 문제 표시. 아이콘만으로는 뜻을 알기 어려워 글자를 함께 쓴다
export const PROBLEM_TAG: Record<HouseProblem, { icon: string; label: string }> = {
  drainage: { icon: '💧', label: '배수 불량' },
  mycelium: { icon: '🍄', label: '균사 많음' },
}

/** 직접 적은 문제의 그림. 배수·균사처럼 그림 + 글자로 보여 준다 */
const OTHER_PROBLEM_ICON = '⚠️'

/** 문제를 그림과 글자로. 직접 적은 문제는 ⚠️ + 적은 이름 */
export function problemTag(p: Problem): { icon: string; label: string } {
  return p.kind === 'other' ? { icon: OTHER_PROBLEM_ICON, label: p.name } : PROBLEM_TAG[p.kind]
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** "2026-10-22" → "10월 22일 (목)" */
export function formatDate(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]
  return `${m}월 ${d}일 (${weekday})`
}

/** date가 오늘로부터 며칠 전인지 글자로: "오늘", "어제", "3일 전" */
export function relativeDay(date: string, today: string): string {
  const days = daysBetween(date, today)
  if (days === 0) return '오늘'
  if (days === 1) return '어제'
  return `${days}일 전`
}

/** time이 now로부터 얼마나 전인지 글자로: "방금", "5분 전", "3시간 전", "2일 전" (둘 다 ISO 문자열) */
export function relativeTime(time: string, now: string): string {
  // 폰 시각이 바뀌어 time이 now보다 늦어도 "방금"으로 보인다
  const minutes = Math.floor((Date.parse(now) - Date.parse(time)) / 60_000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

/** 입력한 사람의 이름. 이름 표에 없으면(아직 못 받았거나 Supabase에 안 넣음) "모르는 사람" */
export function nameOf(profiles: readonly Profile[], userId: string): string {
  return profiles.find((p) => p.id === userId)?.name ?? '모르는 사람'
}
