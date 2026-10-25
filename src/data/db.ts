// Dexie(IndexedDB) 설정. 폰 안에 기록을 저장하는 곳이다.
// 화면은 이 파일을 직접 쓰지 않고 recordRepository를 거친다.

import { Dexie, type EntityTable } from 'dexie'
import type { FarmRecord, Profile } from '../domain/types'

/**
 * IndexedDB에 저장하는 기록 = 기록 + 서버로 보냈는지(synced).
 * synced를 true/false가 아니라 1/0으로 두는 이유: IndexedDB는 true/false로 찾는 색인을 만들 수 없다.
 * 6단계 동기화에서 "아직 안 보낸 기록(synced = 0)"을 찾을 때 이 색인을 쓴다
 */
export type StoredRecord = FarmRecord & { synced: 0 | 1 }

export const db = new Dexie('buchu-farm') as Dexie & {
  records: EntityTable<StoredRecord, 'id'>
  profiles: EntityTable<Profile, 'id'> // 서버에서 받아 둔 사람 이름 (오프라인에서도 이력에 이름이 보이게)
}

// 스키마 버전 1. 적는 것은 기본 키(id)와 색인(synced)만이고, 나머지 항목은 적지 않아도 함께 저장된다.
// 나중에 색인을 바꾸면 새 버전을 추가한다 (지난 버전은 고치지 않는다)
db.version(1).stores({
  records: 'id, synced',
})

// 버전 2 (6-6): 사람 이름 표를 더한다. 이미 설치된 폰은 앱을 열 때 저절로 2로 올라가고, 기록은 그대로 남는다
db.version(2).stores({
  profiles: 'id',
})
