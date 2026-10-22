// Dexie(IndexedDB) 설정. 폰 안에 기록을 저장하는 곳이다.
// 화면은 이 파일을 직접 쓰지 않고 recordRepository를 거친다.

import { Dexie, type EntityTable } from 'dexie'
import type { FarmRecord } from '../domain/types'

/**
 * IndexedDB에 저장하는 기록 = 기록 + 서버로 보냈는지(synced).
 * synced를 true/false가 아니라 1/0으로 두는 이유: IndexedDB는 true/false로 찾는 색인을 만들 수 없다.
 * 6단계 동기화에서 "아직 안 보낸 기록(synced = 0)"을 찾을 때 이 색인을 쓴다
 */
export type StoredRecord = FarmRecord & { synced: 0 | 1 }

export const db = new Dexie('buchu-farm') as Dexie & {
  records: EntityTable<StoredRecord, 'id'>
}

// 스키마 버전 1. 적는 것은 기본 키(id)와 색인(synced)만이고, 나머지 항목은 적지 않아도 함께 저장된다.
// 나중에 색인을 바꾸면 version(2)를 새로 추가한다 (version(1)은 고치지 않는다)
db.version(1).stores({
  records: 'id, synced',
})
