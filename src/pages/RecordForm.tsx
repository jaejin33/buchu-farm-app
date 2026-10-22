// 기록 입력 화면. 목록에서 동을 누르면 열린다.
// 날짜(기본 오늘) → 무엇을 했는지 → (필요하면 자세한 내용) → 저장. 버튼 몇 번으로 30초 안에 끝나게 만든다.
// 저장은 recordRepository를 거친다. 기록과 "오늘"은 props로 받는다.

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { DEFAULT_CYCLE_DAYS } from '../config/farm'
import { addRecord, type NewRecord } from '../data/recordRepository'
import { addDays, getHouseStatus, lastHarvestRecord } from '../domain/harvestCalc'
import { latestHarvestAmount, pesticideNames } from '../domain/recordQueries'
import type { FarmRecord, House, HouseProblem } from '../domain/types'
import { PROBLEM_TAG, formatDate, relativeDay } from './labels'
import './RecordForm.css'

/** 첫 화면에서 고르는 종류. 수확은 고른 뒤 "시작 / 완료 / 수확량"을 한 번 더 고른다 */
type Kind = 'spray' | 'top_dressing' | 'fertigation' | 'harvest' | 'problem'
type HarvestStep = 'harvest_start' | 'harvest' | 'harvest_amount'

const KIND_BUTTONS: { kind: Kind; label: string }[] = [
  { kind: 'spray', label: '약' },
  { kind: 'top_dressing', label: '웃거름' },
  { kind: 'fertigation', label: '관비' },
  { kind: 'harvest', label: '수확' },
  { kind: 'problem', label: '문제' },
]

// 바로 위에서 "수확"을 고른 뒤라 짧게 쓴다 (한 줄에 셋이 들어가게). 저장 알림에는 "수확 시작"처럼 다 쓴다
const HARVEST_STEP_BUTTONS: { step: HarvestStep; label: string }[] = [
  { step: 'harvest_start', label: '시작' },
  { step: 'harvest', label: '완료' },
  { step: 'harvest_amount', label: '수확량' },
]

const PROBLEMS: HouseProblem[] = ['drainage', 'mycelium']

/** 숫자만 남긴다 (최대 maxLength자리). 숫자 칸에 다른 글자가 들어가지 않게 */
function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength)
}

/** 고르는 버튼. 고른 것은 초록 테두리. aria-pressed로 화면 읽기 기능에도 "선택됨"을 알린다 */
function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="choice" aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  )
}

interface Props {
  house: House
  records: readonly FarmRecord[]
  today: string
  /** 저장이 끝나면 부른다. message는 목록 화면에 잠깐 띄울 글자 */
  onSaved: (message: string) => void
  onCancel: () => void
  /** "지난 기록" 버튼을 누르면 부른다 (이력 화면은 App이 연다) */
  onOpenHistory: () => void
}

export default function RecordForm({ house, records, today, onSaved, onCancel, onOpenHistory }: Props) {
  const [workDate, setWorkDate] = useState(today)
  const [kind, setKind] = useState<Kind | null>(null)
  const [pesticide, setPesticide] = useState('')
  const [harvestStep, setHarvestStep] = useState<HarvestStep | null>(null)
  const [cycleDays, setCycleDays] = useState(String(DEFAULT_CYCLE_DAYS))
  const [boxes, setBoxes] = useState('')
  const [bunches, setBunches] = useState('')
  const [problem, setProblem] = useState<HouseProblem | null>(null)
  const [resolved, setResolved] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const detailRef = useRef<HTMLElement>(null) // 종류를 고르면 나타나는 자세한 내용 카드

  // 고른 뒤 새로 나타난 내용이 화면 아래(저장 버튼 뒤)에 숨지 않도록 보이는 곳까지 스크롤한다
  useEffect(() => {
    detailRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [kind, harvestStep, problem])

  const knownPesticides = pesticideNames(records)
  const currentProblems = getHouseStatus(records, house.no, today).problems
  const lastHarvest = lastHarvestRecord(records, house.no)
  const lastAmount = lastHarvest === null ? null : latestHarvestAmount(records, lastHarvest.id)

  // 날짜 칸을 비우거나 앞날을 고르면 저장하지 않는다
  const dateOk = workDate !== '' && workDate <= today
  const cycle = Number(cycleDays)
  const boxCount = Number(boxes)
  const bunchCount = Number(bunches)

  /** 지금 고른 내용으로 만든 새 기록과 저장 뒤 보여줄 이름. 아직 덜 골랐으면 null (저장 버튼이 꺼진다) */
  function buildRecord(): { record: NewRecord; label: string } | null {
    if (!dateOk) return null
    const base = { house_no: house.no, work_date: workDate, memo: null }

    switch (kind) {
      case 'spray': {
        const name = pesticide.trim()
        return { record: { ...base, type: 'spray', pesticide: name || null }, label: name ? `약(${name})` : '약' }
      }
      case 'top_dressing':
        return { record: { ...base, type: 'top_dressing' }, label: '웃거름' }
      case 'fertigation':
        return { record: { ...base, type: 'fertigation' }, label: '관비' }
      case 'harvest':
        if (harvestStep === 'harvest_start') {
          return { record: { ...base, type: 'harvest_start' }, label: '수확 시작' }
        }
        if (harvestStep === 'harvest' && cycle >= 1) {
          return { record: { ...base, type: 'harvest', cycle_days: cycle }, label: '수확 완료' }
        }
        if (harvestStep === 'harvest_amount' && lastHarvest !== null && boxCount + bunchCount > 0) {
          return {
            record: { ...base, type: 'harvest_amount', target_id: lastHarvest.id, boxes: boxCount, bunches: bunchCount },
            label: '수확량',
          }
        }
        return null
      case 'problem':
        if (problem === null || resolved === null) return null
        return {
          record: { ...base, type: 'problem', problem, resolved },
          label: `${PROBLEM_TAG[problem].label} ${resolved ? '해결됨' : '생김'}`,
        }
      default:
        return null
    }
  }

  const built = buildRecord()

  async function handleSubmit(e: FormEvent) {
    // form의 기본 동작(페이지 새로고침)을 막는다
    e.preventDefault()
    if (built === null || saving) return
    setSaving(true) // 두 번 눌러 같은 기록이 두 개 생기지 않게 저장하는 동안 버튼을 끈다
    setError(null)
    try {
      await addRecord(built.record)
      onSaved(`${house.no}동 ${built.label} 저장했어요`)
    } catch {
      setError('저장하지 못했어요. 다시 눌러 주세요.')
      setSaving(false)
    }
  }

  /** 문제를 고르면 "생김 / 해결됨"을 지금 상태의 반대로 미리 골라 둔다 (지금 있으면 해결됨, 없으면 생김) */
  function chooseProblem(p: HouseProblem) {
    setProblem(p)
    setResolved(currentProblems.includes(p))
  }

  return (
    <main className="record-form">
      <div className="top-bar">
        <button type="button" className="text-button" onClick={onCancel}>
          ‹ 목록
        </button>
        <button type="button" className="text-button" onClick={onOpenHistory}>
          지난 기록 ›
        </button>
      </div>

      <header className="page-header">
        <p>{house.zone}</p>
        <h1>{house.no}동 기록</h1>
      </header>

      <form onSubmit={handleSubmit}>
        <section className="form-card date-card">
          <label className="field-label" htmlFor="work-date">
            날짜
            {dateOk && <span className="field-hint"> {relativeDay(workDate, today)}</span>}
          </label>
          <input
            id="work-date"
            className="text-input"
            type="date"
            value={workDate}
            max={today}
            onChange={(e) => setWorkDate(e.target.value)}
          />
          {!dateOk && <p className="field-error">오늘이나 지난 날짜를 골라 주세요</p>}
        </section>

        <section className="form-card">
          <h2 className="field-label">무엇을 했나요?</h2>
          <div className="choices choices-3">
            {KIND_BUTTONS.map((b) => (
              <Choice key={b.kind} selected={kind === b.kind} onClick={() => setKind(b.kind)}>
                {b.label}
              </Choice>
            ))}
          </div>
        </section>

        {kind === 'spray' && (
          <section className="form-card" ref={detailRef}>
            <label className="field-label" htmlFor="pesticide">
              약 이름 <span className="field-hint">(안 적어도 돼요)</span>
            </label>
            {knownPesticides.length > 0 && (
              <div className="chips">
                {knownPesticides.map((name) => (
                  <Choice
                    key={name}
                    selected={pesticide.trim() === name}
                    onClick={() => setPesticide(pesticide.trim() === name ? '' : name)}
                  >
                    {name}
                  </Choice>
                ))}
              </div>
            )}
            <input
              id="pesticide"
              className="text-input"
              type="text"
              placeholder={knownPesticides.length > 0 ? '처음 치는 약이면 적어 주세요' : '약 이름'}
              value={pesticide}
              onChange={(e) => setPesticide(e.target.value)}
            />
          </section>
        )}

        {kind === 'harvest' && (
          <section className="form-card" ref={detailRef}>
            <div className="choices choices-3">
              {HARVEST_STEP_BUTTONS.map((b) => (
                <Choice key={b.step} selected={harvestStep === b.step} onClick={() => setHarvestStep(b.step)}>
                  {b.label}
                </Choice>
              ))}
            </div>

            {harvestStep === 'harvest_start' && (
              <p className="field-note">하루에 다 못 벨 때 눌러요. 다 벤 날 "수확 완료"를 눌러 주세요.</p>
            )}

            {harvestStep === 'harvest' && (
              <>
                <label className="field-label" htmlFor="cycle-days">
                  수확 가능까지
                </label>
                <div className="stepper">
                  <button
                    type="button"
                    aria-label="하루 줄이기"
                    onClick={() => setCycleDays(String(Math.max(1, cycle - 1)))}
                  >
                    −
                  </button>
                  <input
                    id="cycle-days"
                    className="text-input"
                    inputMode="numeric"
                    value={cycleDays}
                    onChange={(e) => setCycleDays(digitsOnly(e.target.value, 3))}
                  />
                  <span>일</span>
                  <button type="button" aria-label="하루 늘리기" onClick={() => setCycleDays(String(cycle + 1))}>
                    +
                  </button>
                </div>
                {dateOk && cycle >= 1 && (
                  <p className="field-note">{formatDate(addDays(workDate, cycle))}부터 수확 가능으로 표시돼요</p>
                )}
              </>
            )}

            {harvestStep === 'harvest_amount' &&
              (lastHarvest === null ? (
                <p className="field-error">수확 완료 기록이 없어요. "수확 완료"를 먼저 저장해 주세요.</p>
              ) : (
                <>
                  <p className="field-note">{formatDate(lastHarvest.work_date)}에 끝낸 수확, 전체 양을 적어 주세요</p>
                  <div className="amounts">
                    <label>
                      <input
                        className="text-input"
                        inputMode="numeric"
                        placeholder="0"
                        value={boxes}
                        onChange={(e) => setBoxes(digitsOnly(e.target.value, 4))}
                      />
                      박스
                    </label>
                    <label>
                      <input
                        className="text-input"
                        inputMode="numeric"
                        placeholder="0"
                        value={bunches}
                        onChange={(e) => setBunches(digitsOnly(e.target.value, 4))}
                      />
                      단
                    </label>
                  </div>
                  {lastAmount !== null && (
                    <p className="field-note">
                      이미 적은 양: {lastAmount.boxes}박스 {lastAmount.bunches}단. 다시 저장하면 새로 적은 양으로 바뀌어요.
                    </p>
                  )}
                </>
              ))}
          </section>
        )}

        {kind === 'problem' && (
          <section className="form-card" ref={detailRef}>
            <div className="choices">
              {PROBLEMS.map((p) => (
                <Choice key={p} selected={problem === p} onClick={() => chooseProblem(p)}>
                  <span aria-hidden="true">{PROBLEM_TAG[p].icon}</span> {PROBLEM_TAG[p].label}
                  <small>{currentProblems.includes(p) ? '지금 있음' : '지금 없음'}</small>
                </Choice>
              ))}
            </div>
            {problem !== null && (
              <div className="choices">
                <Choice selected={resolved === false} onClick={() => setResolved(false)}>
                  생김
                </Choice>
                <Choice selected={resolved === true} onClick={() => setResolved(true)}>
                  해결됨
                </Choice>
              </div>
            )}
          </section>
        )}

        <div className="save-bar">
          {error !== null && <p className="field-error">{error}</p>}
          <button type="submit" className="save" disabled={built === null || saving}>
            {saving ? '저장하는 중…' : '저장'}
          </button>
        </div>
      </form>
    </main>
  )
}
