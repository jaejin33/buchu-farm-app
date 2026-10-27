// 화면이 기록을 읽고 쓰는 유일한 입구. 화면은 IndexedDB(Dexie)나 Supabase를 직접 부르지 않고 여기만 부른다.
// 그래서 저장 방식이 바뀌어도 화면 코드는 그대로 둘 수 있다.
// 기록은 추가만 한다 (기록을 바꾸거나 지우는 함수는 일부러 만들지 않는다. 잘못 입력하면 cancel 기록을 추가하고,
// "수정"도 cancel + 새 기록을 추가한다).

import { useLiveQuery } from 'dexie-react-hooks'
import { useSyncExternalStore } from 'react'
import { latestHarvestAmount } from '../domain/recordQueries'
import { nowTimestamp } from '../domain/today'
import type { FarmRecord, Profile } from '../domain/types'
import { getCurrentUser } from './auth'
import { db } from './db'
import { newId } from './newId'
import { getLastSyncedAt, subscribeLastSyncedAt, uploadPending } from './syncService'

/** 로그인을 붙이기 전(5단계까지) 시험 기록에 넣던 임시 입력자 id. 로그인할 때 이 기록들을 지운다 */
export const LOCAL_USER_ID = '00000000-0000-0000-0000-000000000000'

// 유니온 타입의 각 종류마다 Omit을 따로 적용한다.
// 그냥 Omit<FarmRecord, ...>을 쓰면 모든 종류에 공통인 항목만 남아 pesticide, cycle_days 같은 항목이 사라진다
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** 화면이 넘기는 새 기록. id·입력한 사람·입력 시각은 여기서 채운다 */
export type NewRecord = DistributiveOmit<FarmRecord, 'id' | 'recorded_by' | 'recorded_at'>

/**
 * 기록을 폰(IndexedDB)에 저장한다. 입력한 사람은 이 폰에서 로그인한 사람이다.
 * 안 보낸 상태(synced: 0)로 저장한 뒤 바로 서버로 올리기를 시작한다. 올리기는 기다리지 않는다
 * (인터넷이 느리거나 끊겨도 저장은 바로 끝나고 화면이 넘어가게)
 */
export async function addRecord(input: NewRecord): Promise<FarmRecord> {
  const user = getCurrentUser()
  if (user === null) throw new Error('로그인 전에는 기록할 수 없어요')
  const record: FarmRecord = { ...input, id: newId(), recorded_by: user.id, recorded_at: nowTimestamp() }
  await db.records.add({ ...record, synced: 0 })
  void uploadPending()
  return record
}

/**
 * 기록을 수정한다 (10단계). 원래 기록을 바꾸지 않고, 원래 기록의 cancel + 새 기록(input)을 추가한다.
 * 둘 중 하나만 남지 않게 한 번에(트랜잭션) 저장한다.
 * - 종류는 못 바꾼다 (input.type이 원래 기록과 달라야 하면 취소하고 새로 적는다). cancel 기록은 수정할 수 없다
 * - 새 기록은 원래 기록의 입력 시각(recorded_at)을 이어받는다. 같은 날 기록끼리의 순서("마지막 기록")가
 *   수정 때문에 바뀌지 않게 하려는 것이다. 예: 같은 날 "수확 시작"을 수정했는데 "수확 완료"보다 나중이 되어 "수확 중"으로 보이는 일
 * - 수확 완료를 수정하면 그 수확량(계산에 쓰는 것)을 새 수확 완료 기록을 가리키게 다시 추가한다 (다시 적지 않아도 되게)
 * 입력한 사람은 수정한 사람이다. cancel 기록의 날짜는 수정한 날(today)이다
 */
export async function editRecord(original: FarmRecord, input: NewRecord, today: string): Promise<FarmRecord> {
  const user = getCurrentUser()
  if (user === null) throw new Error('로그인 전에는 기록할 수 없어요')
  if (original.type === 'cancel' || input.type !== original.type) throw new Error('기록 종류는 바꿀 수 없어요')

  const record: FarmRecord = { ...input, id: newId(), recorded_by: user.id, recorded_at: original.recorded_at }
  const cancel: FarmRecord = {
    type: 'cancel',
    house_no: original.house_no,
    work_date: today,
    target_id: original.id,
    memo: null,
    id: newId(),
    recorded_by: user.id,
    recorded_at: nowTimestamp(),
  }

  await db.transaction('rw', db.records, async () => {
    const added: FarmRecord[] = [cancel, record]
    const amount = original.type === 'harvest' ? latestHarvestAmount(await db.records.toArray(), original.id) : null
    if (amount !== null) {
      added.push({
        type: 'harvest_amount',
        house_no: amount.house_no,
        work_date: amount.work_date,
        target_id: record.id,
        boxes: amount.boxes,
        bunches: amount.bunches,
        memo: amount.memo,
        id: newId(),
        recorded_by: user.id,
        recorded_at: amount.recorded_at, // 수확 기록과 같은 이유로 입력 시각을 이어받는다
      })
    }
    await db.records.bulkAdd(added.map((r) => ({ ...r, synced: 0 as const })))
  })
  void uploadPending()
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

/**
 * 화면용: 폰에 받아 둔 사람 이름 표. 동기화로 바뀌면 화면을 다시 그린다.
 * 처음 읽는 동안에는 undefined다
 */
export function useProfiles(): Profile[] | undefined {
  return useLiveQuery(() => db.profiles.toArray())
}

/**
 * 화면용: 아직 서버로 못 보낸 기록 수. 저장하거나 올리기가 끝나면 화면을 다시 그린다.
 * 처음 읽는 동안에는 undefined다
 */
export function usePendingCount(): number | undefined {
  return useLiveQuery(() => db.records.where('synced').equals(0).count())
}

/** 화면용: 마지막으로 서버에서 끝까지 받은 시각 (한 번도 못 받았으면 null). 바뀌면 화면을 다시 그린다 */
export function useLastSyncedAt(): string | null {
  // useSyncExternalStore: React 밖(localStorage)에 있는 값을 읽고, 바뀐다는 알림이 오면 다시 그린다
  return useSyncExternalStore(subscribeLastSyncedAt, getLastSyncedAt)
}
