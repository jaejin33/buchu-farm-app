// 하우스 25동 설정. 앱에서 수정하지 않는다. 바뀌면 이 파일을 고쳐 다시 배포한다.
// 구역 구분은 실제 값 (2026-10-22 확인). 구역 이름은 부르는 이름이 정해지지 않아 번호로 붙였다.
// 문제 상태(💧 배수, 🍄 균사)는 수시로 바뀌어서 여기 두지 않고 problem 기록으로 남긴다.

import type { House } from '../domain/types'

export const HOUSES: readonly House[] = [
  { no: 1, zone: '1구역', crop: '부추' },
  { no: 2, zone: '1구역', crop: '부추' },
  { no: 3, zone: '1구역', crop: '부추' },
  { no: 4, zone: '1구역', crop: '부추' },
  { no: 5, zone: '2구역', crop: '부추' },
  { no: 6, zone: '2구역', crop: '부추' },
  { no: 7, zone: '2구역', crop: '부추' },
  { no: 8, zone: '2구역', crop: '부추' },
  { no: 9, zone: '2구역', crop: '부추' },
  { no: 10, zone: '2구역', crop: '부추' },
  { no: 11, zone: '3구역', crop: '부추' },
  { no: 12, zone: '3구역', crop: '부추' },
  { no: 13, zone: '3구역', crop: '부추' },
  { no: 14, zone: '4구역', crop: '부추' },
  { no: 15, zone: '4구역', crop: '부추' },
  { no: 16, zone: '4구역', crop: '부추' },
  { no: 17, zone: '5구역', crop: '부추' },
  { no: 18, zone: '5구역', crop: '부추' },
  { no: 19, zone: '5구역', crop: '부추' },
  { no: 20, zone: '5구역', crop: '부추' },
  { no: 21, zone: '6구역', crop: '부추' },
  { no: 22, zone: '6구역', crop: '부추' },
  { no: 23, zone: '6구역', crop: '부추' },
  { no: 24, zone: '6구역', crop: '부추' },
  { no: 25, zone: '6구역', crop: '부추' },
]
