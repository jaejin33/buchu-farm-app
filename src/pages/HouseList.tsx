// 하우스 목록 화면. 25동을 구역별 카드로 묶고, 한 줄에 한 동씩 수확 후·약 후 경과 일수와 수확 중·수확 가능 배지를 보여준다.
// 기록과 "오늘"은 props로 받는다. 이 화면은 기록이 어디서 오는지(가짜 데이터 / IndexedDB) 모른다.

import { getHouseStatus } from '../domain/harvestCalc'
import type { FarmRecord, House, HouseProblem } from '../domain/types'
import './HouseList.css'

// 문제 표시. 아이콘만으로는 뜻을 알기 어려워 글자를 함께 쓴다
const PROBLEM_TAG: Record<HouseProblem, { icon: string; label: string }> = {
  drainage: { icon: '💧', label: '배수 불량' },
  mycelium: { icon: '🍄', label: '균사 많음' },
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** "2026-10-22" → "10월 22일 (목)" */
function formatToday(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]
  return `${m}월 ${d}일 (${weekday})`
}

/** 경과 일수 글자. 0일이면 "오늘 수확"처럼 쓴다. 숫자는 strong으로 강조 */
function Elapsed({ label, days }: { label: string; days: number }) {
  if (days === 0) return <>오늘 {label}</>
  return (
    <>
      {label} 후 <strong>{days}</strong>일
    </>
  )
}

interface Props {
  houses: readonly House[]
  records: readonly FarmRecord[]
  today: string
}

export default function HouseList({ houses, records, today }: Props) {
  const rows = houses.map((house) => ({ house, status: getHouseStatus(records, house.no, today) }))

  // 수확 중인 동이 맨 앞. 그다음 수확 가능일이 이른 순 (이미 수확 가능한 동은 오래 기다린 동이 앞).
  // 수확 기록이 없는 동은 맨 뒤, 같으면 동 번호 순
  rows.sort((a, b) => {
    const ha = a.status.kind === 'harvesting'
    const hb = b.status.kind === 'harvesting'
    if (ha !== hb) return ha ? -1 : 1
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
        <p className="today">{formatToday(today)}</p>
        <h1>부추 하우스</h1>
      </header>

      <p className="notice">약 친 뒤 수확은 농약 포장 표기를 확인하세요</p>

      {zones.map((zone) => (
        <section key={zone} className="zone">
          <h2>{zone}</h2>
          <ul className="house-rows">
            {rows
              .filter((row) => row.house.zone === zone)
              .map(({ house, status }) => (
                <li key={house.no} className="house-row">
                  <span className="house-no">
                    {house.no}
                    <small>동</small>
                  </span>
                  <div>
                    {status.daysSinceHarvestStart !== null ? (
                      <p className="house-main">
                        <Elapsed label="시작" days={status.daysSinceHarvestStart} />
                      </p>
                    ) : status.daysSinceHarvest !== null ? (
                      <p className="house-main">
                        <Elapsed label="수확" days={status.daysSinceHarvest} />
                      </p>
                    ) : (
                      <p className="house-main is-empty">수확 기록 없음</p>
                    )}
                    {status.daysSinceSpray !== null && (
                      <p className="house-sub">
                        <Elapsed label="약" days={status.daysSinceSpray} />
                      </p>
                    )}
                  </div>
                  {status.kind === 'harvesting' && <span className="badge badge-harvesting">수확 중</span>}
                  {status.kind === 'ready' && <span className="badge badge-ready">수확 가능</span>}
                  {house.problems.length > 0 && (
                    <div className="house-tags">
                      {house.problems.map((p) => (
                        <span key={p} className="badge badge-problem">
                          <span aria-hidden="true">{PROBLEM_TAG[p].icon}</span> {PROBLEM_TAG[p].label}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
