// 기록 타입. 필드 이름은 Supabase `records` 테이블 컬럼과 같게 맞춘다.
// 타입 이름을 `Record` 대신 `FarmRecord`로 한 이유: TypeScript에 내장된 `Record<K, V>` 타입과 이름이 겹치기 때문이다.

export type RecordType = 'spray' | 'top_dressing' | 'fertigation' | 'harvest' | 'cancel'

/** 모든 기록에 공통으로 들어가는 항목 */
interface RecordBase {
  id: string // UUID, 폰에서 생성
  house_no: number
  work_date: string // "YYYY-MM-DD"
  memo: string | null
  recorded_by: string // Supabase Auth 사용자 id
  recorded_at: string // 폰에서 입력한 시각 (ISO 문자열)
}

/** 약 */
export interface SprayRecord extends RecordBase {
  type: 'spray'
  pesticide: string
  phi_days: number // 수확 전 일수. 입력 당시 약 정보에서 복사해 둔 값
}

/** 웃거름 */
export interface TopDressingRecord extends RecordBase {
  type: 'top_dressing'
}

/** 관비 */
export interface FertigationRecord extends RecordBase {
  type: 'fertigation'
}

/** 수확. 수확량 항목과 단위는 미확정이라 비워 둘 수 있게 한다 */
export interface HarvestRecord extends RecordBase {
  type: 'harvest'
  amount: number | null
  amount_unit: string | null
}

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
  | HarvestRecord
  | CancelRecord
