// 기록 id(UUID v4) 만들기.
// crypto.randomUUID()는 https나 localhost에서만 있다. 폰으로 PC 개발 서버(http://192.168.x.x)에 접속하면 없어서,
// 그때는 http에서도 쓸 수 있는 crypto.getRandomValues()로 같은 형식의 UUID를 직접 만든다.
// 배포 주소(https)에서는 항상 crypto.randomUUID()를 쓴다.

export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return randomUuidFallback()
}

/** crypto.getRandomValues()로 만든 UUID v4 */
export function randomUuidFallback(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  // UUID v4 규칙: 7번째 바이트 앞 4비트는 버전(4), 9번째 바이트 앞 2비트는 10
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
