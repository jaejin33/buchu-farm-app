# React 컴포넌트와 props

앱 2단계 하우스 목록 화면(`src/pages/HouseList.tsx`)에서 쓴 방식이다. Spring MVC + Thymeleaf로 화면을 만들어 본 입장에서 정리한다.

## 1. 한 줄 요약

**컴포넌트는 "데이터를 받아서 화면(HTML)을 돌려주는 함수"다.** 함수가 받는 데이터를 **props**라고 부른다.

Spring으로 치면 컨트롤러가 `Model`에 값을 담아 넘기면 Thymeleaf 템플릿이 HTML을 그리는 흐름과 같다. React에서는 템플릿 파일이 따로 없고, 그 템플릿 자체가 TypeScript 함수다.

| React (이 프로젝트) | Spring MVC + Thymeleaf |
|---|---|
| `App.tsx`가 데이터를 준비해 `<HouseList ... />`에 넘김 | 컨트롤러가 `model.addAttribute(...)` 후 `return "houseList"` |
| `HouseList` 컴포넌트 (함수) | `houseList.html` 템플릿 |
| props (`houses`, `records`, `today`) | Model 속성 (`${houses}`, `${records}`) |
| 컴포넌트를 다른 컴포넌트 안에서 `<HouseList />`로 씀 | `th:replace="~{fragments :: houseList(houses)}"` 파라미터 있는 프래그먼트 |

## 2. 이 프로젝트의 흐름

```
App.tsx
  today = todayInKorea()            ← 한국 시간 오늘 (src/domain/today.ts)
  records = makeFakeRecords(today)  ← 2단계: 가짜 기록. 3단계에서 IndexedDB로 바뀐다
  <HouseList houses={HOUSES} records={records} today={today} />
          ↓ props
HouseList.tsx
  동마다 getHouseStatus(records, house.no, today) 계산 → 카드로 그림
```

**핵심: `HouseList`는 기록이 어디서 왔는지 모른다.** 받은 걸 그리기만 한다. 그래서 3단계에서 가짜 기록을 IndexedDB에서 읽은 기록으로 바꿔도 `App.tsx`만 고치면 된다.

Spring에서 템플릿이 DB를 직접 조회하지 않고 컨트롤러가 넘겨준 `Model`만 쓰는 것과 같은 이유다. 템플릿(화면)과 데이터 조회(리포지토리)를 나눈다. → [[결정기록]] "화면은 기록을 props로 받는다"

## 3. 코드 읽기

### props 타입 정하기

```tsx
interface Props {
  houses: readonly House[]
  records: readonly FarmRecord[]
  today: string
}

export default function HouseList({ houses, records, today }: Props) {
  ...
}
```

- `interface Props`는 "이 컴포넌트가 받는 데이터 목록"이다. Java의 DTO 클래스나 `record HouseListModel(List<House> houses, ...)`와 같다
- `{ houses, records, today }: Props`는 **구조 분해**다. props 객체를 통째로 받은 뒤 `props.houses`처럼 꺼내 쓰는 대신, 받는 자리에서 바로 꺼낸다
- `readonly House[]`는 "이 배열을 고치지 않겠다"는 표시다. Java의 `List.copyOf(...)`나 `Collections.unmodifiableList`에 가깝다
- `export default`: 이 파일의 대표 하나를 내보낸다. 가져올 때 중괄호 없이 `import HouseList from './pages/HouseList'`로 쓴다. 이름을 붙여 내보내는 `export function`이면 `import { HouseList } from ...`로 가져온다

부르는 쪽(`App.tsx`)에서는 HTML 속성처럼 넘긴다.

```tsx
<HouseList houses={HOUSES} records={records} today={today} />
```

TypeScript가 `Props`와 비교해 본다. `today`를 빼먹거나 숫자를 넣으면 빌드할 때 에러가 난다. Thymeleaf는 `${today}`가 비어 있어도 실행 중에 조용히 빈칸이 되는데, 이 부분이 다르다.

### 화면을 돌려주는 부분 (JSX)

함수가 `return`하는 HTML처럼 생긴 코드를 **JSX**라고 한다. 진짜 HTML이 아니라 TypeScript 안에 쓰는 문법이다. 그래서 `.ts`가 아니라 `.tsx` 파일에 쓴다.

```tsx
return (
  <main className="house-list">
    <header className="house-list-header">
      <h1>부추 하우스</h1>
      <p className="today">{formatToday(today)}</p>
    </header>
    ...
  </main>
)
```

HTML·Thymeleaf와 다른 점:

| JSX | HTML / Thymeleaf |
|---|---|
| `className="..."` | `class="..."` (`class`는 JS 예약어라 이름이 다르다) |
| `{formatToday(today)}` 중괄호 안에 TS 코드 | `th:text="${...}"` |
| `{조건 && <div>...</div>}` | `th:if="${조건}"` |
| `{목록.map((x) => <li key={x.no}>...</li>)}` | `th:each="x : ${목록}"` |
| 태그는 반드시 닫는다 `<HouseList />` | `<br>`처럼 안 닫아도 됨 |

### 반복: `map`과 `key`

```tsx
{rows
  .filter((row) => row.house.zone === zone)
  .map(({ house, status }) => (
    <li key={house.no} className={`house-card status-${status.kind}`}>
      ...
    </li>
  ))}
```

- `(row) => row.house.zone === zone`은 **화살표 함수**다. Java 람다 `row -> row.house().zone().equals(zone)`과 같다
- `===`는 JS의 "같다" 비교다. `==`는 타입을 멋대로 바꿔서 비교하므로(`1 == '1'`이 true) 쓰지 않는다
- `.filter(...).map(...)`은 Java Stream의 `.filter(...).map(...)`과 같다. 다만 `.toList()` 없이 바로 배열이 나온다
- `key={house.no}`: 반복으로 만든 항목마다 **겹치지 않는 값**을 붙인다. React가 화면을 다시 그릴 때 "어느 카드가 어느 동인지" 알아보는 데 쓴다. 빼먹으면 브라우저 콘솔에 경고가 뜬다. Thymeleaf에는 대응하는 게 없다 (서버가 HTML을 매번 새로 만들기 때문)
- `` className={`house-card status-${status.kind}`} ``: 백틱 `` ` ``으로 감싼 **템플릿 문자열**이다. `status.kind`가 `'ready'`면 `"house-card status-ready"`가 된다. Thymeleaf의 `th:classappend="'status-' + ${status.kind}"`와 같은 역할이다. CSS에서 `.status-ready`에 초록색을 지정해 두었다

### 조건부 표시: `&&`

```tsx
{status.daysLeft !== null && <div className="house-dday">D-{status.daysLeft}</div>}
```

`A && B`는 "A가 참이면 B를 그린다"는 뜻이다. D-n은 🔴 약 대기, 🟡 자라는 중일 때만 값이 있으니 그때만 보인다. `th:if="${status.daysLeft != null}"`와 같다.

### 고정된 값 짝 짓기: `Record<K, V>`

```tsx
const STATUS_LABEL: Record<HouseStatusKind, string> = {
  spray_wait: '🔴 약 대기',
  growing: '🟡 자라는 중',
  ready: '🟢 수확 가능',
  no_record: '⚪ 기록 없음',
}
```

TypeScript 내장 타입 `Record<K, V>`는 "K의 모든 값마다 V가 하나씩 있는 객체"다. Java의 `EnumMap<HouseStatusKind, String>`과 같다. 상태를 하나 추가하고 여기에 라벨을 빠뜨리면 빌드 에러가 난다. (기록 타입 이름을 `Record` 대신 `FarmRecord`로 한 이유가 바로 이 내장 타입과 이름이 겹치기 때문이다 → [[2026-10-22-TypeScript-구별된-유니온]])

### 정렬: 비교 함수

```tsx
rows.sort((a, b) => {
  if (a.date === b.date) return a.house.no - b.house.no
  if (a.date === null) return 1      // 날짜 모르는 동은 뒤로
  if (b.date === null) return -1
  return a.date < b.date ? -1 : 1
})
```

Java의 `Comparator`와 규칙이 같다. 음수면 a가 앞, 양수면 b가 앞이다. Java로 쓰면 이렇다.

```java
rows.sort(Comparator
    .comparing(Row::date, Comparator.nullsLast(Comparator.naturalOrder()))
    .thenComparingInt(r -> r.house().no()));
```

JS에는 `nullsLast` 같은 도우미가 없어서 직접 썼다.

### 중복 없는 구역 목록

```tsx
const zones = [...new Set(houses.map((h) => h.zone))]
```

- `houses.map((h) => h.zone)`: 25동의 구역 이름 배열 (`['1구역', '1구역', ..., '6구역']`)
- `new Set(...)`: 중복 제거. Java의 `new LinkedHashSet<>(...)`처럼 **처음 나온 순서를 지킨다**. 그래서 구역 순서가 `houses.ts`에 적은 순서가 된다
- `[...set]`: **전개 문법**으로 Set을 다시 배열로 바꾼다. `new ArrayList<>(set)`과 같다

### CSS 파일 가져오기

```tsx
import './HouseList.css'
```

CSS 파일을 `import`하면 Vite가 페이지에 넣어 준다. Spring에서 `<link rel="stylesheet" th:href="@{/css/houseList.css}">`를 쓰는 것과 같다. 다만 이 CSS는 이 화면 전용이 아니라 앱 전체에 적용되므로 클래스 이름이 겹치지 않게 `house-` 같은 앞글자를 붙였다.

## 4. Spring과 크게 다른 점 하나

Thymeleaf는 **서버**가 HTML을 만들어 보낸다. 데이터가 바뀌면 페이지를 새로 요청해야 한다.

React는 **폰 브라우저 안에서** 함수를 실행해 화면을 만든다. 서버에 묻지 않으므로 인터넷이 끊겨도 화면이 그려진다. 이 앱이 오프라인에서 동작해야 하는 이유와 이어진다. 데이터가 바뀌면 React가 함수를 다시 실행해 바뀐 부분만 고친다. 이 "데이터가 바뀌면 다시 그리기"는 3단계에서 기록을 저장할 때 처음 쓰게 된다.

## 관련

- [[2026-10-22-TypeScript-구별된-유니온]]
- [[2026-10-22-Vitest-테스트와-순수-함수]]
- [[2026-10-22-CSS-rem-단위]]
- [[2026-10-22-Vite-개발-서버와-화면-확인]]
- [[결정기록]]
