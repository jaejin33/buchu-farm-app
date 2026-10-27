// 기록 입력 화면. 목록에서 동을 누르면 열린다.
// 날짜(기본 오늘) → 무엇을 했는지 → (필요하면 자세한 내용) → 저장. 버튼 몇 번으로 30초 안에 끝나게 만든다.
// 저장은 recordRepository를 거친다. 기록과 "오늘"은 props로 받는다.

import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { DEFAULT_CYCLE_DAYS } from '../config/farm'
import { addRecord, type NewRecord } from '../data/recordRepository'
import { addDays, getHouseStatus, lastHarvestRecord, problemKey } from '../domain/harvestCalc'
import { fertilizerNames, lastUsedAmount, latestHarvestAmount, pesticideNames, problemNames } from '../domain/recordQueries'
import type { AmountType, FarmRecord, House, HouseProblem, Problem } from '../domain/types'
import { PROBLEM_TAG, formatBags, formatDate, problemTag, relativeDay } from './labels'
import './RecordForm.css'

/** 첫 화면에서 고르는 종류. 수확은 고른 뒤 "시작 / 완료 / 수확량"을 한 번 더 고른다 */
type Kind = 'spray' | 'top_dressing' | 'fertigation' | 'harvest' | 'problem'
type HarvestStep = 'harvest_start' | 'harvest' | 'harvest_amount'

const KIND_BUTTONS: { kind: Kind; label: string }[] = [
  { kind: 'spray', label: '약' },
  { kind: 'top_dressing', label: '비료' }, // 9단계 전에는 "웃거름". 기록 종류(top_dressing)는 그대로
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

/** 직접 적는 문제 이름의 최대 글자 수. 목록 배지가 한 줄을 넘지 않게 */
const PROBLEM_NAME_MAX_LENGTH = 10

/** 적은 문제 이름 → 문제. 배수·균사 이름("배수 불량")과 같으면 그 문제로 본다. 비었으면 null */
function toProblem(typed: string): Problem | null {
  const name = typed.trim()
  if (name === '') return null
  const preset = PROBLEMS.find((p) => PROBLEM_TAG[p].label === name)
  return preset === undefined ? { kind: 'other', name } : { kind: preset }
}

/** 숫자만 남긴다 (최대 maxLength자리). 숫자 칸에 다른 글자가 들어가지 않게 */
function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength)
}

/** 소수점 아래 한 자리까지의 숫자만 남긴다 (정수 부분은 최대 maxLength자리). "1.5"처럼. 쉼표는 소수점으로 본다 */
function decimalOnly(value: string, maxLength: number): string {
  const [whole, ...rest] = value.replace(',', '.').replace(/[^\d.]/g, '').split('.')
  const int = whole.slice(0, maxLength)
  return rest.length === 0 ? int : `${int}.${rest.join('').slice(0, 1)}`
}

/** 적은 양 → 숫자. 비었거나 0이면 null (안 적은 것으로 본다) */
function toAmount(typed: string): number | null {
  const n = Number(typed)
  return typed === '' || !Number.isFinite(n) || n <= 0 ? null : n
}

/** 비료 포 수 버튼. 이보다 많으면 칸에 적는다 */
const BAG_CHOICES = [0.5, 1, 2, 3]

/** 고르는 버튼. 고른 것은 초록 테두리. aria-pressed로 화면 읽기 기능에도 "선택됨"을 알린다 */
function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="choice" aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  )
}

/**
 * 약·비료 이름 고르기·적기 (안 적어도 된다). 지난 기록의 이름(known)은 버튼으로 고르고, 다시 누르면 풀린다.
 * 처음 쓰는 이름은 아래 칸에 적는다.
 * 버튼으로 고르면 onPick(풀면 ''), 칸에 적으면 onChange를 부른다 (고를 때만 양을 미리 채우려고 나눈다)
 */
function NamePicker({
  id,
  what,
  known,
  firstTimeHint,
  value,
  onChange,
  onPick,
}: {
  id: string
  what: string // "약", "비료"
  known: string[]
  firstTimeHint: string // 고를 이름이 있을 때 적는 칸의 안내 글자
  value: string
  onChange: (value: string) => void
  onPick: (name: string) => void
}) {
  return (
    <>
      <label className="field-label" htmlFor={id}>
        {what} 이름 <span className="field-hint">(안 적어도 돼요)</span>
      </label>
      {known.length > 0 && (
        <div className="chips">
          {known.map((name) => (
            <Choice key={name} selected={value.trim() === name} onClick={() => onPick(value.trim() === name ? '' : name)}>
              {name}
            </Choice>
          ))}
        </div>
      )}
      <input
        id={id}
        className="text-input"
        type="text"
        placeholder={known.length > 0 ? firstTimeHint : `${what} 이름`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </>
  )
}

/** ml 적기 (정수, 안 적어도 된다): [ 20 ] ml */
function MlField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <>
      <label className="field-label" htmlFor={id}>
        {label} <span className="field-hint">(안 적어도 돼요)</span>
      </label>
      <div className="amounts">
        <label>
          <input
            id={id}
            className="text-input"
            inputMode="numeric"
            placeholder="0"
            value={value}
            onChange={(e) => onChange(digitsOnly(e.target.value, 5))}
          />
          ml
        </label>
      </div>
    </>
  )
}

/** 비료 포 수 (소수도, 안 적어도 된다). [반 포][1포][2포][3포]를 누르거나, 그보다 많으면 칸에 적는다 */
function BagsField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const bags = toAmount(value)
  return (
    <>
      <label className="field-label" htmlFor="bags">
        양 <span className="field-hint">(안 적어도 돼요)</span>
      </label>
      <div className="choices choices-4">
        {BAG_CHOICES.map((n) => (
          <Choice key={n} selected={bags === n} onClick={() => onChange(bags === n ? '' : String(n))}>
            {formatBags(n)}
          </Choice>
        ))}
      </div>
      <div className="amounts">
        <label>
          <input
            id="bags"
            className="text-input"
            inputMode="decimal"
            placeholder="다른 양"
            value={value}
            onChange={(e) => onChange(decimalOnly(e.target.value, 3))}
          />
          포
        </label>
      </div>
    </>
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
  const [fertilizer, setFertilizer] = useState('')
  const [amount, setAmount] = useState('') // 약·관비는 ml, 비료는 포. 종류를 바꾸면 비운다 (단위가 달라서)
  const [harvestStep, setHarvestStep] = useState<HarvestStep | null>(null)
  const [cycleDays, setCycleDays] = useState(String(DEFAULT_CYCLE_DAYS))
  const [boxes, setBoxes] = useState('')
  const [bunches, setBunches] = useState('')
  const [problem, setProblem] = useState<Problem | null>(null)
  const [problemName, setProblemName] = useState('') // "다른 문제" 칸에 적은 글자
  const [resolved, setResolved] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const detailRef = useRef<HTMLElement>(null) // 종류를 고르면 나타나는 자세한 내용 카드
  const dateInputRef = useRef<HTMLInputElement>(null) // 투명하게 덮어 둔 진짜 날짜 칸

  // 고른 뒤 새로 나타난 내용이 화면 아래(저장 버튼 뒤)에 숨지 않도록 보이는 곳까지 스크롤한다
  // 문제는 "골랐는지"만 본다. 이름을 적을 때마다 스크롤하지 않게 (글자마다 problem이 새 값이 된다)
  const problemChosen = problem !== null
  useEffect(() => {
    detailRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [kind, harvestStep, problemChosen])

  const currentProblems = getHouseStatus(records, house.no, today).problems
  /** 문제 버튼: 배수·균사, 그다음 전에 직접 적은 문제 (최근 순) */
  const problemChoices: Problem[] = [
    ...PROBLEMS.map((kind): Problem => ({ kind })),
    ...problemNames(records).map((name): Problem => ({ kind: 'other', name })),
  ]
  const isCurrent = (p: Problem) => currentProblems.some((c) => problemKey(c) === problemKey(p))
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

    const used = toAmount(amount)
    switch (kind) {
      case 'spray': {
        const name = pesticide.trim()
        return {
          record: { ...base, type: 'spray', pesticide: name || null, amount_ml: used },
          label: name ? `약(${name})` : '약',
        }
      }
      case 'top_dressing': {
        const name = fertilizer.trim()
        return {
          record: { ...base, type: 'top_dressing', fertilizer: name || null, bags: used },
          label: name ? `비료(${name})` : '비료',
        }
      }
      case 'fertigation': {
        const name = fertilizer.trim()
        return {
          record: { ...base, type: 'fertigation', fertilizer: name || null, amount_ml: used },
          label: name ? `관비(${name})` : '관비',
        }
      }
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
      case 'problem': {
        if (problem === null || resolved === null) return null
        const record: NewRecord =
          problem.kind === 'other'
            ? { ...base, type: 'problem', problem: 'other', problem_name: problem.name, resolved }
            : { ...base, type: 'problem', problem: problem.kind, resolved }
        return { record, label: `${problemTag(problem).label} ${resolved ? '해결됨' : '생김'}` }
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

  /** 날짜 상자를 누르면 달력을 연다. 폰은 투명한 날짜 칸이 직접 눌렸으면 브라우저가 이미 열었으므로 그대로 둔다.
      PC(마우스)는 날짜 칸을 눌러도 달력 아이콘이 아니면 안 열려서, 그때도 직접 연다 */
  function openDatePicker(e: MouseEvent<HTMLDivElement>) {
    const input = dateInputRef.current
    if (input === null) return
    const inputClicked = e.target === input
    if (inputClicked && !window.matchMedia('(pointer: fine)').matches) return
    try {
      input.showPicker() // 달력 열기 (최근 브라우저)
    } catch {
      // showPicker가 없는 옛 브라우저: 날짜 칸을 누른 것처럼 한다.
      // 날짜 칸이 눌린 경우는 하지 않는다. 아래 click()이 다시 여기로 와서 끝없이 반복되기 때문이다
      if (inputClicked) return
      input.focus()
      input.click()
    }
  }

  /**
   * 종류를 고른다. 다른 종류로 바꾸면 적던 비료 이름과 양은 비운다
   * (비료 이름이 관비 기록에 들어가지 않게, 약 ml가 비료 포 수로 들어가지 않게)
   */
  function chooseKind(k: Kind) {
    if (k !== kind) {
      setFertilizer('')
      setAmount('')
    }
    setKind(k)
  }

  /**
   * 지난 약·비료 이름을 버튼으로 고른다. 그 이름으로 마지막에 적은 양을 미리 채운다 (적은 적이 없으면 비운다).
   * 고른 이름을 풀면(name = '') 양은 그대로 둔다
   */
  function pickName(type: AmountType, name: string, setName: (name: string) => void) {
    setName(name)
    if (name === '') return
    const last = lastUsedAmount(records, type, name)
    setAmount(last === null ? '' : String(last))
  }

  /** 문제를 고르면 "생김 / 해결됨"을 지금 상태의 반대로 미리 골라 둔다 (지금 있으면 해결됨, 없으면 생김) */
  function chooseProblem(p: Problem) {
    setProblem(p)
    setProblemName(p.kind === 'other' ? p.name : '') // 전에 적은 문제를 고르면 그 이름이 칸에도 들어간다 (약 이름과 같게)
    setResolved(isCurrent(p))
  }

  /** "다른 문제" 칸에 적으면 그 이름이 고른 문제가 된다. 전에 적은 이름과 같으면 그 버튼이 함께 골라진다 */
  function typeProblemName(typed: string) {
    const p = toProblem(typed)
    setProblemName(typed)
    setProblem(p)
    setResolved(p === null ? null : isCurrent(p))
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
        <section className="form-card">
          <label className="field-label" htmlFor="work-date">
            날짜
            {dateOk && <span className="field-hint"> {relativeDay(workDate, today)}</span>}
          </label>
          {/* 날짜 글자는 직접 그린다 ("10월 22일 (목)"). 폰 브라우저가 그리는 날짜 칸 글자는 폰마다 모양이 달라
              좁은 폰에서 두 줄로 꺾였다. 진짜 날짜 칸은 투명하게 위에 덮어서, 누르면 폰의 달력이 그대로 열린다.
              폰에 따라 투명한 칸이 상자 전체를 덮지 못해서("바꾸기"가 안 눌림), 상자 어디를 눌러도 달력을 직접 연다 */}
          <div className="text-input date-field" onClick={openDatePicker}>
            <span>{workDate === '' ? '날짜를 골라 주세요' : formatDate(workDate)}</span>
            <span className="date-change">바꾸기</span>
            <input
              ref={dateInputRef}
              id="work-date"
              type="date"
              value={workDate}
              max={today}
              onChange={(e) => setWorkDate(e.target.value)}
            />
          </div>
          {!dateOk && <p className="field-error">오늘이나 지난 날짜를 골라 주세요</p>}
        </section>

        <section className="form-card">
          <h2 className="field-label">무엇을 했나요?</h2>
          <div className="choices choices-3">
            {KIND_BUTTONS.map((b) => (
              <Choice key={b.kind} selected={kind === b.kind} onClick={() => chooseKind(b.kind)}>
                {b.label}
              </Choice>
            ))}
          </div>
        </section>

        {kind === 'spray' && (
          <section className="form-card" ref={detailRef}>
            <NamePicker
              id="pesticide"
              what="약"
              known={pesticideNames(records)}
              firstTimeHint="처음 치는 약이면 적어 주세요"
              value={pesticide}
              onChange={setPesticide}
              onPick={(name) => pickName('spray', name, setPesticide)}
            />
            <MlField id="amount-ml" label="원액 양" value={amount} onChange={setAmount} />
          </section>
        )}

        {(kind === 'top_dressing' || kind === 'fertigation') && (
          <section className="form-card" ref={detailRef}>
            <NamePicker
              id="fertilizer"
              what="비료"
              known={fertilizerNames(records, kind)}
              firstTimeHint="처음 쓰는 비료면 적어 주세요"
              value={fertilizer}
              onChange={setFertilizer}
              onPick={(name) => pickName(kind, name, setFertilizer)}
            />
            {kind === 'top_dressing' ? (
              <BagsField value={amount} onChange={setAmount} />
            ) : (
              <MlField id="amount-ml" label="원액 양" value={amount} onChange={setAmount} />
            )}
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
              {problemChoices.map((p) => (
                <Choice
                  key={problemKey(p)}
                  selected={problem !== null && problemKey(problem) === problemKey(p)}
                  onClick={() => chooseProblem(p)}
                >
                  <span aria-hidden="true">{problemTag(p).icon}</span> {problemTag(p).label}
                  <small>{isCurrent(p) ? '지금 있음' : '지금 없음'}</small>
                </Choice>
              ))}
            </div>
            <label className="field-label" htmlFor="problem-name">
              다른 문제 <span className="field-hint">({PROBLEM_NAME_MAX_LENGTH}자까지)</span>
            </label>
            <input
              id="problem-name"
              className="text-input"
              type="text"
              maxLength={PROBLEM_NAME_MAX_LENGTH}
              placeholder="처음 생긴 문제면 적어 주세요"
              value={problemName}
              onChange={(e) => typeProblemName(e.target.value)}
            />
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
