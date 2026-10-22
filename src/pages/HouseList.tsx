// 하우스 목록 화면. 25동을 구역별로 묶어 상태 색과 D-n을 보여준다.
// 기록과 "오늘"은 props로 받는다. 이 화면은 기록이 어디서 오는지(가짜 데이터 / IndexedDB) 모른다.

import { getHouseStatus, harvestableDate, type HouseStatusKind } from '../domain/harvestCalc'
import type { FarmRecord, House, HouseProblem } from '../domain/types'
import './HouseList.css'

const STATUS_LABEL: Record<HouseStatusKind, string> = {
  spray_wait: '🔴 약 대기',
  growing: '🟡 자라는 중',
  ready: '🟢 수확 가능',
  no_record: '⚪ 기록 없음',
}

const PROBLEM_ICON: Record<HouseProblem, { icon: string; label: string }> = {
  drainage: { icon: '💧', label: '배수 문제' },
  mycelium: { icon: '🍄', label: '균사 문제' },
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** "2026-10-22" → "10월 22일 (목)" */
function formatToday(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]
  return `${m}월 ${d}일 (${weekday})`
}

interface Props {
  houses: readonly House[]
  records: readonly FarmRecord[]
  today: string
}

export default function HouseList({ houses, records, today }: Props) {
  const rows = houses.map((house) => {
    const status = getHouseStatus(records, house.no, today)
    return { house, status, date: harvestableDate(status) }
  })

  // 벨 수 있는 날이 가까운 순. 날짜를 모르는 동(수확 기록 없음)은 맨 뒤, 같으면 동 번호 순
  rows.sort((a, b) => {
    if (a.date === b.date) return a.house.no - b.house.no
    if (a.date === null) return 1
    if (b.date === null) return -1
    return a.date < b.date ? -1 : 1
  })

  // 구역 순서는 houses.ts에 적힌 순서를 따른다
  const zones = [...new Set(houses.map((h) => h.zone))]

  return (
    <main className="house-list">
      <header className="house-list-header">
        <h1>부추 하우스</h1>
        <p className="today">{formatToday(today)}</p>
      </header>

      <p className="notice">농약 포장 표기가 우선입니다</p>

      {zones.map((zone) => (
        <section key={zone} className="zone">
          <h2>{zone}</h2>
          <ul className="house-grid">
            {rows
              .filter((row) => row.house.zone === zone)
              .map(({ house, status }) => (
                <li key={house.no} className={`house-card status-${status.kind}`}>
                  <div className="house-top">
                    <div className="house-no">
                      {house.no}
                      <span>동</span>
                    </div>
                    {house.problems.length > 0 && (
                      <div className="house-problems">
                        {house.problems.map((p) => (
                          <span key={p} role="img" aria-label={PROBLEM_ICON[p].label} title={PROBLEM_ICON[p].label}>
                            {PROBLEM_ICON[p].icon}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="house-status">{STATUS_LABEL[status.kind]}</div>
                  {status.daysLeft !== null && <div className="house-dday">D-{status.daysLeft}</div>}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
