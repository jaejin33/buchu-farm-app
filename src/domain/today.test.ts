import { describe, expect, it } from 'vitest'
import { todayInKorea } from './today'

describe('todayInKorea', () => {
  it('UTC 15시(한국 자정)부터 한국 날짜가 하루 넘어간다', () => {
    expect(todayInKorea(new Date('2026-10-21T14:59:59Z'))).toBe('2026-10-21')
    expect(todayInKorea(new Date('2026-10-21T15:00:00Z'))).toBe('2026-10-22')
  })

  it('한국 시간으로 적힌 시각은 그 날짜 그대로다', () => {
    expect(todayInKorea(new Date('2026-10-22T00:30:00+09:00'))).toBe('2026-10-22')
    expect(todayInKorea(new Date('2026-12-31T23:59:00+09:00'))).toBe('2026-12-31')
  })
})
