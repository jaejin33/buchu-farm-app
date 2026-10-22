// 하우스 목록 화면. 25동을 구역별 카드로 묶고, 한 줄에 한 동씩 수확 후·약 후 경과 일수와 수확 중·수확 가능 배지를 보여준다.
// 기록과 "오늘"은 props로 받는다. 이 화면은 기록이 어디서 오는지(IndexedDB 등) 모른다.
// 동 한 줄을 누르면 onSelectHouse로 그 동 번호를 알린다 (기록 입력 화면은 App이 연다).

import { getHouseStatus } from '../domain/harvestCalc'
import type { FarmRecord, House } from '../domain/types'
import './HouseList.css'
import { PROBLEM_TAG, formatDate } from './labels'

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
  onSelectHouse: (houseNo: number) => void
}

export default function HouseList({ houses, records, today, onSelectHouse }: Props) {
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
        <p className="today">{formatDate(today)}</p>
        <h1>부추 하우스</h1>
        <p className="hint">동을 누르면 기록을 적어요</p>
      </header>

      <p className="notice">약 친 뒤 수확은 농약 포장 표기를 확인하세요</p>

      {zones.map((zone) => (
        <section key={zone} className="zone">
          <h2>{zone}</h2>
          <ul className="house-rows">
            {rows
              .filter((row) => row.house.zone === zone)
              .map(({ house, status }) => (
                <li key={house.no}>
                  {/* 한 줄 전체가 버튼이다. 장갑 낀 손으로도 누르기 쉽게 */}
                  <button type="button" className="house-row" onClick={() => onSelectHouse(house.no)}>
                    <span className="house-no">
                      {house.no}
                      <small>동</small>
                    </span>
                    <span>
                      {status.daysSinceHarvestStart !== null ? (
                        <span className="house-main">
                          <Elapsed label="시작" days={status.daysSinceHarvestStart} />
                        </span>
                      ) : status.daysSinceHarvest !== null ? (
                        <span className="house-main">
                          <Elapsed label="수확" days={status.daysSinceHarvest} />
                        </span>
                      ) : (
                        <span className="house-main is-empty">수확 기록 없음</span>
                      )}
                      {status.daysSinceSpray !== null && (
                        <span className="house-sub">
                          <Elapsed label="약" days={status.daysSinceSpray} />
                        </span>
                      )}
                    </span>
                    {status.kind === 'harvesting' && <span className="badge badge-harvesting">수확 중</span>}
                    {status.kind === 'ready' && <span className="badge badge-ready">수확 가능</span>}
                    {status.problems.length > 0 && (
                      <span className="house-tags">
                        {status.problems.map((p) => (
                          <span key={p} className="badge badge-problem">
                            <span aria-hidden="true">{PROBLEM_TAG[p].icon}</span> {PROBLEM_TAG[p].label}
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
