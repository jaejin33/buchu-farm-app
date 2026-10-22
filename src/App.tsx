import { HOUSES } from './config/houses'
import { makeFakeRecords } from './data/fakeRecords'
import { todayInKorea } from './domain/today'
import HouseList from './pages/HouseList'

function App() {
  const today = todayInKorea()
  // 2단계: 가짜 기록. 3단계에서 recordRepository(IndexedDB)로 바꾼다
  const records = makeFakeRecords(today)

  return <HouseList houses={HOUSES} records={records} today={today} />
}

export default App
