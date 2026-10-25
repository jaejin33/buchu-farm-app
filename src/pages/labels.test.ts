import { describe, expect, it } from 'vitest'
import { relativeTime } from './labels'

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
