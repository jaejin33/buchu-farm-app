import { describe, expect, it } from 'vitest'
import { formatBags, problemTag, relativeTime } from './labels'

describe('formatBags', () => {
  it('0.5포는 "반 포", 나머지는 숫자 그대로', () => {
    expect(formatBags(0.5)).toBe('반 포')
    expect(formatBags(1)).toBe('1포')
    expect(formatBags(1.5)).toBe('1.5포')
  })
})

describe('relativeTime', () => {
  const now = '2026-10-25T03:00:00.000Z'

  it('1분이 안 됐으면 "방금"', () => {
    expect(relativeTime('2026-10-25T02:59:01.000Z', now)).toBe('방금')
  })

  it('1시간이 안 됐으면 분으로 (모자란 분은 버린다)', () => {
    expect(relativeTime('2026-10-25T02:59:00.000Z', now)).toBe('1분 전')
    expect(relativeTime('2026-10-25T02:00:01.000Z', now)).toBe('59분 전')
  })

  it('하루가 안 됐으면 시간으로', () => {
    expect(relativeTime('2026-10-25T02:00:00.000Z', now)).toBe('1시간 전')
    expect(relativeTime('2026-10-24T03:00:01.000Z', now)).toBe('23시간 전')
  })

  it('하루가 넘으면 일로', () => {
    expect(relativeTime('2026-10-24T03:00:00.000Z', now)).toBe('1일 전')
    expect(relativeTime('2026-10-20T03:00:00.000Z', now)).toBe('5일 전')
  })

  it('폰 시각이 바뀌어 지금보다 늦은 시각이어도 "방금"', () => {
    expect(relativeTime('2026-10-25T04:00:00.000Z', now)).toBe('방금')
  })
})

describe('problemTag', () => {
  it('배수·균사는 정해 둔 그림과 글자', () => {
    expect(problemTag({ kind: 'drainage' })).toEqual({ icon: '💧', label: '배수 불량' })
  })

  it('직접 적은 문제는 ⚠️ + 적은 이름', () => {
    expect(problemTag({ kind: 'other', name: '진딧물' })).toEqual({ icon: '⚠️', label: '진딧물' })
  })
})
