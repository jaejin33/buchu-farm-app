// 하우스 목록 화면. 25동을 구역별로 묶어 수확 후·약 후 경과 일수와 🟢 수확 가능을 보여준다.
// 기록과 "오늘"은 props로 받는다. 이 화면은 기록이 어디서 오는지(가짜 데이터 / IndexedDB) 모른다.

import { getHouseStatus } from '../domain/harvestCalc'
import type { FarmRecord, House, HouseProblem } from '../domain/types'
import './HouseList.css'

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

/** 경과 일수 한 줄. 0일이면 "오늘 수확"처럼 쓴다 */
function ElapsedLine({ label, days }: { label: string; days: number }) {
  if (days === 0) return <div className="house-elapsed">오늘 {label}</div>
  return (
    <div className="house-elapsed">
      {label} 후 <strong>{days}</strong>일
    </div>
  )
}

interface Props {
  houses: readonly House[]
  records: readonly FarmRecord[]
  today: string
}

export default function HouseList({ houses, records, today }: Props) {
  const rows = houses.map((house) => ({ house, status: getHouseStatus(records, house.no, today) }))

  // 수확 가능일이 이른 순 (이미 수확 가능한 동은 오래 기다린 동이 앞). 수확 기록이 없는 동은 맨 뒤, 같으면 동 번호 순
  rows.sort((a, b) => {
    const da = a.status.readyDate
    const db = b.status.readyDate
    if (da === db) return a.house.no - b.house.no
    if (da === null) return 1
    if (db === null) return -1
    return da < db ? -1 : 1
  })

  // 구역 순서는 houses.ts에 적힌 순서를 따른다
  const zones = [...new Set(houses.map((h) => h.zone))]

  return (
    <main className="house-list">
      <header className="house-list-header">
        <h1>부추 하우스</h1>
        <p className="today">{formatToday(today)}</p>
      </header>

      <p className="notice">약 친 뒤 수확은 농약 포장 표기를 확인하세요</p>

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
                  {status.kind === 'ready' && <div className="house-badge">🟢 수확 가능</div>}
                  {status.kind === 'no_record' && <div className="house-badge">⚪ 수확 기록 없음</div>}
                  {status.daysSinceHarvest !== null && <ElapsedLine label="수확" days={status.daysSinceHarvest} />}
                  {status.daysSinceSpray !== null && <ElapsedLine label="약" days={status.daysSinceSpray} />}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
