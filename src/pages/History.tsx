// 이력 화면. 한 동의 기록을 최근 순으로, 날짜별로 묶어 보여준다. 기록 입력 화면의 "지난 기록"에서 열린다.
// 잘못 입력한 기록은 줄마다 [취소]로 취소한다. 기록을 지우지 않고 cancel 기록을 추가한다 (CLAUDE.md 데이터 규칙).
// 입력한 사람은 6단계에서 로그인을 붙인 뒤 표시한다. 그 전에는 모든 기록이 같은 임시 id라 보여줄 이름이 없다.

import { useEffect, useRef, useState } from 'react'
import { addRecord } from '../data/recordRepository'
import { houseHistory, latestHarvestAmount } from '../domain/recordQueries'
import type { FarmRecord, House } from '../domain/types'
import './History.css'
import { PROBLEM_TAG, formatDate, relativeDay } from './labels'

/** 이력 한 줄의 글자: 무엇(title), 자세한 내용(detail), 아랫줄 설명(note) */
function describe(
  r: FarmRecord,
  records: readonly FarmRecord[],
): { title: string; detail: string | null; note?: string } {
  switch (r.type) {
    case 'spray':
      return { title: '약', detail: r.pesticide }
    case 'top_dressing':
      return { title: '웃거름', detail: null }
    case 'fertigation':
      return { title: '관비', detail: null }
    case 'harvest_start':
      return { title: '수확 시작', detail: null }
    case 'harvest':
      return { title: '수확 완료', detail: `수확 가능까지 ${r.cycle_days}일` }
    case 'harvest_amount': {
      // 어느 수확의 양인지 함께 쓴다 (수확량은 완료 다음 날 입력하므로 날짜가 다르다)
      const target = records.find((t) => t.id === r.target_id)
      return {
        title: '수확량',
        detail: `${r.boxes}박스 ${r.bunches}단`,
        note: target === undefined ? undefined : `${formatDate(target.work_date)} 수확분`,
      }
    }
    case 'problem':
      return {
        title: `${PROBLEM_TAG[r.problem].icon} ${PROBLEM_TAG[r.problem].label}`,
        detail: r.resolved ? '해결됨' : '생김',
      }
    case 'cancel':
      return { title: '취소', detail: null } // 이력에는 나오지 않는다 (houseHistory가 뺌)
  }
}

/** 최근 순으로 줄 선 기록을 작업 날짜별로 묶는다. 순서는 그대로 */
function groupByDate(records: FarmRecord[]): { date: string; records: FarmRecord[] }[] {
  const groups: { date: string; records: FarmRecord[] }[] = []
  for (const r of records) {
    const last = groups.at(-1)
    if (last !== undefined && last.date === r.work_date) last.records.push(r)
    else groups.push({ date: r.work_date, records: [r] })
  }
  return groups
}

interface Props {
  house: House
  records: readonly FarmRecord[]
  today: string
  onBack: () => void
  /** 기록을 취소하면 부른다. message는 화면 아래에 잠깐 띄울 글자 */
  onCanceled: (message: string) => void
}

export default function History({ house, records, today, onBack, onCanceled }: Props) {
  // [취소]를 한 번 누른 기록 id. 그 줄에 "취소할까요?"를 묻는다 (장갑 낀 손으로 잘못 눌러도 바로 취소되지 않게)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmRef = useRef<HTMLLIElement>(null) // "취소할까요?"를 묻는 줄

  // 묻는 줄이 열리면 [네, 취소] 버튼까지 보이도록 스크롤한다 (화면 아래쪽 줄이면 버튼이 화면 밖에 있다)
  useEffect(() => {
    confirmRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [confirmingId])

  const groups = groupByDate(houseHistory(records, house.no))

  async function cancelRecord(r: FarmRecord) {
    if (busy) return
    setBusy(true) // 두 번 눌러 취소 기록이 두 개 생기지 않게
    setError(null)
    try {
      // 취소한 날짜는 오늘. 취소 대상은 target_id로 가리킨다
      await addRecord({ type: 'cancel', house_no: house.no, work_date: today, target_id: r.id, memo: null })
      setConfirmingId(null)
      onCanceled(`${describe(r, records).title} 기록을 취소했어요`)
    } catch {
      setError('취소하지 못했어요. 다시 눌러 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="history">
      <div className="top-bar">
        <button type="button" className="text-button" onClick={onBack}>
          ‹ {house.no}동 기록
        </button>
      </div>

      <header className="page-header">
        <p>{house.zone}</p>
        <h1>{house.no}동 지난 기록</h1>
      </header>

      {groups.length === 0 ? (
        <p className="history-empty">아직 기록이 없어요</p>
      ) : (
        <p className="history-hint">잘못 적은 기록은 [취소]를 누르세요</p>
      )}

      {groups.map((group) => (
        <section key={group.date} className="history-day">
          <h2>
            {formatDate(group.date)} <span>{relativeDay(group.date, today)}</span>
          </h2>
          <ul>
            {group.records.map((r) => {
              const { title, detail, note } = describe(r, records)
              const confirming = confirmingId === r.id
              // 수확 완료를 취소하면 그 수확량도 계산에서 빠진다. 미리 알려 준다
              const hasAmount = r.type === 'harvest' && latestHarvestAmount(records, r.id) !== null
              return (
                <li
                  key={r.id}
                  className={confirming ? 'is-confirming' : undefined}
                  ref={confirming ? confirmRef : undefined}
                >
                  <div className="history-row">
                    <span className="history-text">
                      <span className="history-title">{title}</span>
                      {detail !== null && <span className="history-detail">{detail}</span>}
                      {note !== undefined && <span className="history-note">{note}</span>}
                    </span>
                    {!confirming && (
                      <button
                        type="button"
                        className="history-cancel"
                        onClick={() => {
                          setConfirmingId(r.id)
                          setError(null)
                        }}
                      >
                        취소
                      </button>
                    )}
                  </div>
                  {confirming && (
                    <div className="history-confirm">
                      <p>
                        이 기록을 취소할까요?
                        {hasAmount && <> 이 수확의 수확량도 함께 빠져요.</>}
                      </p>
                      {error !== null && <p className="history-error">{error}</p>}
                      <div className="history-confirm-buttons">
                        <button type="button" className="confirm-no" onClick={() => setConfirmingId(null)}>
                          아니요
                        </button>
                        <button
                          type="button"
                          className="confirm-yes"
                          disabled={busy}
                          onClick={() => cancelRecord(r)}
                        >
                          네, 취소
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </main>
  )
}
