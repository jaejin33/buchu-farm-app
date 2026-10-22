import { describe, expect, it } from 'vitest'
import { randomUuidFallback } from './newId'

// UUID v4 형식: 8-4-4-4-12자리 16진수, 셋째 묶음은 4로 시작, 넷째 묶음은 8·9·a·b로 시작
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('randomUuidFallback', () => {
  it('UUID v4 형식으로 만든다 (Supabase uuid 칸에 들어갈 수 있게)', () => {
    for (let i = 0; i < 100; i++) expect(randomUuidFallback()).toMatch(UUID_V4)
  })

  it('만들 때마다 다르다', () => {
    const ids = new Set(Array.from({ length: 1000 }, randomUuidFallback))
    expect(ids.size).toBe(1000)
  })
})
