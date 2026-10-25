import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './App.css'
import { HOUSES } from './config/houses'
import { getCurrentUser } from './data/auth'
import { removeTestRecords, useProfiles, useRecords } from './data/recordRepository'
import { startSync } from './data/syncService'
import { todayInKorea } from './domain/today'
import History from './pages/History'
import HouseList from './pages/HouseList'
import Login from './pages/Login'
import RecordForm from './pages/RecordForm'

/** 지금 화면. null이면 목록, 아니면 그 동의 기록 입력(form) 또는 이력(history) */
type Screen = { houseNo: number; view: 'form' | 'history' } | null

/** 브라우저 방문 기록(history)에 넣어 둔 값에서 화면을 꺼낸다 */
function screenFromHistory(state: unknown): Screen {
  const s = state as { houseNo?: unknown; view?: unknown } | null
  if (typeof s?.houseNo !== 'number') return null
  return { houseNo: s.houseNo, view: s.view === 'history' ? 'history' : 'form' }
}

// 화면 전환: 목록 → (동을 누름) 기록 입력 → ("지난 기록") 이력.
// 화면이 셋뿐이라 라우터 라이브러리 없이, 지금 화면 값 하나(screen)로 어떤 화면을 그릴지 정한다.
// 열 때 history.pushState로 방문 기록을 하나 쌓아서, 폰의 "뒤로 가기" 버튼을 누르면 앱이 꺼지지 않고 한 화면씩 돌아온다.
function App() {
  const today = todayInKorea()
  const records = useRecords()
  const profiles = useProfiles()
  // 이 폰에서 로그인한 사람. 인터넷이 끊겨 있어도 폰에 적어 둔 값이라 바로 읽힌다 (data/auth.ts)
  const [user, setUser] = useState(getCurrentUser)
  // 새로고침해도 보던 화면이 유지되도록 방문 기록에서 처음 값을 읽는다
  const [screen, setScreen] = useState(() => screenFromHistory(history.state))
  const [message, setMessage] = useState<string | null>(null)
  const listScrollY = useRef(0) // 목록에서 보던 위치. 기록 화면에서 돌아오면 여기로 되돌린다

  // 뒤로 가기(폰 버튼, "‹ 목록" 같은 화면 버튼 모두)는 popstate 이벤트로 들어온다
  useEffect(() => {
    history.scrollRestoration = 'manual' // 스크롤 위치는 아래에서 직접 맞춘다
    const onPopState = (e: PopStateEvent) => setScreen(screenFromHistory(e.state))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // 로그인되어 있으면 서버와 주고받는다 (올리기 → 내려받기 → 이름 받기):
  // 앱을 열 때(로그인 직후 포함) 한 번, 인터넷이 다시 연결될 때와 앱 화면으로 돌아올 때마다
  useEffect(() => {
    if (user === null) return
    return startSync()
  }, [user])

  // 화면이 바뀐 직후(그리기 전) 스크롤을 맞춘다: 목록은 보던 자리, 다른 화면은 맨 위
  const screenKey = screen === null ? 'list' : `${screen.view}-${screen.houseNo}`
  useLayoutEffect(() => {
    window.scrollTo(0, screenKey === 'list' ? listScrollY.current : 0)
  }, [screenKey])

  // 알림은 3초 뒤 사라진다
  useEffect(() => {
    if (message === null) return
    const timer = setTimeout(() => setMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [message])

  /** 새 화면을 방문 기록에 쌓고 연다 */
  function open(next: NonNullable<Screen>) {
    if (screen === null) listScrollY.current = window.scrollY
    setMessage(null) // 알림이 다음 화면의 버튼을 가리지 않게
    history.pushState(next, '')
    setScreen(next)
  }

  function handleSaved(text: string) {
    setMessage(text)
    history.back() // popstate가 일어나 목록으로 돌아간다
  }

  /** 로그인 직후: 로그인 전에 넣은 시험 기록을 지우고 목록을 연다 */
  async function handleLoggedIn() {
    await removeTestRecords()
    setUser(getCurrentUser())
  }

  if (user === null) return <Login onLoggedIn={handleLoggedIn} />

  // IndexedDB에서 처음 읽는 동안은 아무것도 그리지 않는다 (아주 잠깐이다)
  if (records === undefined) return null

  const house = HOUSES.find((h) => h.no === screen?.houseNo)

  return (
    <>
      {screen === null || house === undefined ? (
        <HouseList
          houses={HOUSES}
          records={records}
          today={today}
          onSelectHouse={(no) => open({ houseNo: no, view: 'form' })}
        />
      ) : screen.view === 'form' ? (
        <RecordForm
          key={house.no}
          house={house}
          records={records}
          today={today}
          onSaved={handleSaved}
          onCancel={() => history.back()}
          onOpenHistory={() => open({ houseNo: house.no, view: 'history' })}
        />
      ) : (
        <History
          house={house}
          records={records}
          profiles={profiles ?? []}
          today={today}
          onBack={() => history.back()}
          onCanceled={setMessage}
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
