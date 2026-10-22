# React 상태(state)와 이벤트

앱 3단계 기록 입력 화면(`src/pages/RecordForm.tsx`)과 화면 전환(`src/App.tsx`)에서 쓴 방식이다. 2단계 목록 화면은 받은 데이터를 그리기만 했다([[2026-10-22-React-컴포넌트와-props]]). 3단계 화면은 **사람이 누르고 적는 것을 기억했다가 그에 맞게 다시 그린다.** 그 "기억"이 상태(state)다.

## 1. 한 줄 요약

**상태는 "컴포넌트가 기억하는 값"이고, 상태를 바꾸면 React가 그 컴포넌트 함수를 다시 실행해 화면을 새로 그린다.**

Spring MVC + Thymeleaf와 흐름을 비교하면 이렇다.

| 하는 일 | Spring MVC + Thymeleaf | React (이 프로젝트) |
|---|---|---|
| 사람이 버튼을 누름 | 브라우저가 서버에 요청 (`POST /records`) | 브라우저 안에서 함수 실행 (`onClick`) |
| 고른 값 기억 | 서버 세션이나 hidden input에 담아 다시 보냄 | `useState`로 브라우저 안에 기억 |
| 화면 다시 그리기 | 서버가 HTML을 새로 만들어 보냄 (페이지 전체 새로 고침) | React가 함수를 다시 실행해 **바뀐 부분만** 고침 |
| 인터넷이 끊기면 | 아무것도 안 됨 | 그대로 동작 (서버에 묻지 않음) |

"종류를 고르면 약 이름 칸이 나타난다" 같은 일을 서버 없이 바로 하려면 이 방식이 필요하다. 비닐하우스 안에서 인터넷이 끊겨도 입력이 되어야 하기 때문이다.

## 2. `useState`: 기억하는 값 만들기

```tsx
const [kind, setKind] = useState<Kind | null>(null)
const [pesticide, setPesticide] = useState('')
```

- `useState(처음 값)`은 **[지금 값, 값을 바꾸는 함수]** 두 개짜리 배열을 돌려준다
- `const [kind, setKind] = ...`는 **배열 구조 분해**다. 배열의 0번을 `kind`, 1번을 `setKind`에 넣는다. Java에는 이 문법이 없어서, 굳이 쓰면 이런 모양이다

  ```java
  record State<T>(T value, Consumer<T> setter) {}
  State<Kind> s = useState(null);
  Kind kind = s.value();
  Consumer<Kind> setKind = s.setter();
  ```

- `useState<Kind | null>(null)`: `<...>`는 제네릭이다. "이 상태는 `Kind`이거나 `null`"이라고 알려 준다. 처음 값이 `null`뿐이면 TS가 "항상 null"로 착각하기 때문에 적었다. `useState('')`처럼 처음 값으로 타입을 알 수 있으면 안 적는다
- 이름은 관례상 `값`과 `set값`으로 짓는다. Java의 getter/setter 이름 짓기와 비슷하다

### 상태를 바꾸면 무슨 일이 생기나

```tsx
<Choice selected={kind === 'spray'} onClick={() => setKind('spray')}>약</Choice>
...
{kind === 'spray' && <section>약 이름 칸</section>}
```

1. [약]을 누르면 `setKind('spray')`가 불린다
2. React가 `RecordForm` 함수를 **처음부터 다시 실행한다.** 이번에는 `kind`가 `'spray'`다
3. 그래서 [약] 버튼은 `selected`가 true(초록)가 되고, 약 이름 칸이 나타난다
4. React가 이전 화면과 비교해 **달라진 부분만** 실제 화면에 고친다

**주의: 상태는 직접 바꾸지 않는다.** `kind = 'spray'`처럼 쓰면 값은 바뀌어도 React가 모르기 때문에 화면이 그대로다. 반드시 `setKind(...)`를 쓴다. Java Swing에서 필드를 바꾼 뒤 `repaint()`를 불러야 화면이 바뀌는 것과 비슷한데, React는 `set...` 하나가 둘을 같이 한다.

### 처음 값을 함수로 주기

```tsx
const [houseNo, setHouseNo] = useState(() => houseNoFromHistory(history.state))
```

`useState(값)` 대신 `useState(() => 값)`으로 쓰면 **처음 한 번만** 그 함수를 실행한다. 함수 컴포넌트는 다시 그릴 때마다 처음부터 실행되는데, 처음 값 계산은 다시 할 필요가 없어서다. (`() => ...`는 인자 없는 화살표 함수다. Java의 `() -> ...` 람다)

## 3. 이벤트와 입력 칸

### 누르기: `onClick`

```tsx
<button type="button" onClick={() => setKind('spray')}>약</button>
```

HTML의 `<button onclick="...">`과 같은데, 글자가 아니라 **함수**를 넘긴다. `onClick={setKind('spray')}`처럼 괄호까지 쓰면 그 자리에서 바로 실행되어 버리므로, `() => ...`로 감싸 "누르면 실행할 함수"를 넘긴다. Java Swing의 `button.addActionListener(e -> setKind(SPRAY))`와 같다.

### 적기: `value` + `onChange`

```tsx
<input value={pesticide} onChange={(e) => setPesticide(e.target.value)} />
```

- `value={pesticide}`: 칸에 보이는 글자는 **항상 상태 값**이다
- `onChange`: 글자를 칠 때마다 불린다. `e.target.value`가 칸의 새 글자다. 그걸 상태에 넣으면 → 다시 그려지고 → 칸에 보인다
- 이렇게 상태와 칸을 묶은 걸 **제어 컴포넌트(controlled input)**라고 한다. Thymeleaf의 `th:field="*{pesticide}"`가 칸과 폼 객체를 묶는 것과 목적이 같다. 다만 Thymeleaf는 제출할 때 한 번 묶고, React는 한 글자마다 묶는다
- 그래서 **글자를 고쳐서 넣을 수 있다.** 숫자 칸은 이렇게 쓴다

  ```tsx
  onChange={(e) => setBoxes(digitsOnly(e.target.value, 4))}  // 숫자 아닌 글자는 지우고 넣음
  ```

- 약 이름 버튼을 누르면 `setPesticide('가약')`만 하면 칸에도 "가약"이 들어간다. 칸과 버튼이 같은 상태 하나를 보기 때문이다

## 4. 계산할 수 있는 값은 상태로 두지 않는다

```tsx
// 상태: 사람이 고르거나 적은 것만
const [workDate, setWorkDate] = useState(today)

// 계산값: 그릴 때마다 새로 계산
const knownPesticides = pesticideNames(records)
const dateOk = workDate !== '' && workDate <= today
const built = buildRecord()
```

약 목록이나 "저장할 수 있는지"를 상태로 두면, 기록이나 날짜가 바뀔 때마다 그 상태도 같이 고쳐 줘야 한다. 하나라도 잊으면 화면이 틀린다. **다른 값에서 계산할 수 있는 건 그냥 계산한다.** 함수가 다시 실행될 때마다 새로 계산되니 항상 맞다.

Spring으로 치면 DB에 "합계" 컬럼을 따로 두지 않고 조회할 때 `SUM`으로 계산하는 것과 같은 생각이다.

## 5. `useEffect`, `useLayoutEffect`, `useRef`, `key`

### `useEffect`: 그린 뒤에 할 일

화면 그리기와 상관없는 일(타이머, 이벤트 등록, 스크롤)은 `useEffect` 안에서 한다.

```tsx
useEffect(() => {
  if (message === null) return
  const timer = setTimeout(() => setMessage(null), 3000)  // 3초 뒤 알림 지우기
  return () => clearTimeout(timer)                          // 정리
}, [message])
```

- 첫 인자: 화면을 그린 **뒤에** 실행할 함수
- 둘째 인자 `[message]`: **이 값이 바뀔 때만** 다시 실행한다. 빈 배열 `[]`이면 처음 한 번만 실행한다
- 돌려주는 함수(`return () => ...`): **정리 함수**다. 다음 실행 전이나 화면에서 사라질 때 불린다. 알림이 3초 안에 또 바뀌면 이전 타이머를 취소한다. Spring의 `@PreDestroy`나 `try-with-resources`의 `close()`와 비슷하다
- App에서는 처음 한 번 `popstate`(뒤로 가기) 이벤트를 등록하고, 정리 함수에서 등록을 푼다 → [[2026-10-22-브라우저-history와-뒤로-가기]]

**개발 모드에서는 두 번 실행된다.** `main.tsx`의 `<StrictMode>`가 정리 함수를 빠뜨리지 않았는지 보려고 일부러 "실행 → 정리 → 실행"을 한다. 정리 함수를 제대로 쓰면 문제없다. 배포한 앱에서는 한 번이다.

### `useLayoutEffect`: 그리기 직전에 할 일

```tsx
useLayoutEffect(() => {
  window.scrollTo(0, houseNo === null ? listScrollY.current : 0)
}, [houseNo])
```

`useEffect`와 같은데 **화면이 사람 눈에 보이기 직전**에 실행된다. 스크롤을 `useEffect`로 맞추면 맨 위가 한 번 보였다가 내려가는 깜빡임이 생긴다. 화면 위치처럼 "보이기 전에 맞춰야 하는 것"에만 쓴다.

### `useRef`: 기억하지만 다시 그리지는 않는 값

```tsx
const listScrollY = useRef(0)
...
listScrollY.current = window.scrollY   // 바꿔도 화면을 다시 그리지 않음
```

- `useRef(처음 값)`은 `{ current: 값 }` 상자 하나를 준다. 다시 그려도 같은 상자가 유지된다
- `useState`와 다른 점: **바꿔도 다시 그리지 않는다.** 목록에서 보던 스크롤 위치는 화면에 보여 줄 값이 아니라 나중에 되돌아갈 때만 쓰므로 `useRef`가 맞다
- Java로 치면 화면 갱신과 상관없는 일반 필드다

**화면의 태그를 가리킬 때도 쓴다.**

```tsx
const detailRef = useRef<HTMLElement>(null)
...
<section className="form-card" ref={detailRef}>
...
detailRef.current?.scrollIntoView(...)   // 그 <section>으로 스크롤
```

`ref={detailRef}`를 붙이면 React가 그 태그를 `detailRef.current`에 넣어 준다. JS의 `document.getElementById(...)`로 찾는 것과 결과는 같은데, id를 붙이지 않아도 된다. 태그가 없을 때는 `null`이라 `?.`로 부른다 (`null`이면 아무것도 안 함).

### `key`로 처음부터 다시 시작하기

```tsx
<RecordForm key={house.no} house={house} ... />
```

[[2026-10-22-React-컴포넌트와-props]]에서 `key`는 반복 항목을 구분하는 데 썼다. 반복이 아닌 곳에 붙이면 **`key`가 바뀔 때 컴포넌트를 버리고 새로 만든다.** 그러면 상태도 모두 처음 값으로 돌아간다. 3동 기록 화면에서 고르던 것이 5동 화면에 남지 않게 하려는 것이다.

## 6. `async` / `await`: 기다려야 하는 일

IndexedDB에 저장하는 일은 바로 끝나지 않는다. JS는 화면을 멈추지 않으려고 **"끝나면 알려 줄게"라는 약속(`Promise`)**을 돌려준다.

```tsx
async function handleSubmit(e: FormEvent) {
  ...
  try {
    await addRecord(built.record)          // 저장이 끝날 때까지 여기서 기다림
    onSaved(`${house.no}동 ${built.label} 저장했어요`)
  } catch {
    setError('저장하지 못했어요. 다시 눌러 주세요.')
  }
}
```

- `async function`: 안에서 `await`를 쓸 수 있는 함수. 이 함수도 `Promise`를 돌려준다
- `await`: 약속이 끝날 때까지 **이 함수만** 기다린다. 그동안 화면은 멈추지 않는다
- `try` / `catch`: Java와 같다. 저장이 실패하면 `catch`로 온다. `catch` 뒤에 `(e)`를 안 쓴 건 에러 내용을 쓰지 않아서다
- Java로 치면 `CompletableFuture`를 `.join()`으로 기다리는 모양인데, 화면 스레드를 막지 않는다는 점이 다르다

| JS | Java |
|---|---|
| `Promise<FarmRecord>` | `CompletableFuture<FarmRecord>` |
| `await addRecord(x)` | `addRecord(x).join()` (단, JS는 화면을 멈추지 않음) |
| `async function f()` | `CompletableFuture<...> f()` |

## 7. 부모에게 알리기: 함수를 props로 넘기기

```tsx
// App.tsx
<RecordForm onSaved={handleSaved} onCancel={() => history.back()} ... />
<HouseList onSelectHouse={openHouse} ... />

// RecordForm.tsx 안
onSaved(`${house.no}동 ${built.label} 저장했어요`)
```

props로 데이터만 넘기는 게 아니라 **함수도 넘긴다.** 기록 화면은 저장한 뒤 "끝났다"고 알리기만 하고, 목록으로 돌아가는 방법은 App이 정한다. 목록 화면도 "몇 동을 눌렀다"고만 알린다. 그래서 각 화면은 다른 화면을 모른다.

Java의 리스너 인터페이스와 같은 생각이다.

```java
interface RecordFormListener {
    void onSaved(String message);
    void onCancel();
}
new RecordForm(house, records, today, listener);
```

이름을 `on...`으로 짓는 건 "...가 일어나면 불린다"는 관례다 (`onClick`, `onChange`와 같은 모양).

## 관련

- [[2026-10-22-React-컴포넌트와-props]]
- [[2026-10-22-3단계-코드-읽기]]
- [[2026-10-22-브라우저-history와-뒤로-가기]]
- [[2026-10-22-IndexedDB와-Dexie]]
