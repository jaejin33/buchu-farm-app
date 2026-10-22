import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './App.css'
import { HOUSES } from './config/houses'
import { useRecords } from './data/recordRepository'
import { todayInKorea } from './domain/today'
import HouseList from './pages/HouseList'
import RecordForm from './pages/RecordForm'

/** 브라우저 방문 기록(history)에 넣어 둔 값에서 열린 동 번호를 꺼낸다. 목록 화면이면 null */
function houseNoFromHistory(state: unknown): number | null {
  const houseNo = (state as { houseNo?: unknown } | null)?.houseNo
  return typeof houseNo === 'number' ? houseNo : null
}

// 화면 전환: 목록에서 동을 누르면 기록 화면을 연다.
// 화면이 둘뿐이라 라우터 라이브러리 없이, 열린 동 번호 하나(houseNo)로 어떤 화면을 그릴지 정한다.
// 열 때 history.pushState로 방문 기록을 하나 쌓아서, 폰의 "뒤로 가기" 버튼을 누르면 앱이 꺼지지 않고 목록으로 돌아온다.
function App() {
  const today = todayInKorea()
  const records = useRecords()
  // 새로고침해도 보던 화면이 유지되도록 방문 기록에서 처음 값을 읽는다
  const [houseNo, setHouseNo] = useState(() => houseNoFromHistory(history.state))
  const [message, setMessage] = useState<string | null>(null)
  const listScrollY = useRef(0) // 목록에서 보던 위치. 기록 화면에서 돌아오면 여기로 되돌린다

  // 뒤로 가기(폰 버튼, "‹ 목록" 버튼 모두)는 popstate 이벤트로 들어온다
  useEffect(() => {
    history.scrollRestoration = 'manual' // 스크롤 위치는 아래에서 직접 맞춘다
    const onPopState = (e: PopStateEvent) => setHouseNo(houseNoFromHistory(e.state))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // 화면이 바뀐 직후(그리기 전) 스크롤을 맞춘다: 기록 화면은 맨 위, 목록은 보던 자리
  useLayoutEffect(() => {
    window.scrollTo(0, houseNo === null ? listScrollY.current : 0)
  }, [houseNo])

  // 저장 알림은 3초 뒤 사라진다
  useEffect(() => {
    if (message === null) return
    const timer = setTimeout(() => setMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [message])

  function openHouse(no: number) {
    listScrollY.current = window.scrollY
    setMessage(null) // 알림이 기록 화면의 저장 버튼을 가리지 않게
    history.pushState({ houseNo: no }, '')
    setHouseNo(no)
  }

  function handleSaved(text: string) {
    setMessage(text)
    history.back() // popstate가 일어나 목록으로 돌아간다
  }

  // IndexedDB에서 처음 읽는 동안은 아무것도 그리지 않는다 (아주 잠깐이다)
  if (records === undefined) return null

  const house = HOUSES.find((h) => h.no === houseNo)

  return (
    <>
      {house === undefined ? (
        <HouseList houses={HOUSES} records={records} today={today} onSelectHouse={openHouse} />
      ) : (
        <RecordForm
          key={house.no}
          house={house}
          records={records}
          today={today}
          onSaved={handleSaved}
          onCancel={() => history.back()}
        />
      )}
      {message !== null && (
        <p className="toast" role="status">
          {message}
        </p>
      )}
    </>
  )
}

export default App
