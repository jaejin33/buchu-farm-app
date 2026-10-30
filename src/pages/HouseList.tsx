// 하우스 목록 화면. 25동을 구역별 카드로 묶고, 한 줄에 한 동씩 수확 후·약 후·물 후 경과 일수와 수확 중·수확 가능 배지를 보여준다.
// 머리에 "미전송 N건 · 마지막 동기화: N분 전"을 작게 보여준다 (다른 폰 기록이 안 보일 때 여기를 본다).
// 기록, 동기화 상태, "오늘"과 지금 시각은 props로 받는다. 이 화면은 기록이 어디서 오는지(IndexedDB 등) 모른다.
// 동 한 줄을 누르면 onSelectHouse로 그 동 번호를 알린다 (기록 입력 화면은 App이 연다).

import { getHouseStatus, problemKey } from '../domain/harvestCalc'
import type { FarmRecord, House } from '../domain/types'
import './HouseList.css'
import { formatDate, problemTag, relativeTime } from './labels'

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
  now: string // 지금 시각 (ISO 문자열). "N분 전"을 세는 데 쓴다
  pendingCount: number // 아직 서버로 못 보낸 기록 수
  lastSyncedAt: string | null // 마지막 동기화 시각. 한 번도 안 했으면 null
  onSelectHouse: (houseNo: number) => void
}

export default function HouseList({
  houses,
  records,
  today,
  now,
  pendingCount,
  lastSyncedAt,
  onSelectHouse,
}: Props) {
  const rows = houses.map((house) => ({ house, status: getHouseStatus(records, house.no, today) }))

  // 구역 안에서는 늘 동 번호 순. 기록에 따라 자리가 바뀌면 찾던 동을 놓치기 쉬워서 고정한다
  rows.sort((a, b) => a.house.no - b.house.no)

  // 구역 순서는 houses.ts에 적힌 순서를 따른다
  const zones = [...new Set(houses.map((h) => h.zone))]

  return (
    <main className="house-list">
      <header className="house-list-header">
        <p className="today">{formatDate(today)}</p>
        <h1>부추 하우스</h1>
        <p className="hint">동을 누르면 기록을 적어요</p>
        <p className="sync-status">
          {/* 못 보낸 기록이 있을 때만 앞에 붙인다 (주황) */}
          {pendingCount > 0 && (
            <>
              <span className="sync-pending">미전송 {pendingCount}건</span> ·{' '}
            </>
          )}
          {lastSyncedAt === null ? '동기화 전' : `마지막 동기화: ${relativeTime(lastSyncedAt, now)}`}
        </p>
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
                      {/* 아랫줄: "약 후 3일 · 물 후 2일". 기록이 있는 것만 쓴다 */}
                      {(status.daysSinceSpray !== null || status.daysSinceWater !== null) && (
                        <span className="house-sub">
                          {status.daysSinceSpray !== null && (
                            <span className="house-sub-item">
                              <Elapsed label="약" days={status.daysSinceSpray} />
                            </span>
                          )}
                          {status.daysSinceWater !== null && (
                            <span className="house-sub-item">
                              <Elapsed label="물" days={status.daysSinceWater} />
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                    {status.kind === 'harvesting' && <span className="badge badge-harvesting">수확 중</span>}
                    {status.kind === 'ready' && <span className="badge badge-ready">수확 가능</span>}
                    {status.problems.length > 0 && (
                      <span className="house-tags">
                        {status.problems.map((p) => (
                          <span key={problemKey(p)} className="badge badge-problem">
                            <span aria-hidden="true">{problemTag(p).icon}</span> {problemTag(p).label}
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
