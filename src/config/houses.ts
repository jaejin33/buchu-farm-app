// 하우스 25동 설정. 앱에서 수정하지 않는다. 바뀌면 이 파일을 고쳐 다시 배포한다.
// 구역 구분은 실제 값 (2026-10-22 확인). 구역 이름은 부르는 이름이 정해지지 않아 번호로 붙였다.
// ⚠ 임시 값: 문제 상태(💧 배수, 🍄 균사)는 가짜다. 형에게 확인한 뒤 실제 값으로 바꾼다.

import type { House } from '../domain/types'

export const HOUSES: readonly House[] = [
  { no: 1, zone: '1구역', crop: '부추', problems: [] },
  { no: 2, zone: '1구역', crop: '부추', problems: [] },
  { no: 3, zone: '1구역', crop: '부추', problems: ['drainage'] },
  { no: 4, zone: '1구역', crop: '부추', problems: [] },
  { no: 5, zone: '2구역', crop: '부추', problems: [] },
  { no: 6, zone: '2구역', crop: '부추', problems: ['mycelium'] },
  { no: 7, zone: '2구역', crop: '부추', problems: ['drainage', 'mycelium'] },
  { no: 8, zone: '2구역', crop: '부추', problems: [] },
  { no: 9, zone: '2구역', crop: '부추', problems: [] },
  { no: 10, zone: '2구역', crop: '부추', problems: [] },
  { no: 11, zone: '3구역', crop: '부추', problems: ['drainage'] },
  { no: 12, zone: '3구역', crop: '부추', problems: [] },
  { no: 13, zone: '3구역', crop: '부추', problems: [] },
  { no: 14, zone: '4구역', crop: '부추', problems: [] },
  { no: 15, zone: '4구역', crop: '부추', problems: ['mycelium'] },
  { no: 16, zone: '4구역', crop: '부추', problems: [] },
  { no: 17, zone: '5구역', crop: '부추', problems: [] },
  { no: 18, zone: '5구역', crop: '부추', problems: [] },
  { no: 19, zone: '5구역', crop: '부추', problems: [] },
  { no: 20, zone: '5구역', crop: '부추', problems: ['drainage'] },
  { no: 21, zone: '6구역', crop: '부추', problems: [] },
  { no: 22, zone: '6구역', crop: '부추', problems: [] },
  { no: 23, zone: '6구역', crop: '부추', problems: ['mycelium'] },
  { no: 24, zone: '6구역', crop: '부추', problems: [] },
  { no: 25, zone: '6구역', crop: '부추', problems: [] },
]
