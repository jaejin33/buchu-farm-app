// 하우스와 기록 타입.

// ---- 하우스 ----

/** 하우스 문제. 정도는 재지 않고 "있다/없다"만 둔다 */
export type HouseProblem =
  | 'drainage' // 💧 배수가 안 됨
  | 'mycelium' // 🍄 버섯균사가 많음

/** 하우스 고정 정보. 문제 상태는 수시로 바뀌어서 여기 두지 않고 ProblemRecord로 남긴다 */
export interface House {
  no: number // 동 번호 (1~25)
  zone: string // 구역 이름
  crop: string // 작물. 지금은 모두 부추지만 다른 작물을 심을 수 있어 항목으로 둔다
}

// ---- 사람 ----

/** 입력한 사람의 이름. Supabase `profiles` 테이블과 같은 모양이다 (이름은 Supabase에서 개발자가 넣는다) */
export interface Profile {
  id: string // Supabase Auth 사용자 id (= 기록의 recorded_by)
  name: string // "아버지", "형"
}

// ---- 기록 ----
// 필드 이름은 Supabase `records` 테이블 컬럼과 같게 맞춘다.
// 타입 이름을 `Record` 대신 `FarmRecord`로 한 이유: TypeScript에 내장된 `Record<K, V>` 타입과 이름이 겹치기 때문이다.

export type RecordType =
  | 'spray'
  | 'top_dressing'
  | 'fertigation'
  | 'harvest_start'
  | 'harvest'
  | 'harvest_amount'
  | 'problem'
  | 'cancel'

/** 모든 기록에 공통으로 들어가는 항목 */
interface RecordBase {
  id: string // UUID, 폰에서 생성
  house_no: number
  work_date: string // "YYYY-MM-DD"
  memo: string | null
  recorded_by: string // Supabase Auth 사용자 id
  recorded_at: string // 폰에서 입력한 시각 (ISO 문자열)
}

/** 약. 앱은 친 지 며칠 됐는지만 센다 (수확 전 일수는 받지 않는다) */
export interface SprayRecord extends RecordBase {
  type: 'spray'
  pesticide: string | null // 약 이름. 안 적어도 된다 (null). 지난 약 기록의 이름을 모아 약 목록을 만든다
  // 한 동에 쓴 약 원액 양(ml, 정수). 안 적어도 된다 (null). 9단계 전에 저장한 기록에는 이 항목이 없다 (양 없음으로 본다)
  amount_ml?: number | null
}

/** 비료 (웃거름). 화면에는 9단계부터 "비료"로 쓴다. type 값은 지난 기록과 맞추려고 그대로 둔다 */
export interface TopDressingRecord extends RecordBase {
  type: 'top_dressing'
  // 비료 이름. 약 이름처럼 안 적어도 된다 (null). 7단계 전에 저장한 기록에는 이 항목이 없다 (이름 없음으로 본다)
  fertilizer?: string | null
  bags?: number | null // 한 동에 준 포 수 (0.5포처럼 소수도). 안 적어도 된다 (null). 9단계 전 기록에는 없다
}

/** 관비 */
export interface FertigationRecord extends RecordBase {
  type: 'fertigation'
  fertilizer?: string | null // 비료 이름. 비료(웃거름)와 같다
  amount_ml?: number | null // 한 동에 쓴 양(ml, 정수). 약과 같다
}

/** 비료 이름을 적는 기록 종류 */
export type FertilizerType = 'top_dressing' | 'fertigation'

/** 쓴 양을 적는 기록 종류. 약·관비는 ml, 비료(웃거름)는 포 */
export type AmountType = 'spray' | FertilizerType

/** 수확 시작. 한 동을 하루에 다 못 벨 때 누른다. 다음 수확 완료 기록까지 "수확 중"이다 */
export interface HarvestStartRecord extends RecordBase {
  type: 'harvest_start'
}

/**
 * 수확 완료. 하루에 끝나면 시작 없이 이것만 남겨도 된다.
 * 수확량은 다음 날 아침에 알기 때문에 여기 넣지 않고 HarvestAmountRecord로 따로 추가한다
 */
export interface HarvestRecord extends RecordBase {
  type: 'harvest'
  cycle_days: number // 수확 가능까지 일수. 입력 당시 값 (기본값 config/farm.ts)
}

/** 수확량. 수확 완료 다음 날, 이번 수확 전체를 한 번에 입력한다. 한 수확에 여러 개면 가장 나중에 입력한 것을 쓴다 */
export interface HarvestAmountRecord extends RecordBase {
  type: 'harvest_amount'
  target_id: string // 수확 완료 기록 id
  boxes: number // 박스 수
  bunches: number // 단 수. 박스로 환산하지 않고 따로 둔다
}

/** 하우스 문제 생김 / 해결됨. 같은 동·같은 문제는 마지막 기록을 따른다 */
export interface ProblemRecord extends RecordBase {
  type: 'problem'
  problem: HouseProblem | 'other' // 'other' = 배수·균사 말고 직접 적은 문제 (8단계)
  // 직접 적은 문제 이름 (problem이 'other'일 때만, 10자까지). 이름이 같으면 같은 문제로 본다.
  // 배수·균사 기록에는 없다
  problem_name?: string | null
  resolved: boolean // false = 생김, true = 해결됨
}

/** 문제 하나. 정해 둔 문제(배수·균사)이거나 직접 적은 문제. 기록(ProblemRecord)에서 problemOf로 뽑는다 */
export type Problem = { kind: HouseProblem } | { kind: 'other'; name: string }

/** 기록 취소. target_id의 기록을 화면과 계산에서 뺀다 */
export interface CancelRecord extends RecordBase {
  type: 'cancel'
  target_id: string
}

// `type` 값으로 어떤 기록인지 구분하는 유니온 타입.
// `if (r.type === 'spray')` 안에서는 TypeScript가 r을 SprayRecord로 알아서 좁혀 준다.
export type FarmRecord =
  | SprayRecord
  | TopDressingRecord
  | FertigationRecord
  | HarvestStartRecord
  | HarvestRecord
  | HarvestAmountRecord
  | ProblemRecord
  | CancelRecord
