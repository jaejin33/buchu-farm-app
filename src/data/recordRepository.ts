// 화면이 기록을 읽고 쓰는 유일한 입구. 화면은 IndexedDB(Dexie)나 Supabase를 직접 부르지 않고 여기만 부른다.
// 그래서 저장 방식이 바뀌어도 화면 코드는 그대로 둘 수 있다.
// 기록은 추가만 한다 (수정·삭제 함수는 일부러 만들지 않는다. 잘못 입력하면 cancel 기록을 추가한다).

import { useLiveQuery } from 'dexie-react-hooks'
import { nowTimestamp } from '../domain/today'
import type { FarmRecord } from '../domain/types'
import { getCurrentUser } from './auth'
import { db } from './db'
import { newId } from './newId'

/** 로그인을 붙이기 전(5단계까지) 시험 기록에 넣던 임시 입력자 id. 로그인할 때 이 기록들을 지운다 */
export const LOCAL_USER_ID = '00000000-0000-0000-0000-000000000000'

// 유니온 타입의 각 종류마다 Omit을 따로 적용한다.
// 그냥 Omit<FarmRecord, ...>을 쓰면 모든 종류에 공통인 항목만 남아 pesticide, cycle_days 같은 항목이 사라진다
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** 화면이 넘기는 새 기록. id·입력한 사람·입력 시각은 여기서 채운다 */
export type NewRecord = DistributiveOmit<FarmRecord, 'id' | 'recorded_by' | 'recorded_at'>

/** 기록을 폰(IndexedDB)에 저장한다. 입력한 사람은 이 폰에서 로그인한 사람이다. 서버로는 아직 안 보낸 상태(synced: 0)로 둔다 */
export async function addRecord(input: NewRecord): Promise<FarmRecord> {
  const user = getCurrentUser()
  if (user === null) throw new Error('로그인 전에는 기록할 수 없어요')
  const record: FarmRecord = { ...input, id: newId(), recorded_by: user.id, recorded_at: nowTimestamp() }
  await db.records.add({ ...record, synced: 0 })
  return record
}

/**
 * 로그인 전에 넣은 시험 기록(입력한 사람이 임시 id)을 지운다. 로그인 직후 한 번 부른다.
 * 기록은 추가만 한다는 규칙의 예외다: 시험 기록은 누가 넣었는지가 틀려서 서버로 보내지 않고 버리기로 했다
 */
export async function removeTestRecords(): Promise<void> {
  await db.records.filter((r) => r.recorded_by === LOCAL_USER_ID).delete()
}

/** 폰에 있는 모든 기록 (취소된 기록과 cancel 기록 포함. 거르는 일은 domain 함수가 한다) */
export function getAllRecords(): Promise<FarmRecord[]> {
  return db.records.toArray()
}

/**
 * 화면용: 모든 기록을 읽고, 기록이 추가되면 화면을 다시 그린다.
 * 처음 읽는 동안에는 undefined다
 */
export function useRecords(): FarmRecord[] | undefined {
  return useLiveQuery(getAllRecords)
}
