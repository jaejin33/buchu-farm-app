# IndexedDB와 Dexie

앱 3단계에서 기록을 폰 안에 저장하려고 쓴 도구다 (`src/data/db.ts`, `src/data/recordRepository.ts`). 이 프로젝트에서 어떻게 썼는지는 [[2026-10-22-3단계-코드-읽기]] 2·4번에 있다.

## 1. 한 줄 요약

**IndexedDB는 브라우저 안에 들어 있는 DB이고, Dexie는 그걸 쓰기 쉽게 감싼 라이브러리다.**

| 이 프로젝트 | Spring / Java 쪽 비슷한 것 |
|---|---|
| IndexedDB (브라우저 내장 DB) | 앱에 내장된 H2 같은 DB. 다만 SQL이 없다 |
| Dexie | JPA·Spring Data (불편한 기본 API를 감싸 줌) |
| `db.version(1).stores({...})` | `@Entity` + Flyway `V1__init.sql` |
| `db.records.add(...)` | `repository.save(...)` |
| `db.records.toArray()` | `repository.findAll()` |
| `db.records.where('synced').equals(0)` | `findBySynced(0)` |
| `fake-indexeddb` (테스트) | 테스트용 H2 인메모리 DB |

## 2. 왜 IndexedDB인가

- **인터넷이 끊겨도 저장·조회가 된다.** 폰 안에 있기 때문이다. 화면은 항상 IndexedDB를 기준으로 그린다 (`CLAUDE.md` 아키텍처). 서버(Supabase)로는 6단계에서 따로 보낸다
- **앱을 껐다 켜도, 새로고침해도 남는다.** 브라우저의 메모리(변수)는 페이지를 닫으면 사라진다
- 브라우저에는 `localStorage`라는 더 간단한 저장소도 있다. 하지만 글자 하나씩만 저장하고(약 5MB), 찾기(색인)가 없다. 기록이 계속 쌓이는 앱에는 IndexedDB가 맞다
- **사이트(주소)마다 따로다.** `localhost:5173`에 저장한 기록은 Vercel 주소에서 보이지 않는다. 폰과 PC도 따로다

IndexedDB의 특징:

- **표(table)가 아니라 객체를 통째로 저장한다.** JSON 같은 객체 하나가 한 줄이다. 그래서 `house_no`, `pesticide` 같은 항목을 미리 정하지 않아도 저장된다. MongoDB 같은 문서 DB에 가깝다
- **SQL이 없다.** 기본 키나 색인으로 찾는다. `WHERE type = 'spray' AND house_no = 3` 같은 자유로운 조건은 직접 걸러야 한다. 이 앱은 기록이 많지 않아서(25동 × 하루 몇 건) 전부 읽어 와서 `domain/` 함수로 거른다
- **기본 API가 불편하다.** 모든 일이 "끝나면 이 함수를 불러 줘"(콜백) 방식이라 코드가 길어진다. 그래서 Dexie를 쓴다

## 3. Dexie로 저장소 정하기

```ts
export const db = new Dexie('buchu-farm') as Dexie & {
  records: EntityTable<StoredRecord, 'id'>
}

db.version(1).stores({
  records: 'id, synced',
})
```

- `new Dexie('buchu-farm')`: `buchu-farm`이라는 DB를 연다 (없으면 만든다)
- `stores({ records: 'id, synced' })`: `records`라는 저장소(테이블 같은 것)를 만든다
  - **맨 앞(`id`)이 기본 키**다. 같은 id로 두 번 넣으면 에러가 난다
  - **나머지(`synced`)는 색인**이다. 이 항목으로 빨리 찾을 수 있다
  - 여기 적지 않은 항목(`house_no`, `type` 등)도 **저장은 된다.** 색인만 없을 뿐이다. JPA처럼 모든 컬럼을 적는 게 아니라 "찾을 때 쓸 것"만 적는다

### 색인에 `true/false`를 못 쓴다

IndexedDB의 색인 값은 **숫자, 글자, 날짜, 배열**만 된다. `true/false`는 안 된다. `synced: true`로 저장하면 에러는 안 나지만 **색인에서 빠져서** `where('synced').equals(...)`로 찾을 수 없다. 그래서 `synced`를 `0`(안 보냄) / `1`(보냄)로 둔다.

```ts
export type StoredRecord = FarmRecord & { synced: 0 | 1 }   // 타입으로 0과 1만 허락
...
await db.records.where('synced').equals(0).count()          // 아직 안 보낸 기록 수 (6단계 "미전송 N건")
```

`0 | 1`은 "숫자 0 또는 숫자 1만"이라는 타입이다 ([[2026-10-22-TypeScript-구별된-유니온]]의 리터럴 타입). `synced: 2`처럼 쓰면 빌드 에러가 난다. Java라면 `boolean`을 그대로 쓰거나 enum을 쓸 텐데, 여기서는 DB 제약 때문에 숫자다.

### 버전: 고치지 말고 추가한다

```ts
db.version(1).stores({ records: 'id, synced' })
// 나중에 house_no 색인이 필요하면
db.version(2).stores({ records: 'id, synced, house_no' })
```

폰에는 이미 `version(1)`로 만든 DB가 있다. 앱이 `version(2)`를 보면 그 DB를 새 구조로 바꾼다. **`version(1)` 줄을 고치면 이미 설치된 폰과 어긋난다.** Flyway에서 이미 실행된 `V1__init.sql`을 고치지 않고 `V2__add_index.sql`을 추가하는 것과 같다.

## 4. 읽고 쓰기

```ts
await db.records.add({ ...record, synced: 0 })   // 추가. 같은 id가 있으면 에러
const all = await db.records.toArray()          // 전부 읽기
```

- 모두 `Promise`를 돌려주므로 `await`로 기다린다 → [[2026-10-22-React-state와-이벤트]] 6번
- `add`는 "새로 추가"만 한다. 같은 id면 덮어쓰는 `put`도 있지만 쓰지 않는다. **기록은 추가만 한다**는 규칙에 맞춰 `add`만 쓴다

### 화면과 묶기: `useLiveQuery`

```ts
import { useLiveQuery } from 'dexie-react-hooks'

export function useRecords(): FarmRecord[] | undefined {
  return useLiveQuery(getAllRecords)
}
```

- 화면에서 `const records = useRecords()`로 부르면 기록 배열을 받는다
- **DB가 바뀌면 다시 읽고 화면을 다시 그린다.** 기록 화면에서 저장하면 목록 화면이 따로 요청하지 않아도 바로 바뀐다
- 처음 읽는 동안은 `undefined`다. 그래서 App에서 `if (records === undefined) return null`로 기다린다
- Spring에는 대응하는 게 없다. 서버는 DB가 바뀌어도 이미 보낸 화면을 고쳐 주지 않는다. 굳이 비슷한 걸 찾자면 WebSocket으로 "바뀌었다"고 알려 주는 구조다
- `dexie-react-hooks`는 React용 Dexie 도우미 패키지다. `useLiveQuery`처럼 `use`로 시작하는 함수를 **훅**이라고 부른다. `useState`도 훅이다. 훅은 컴포넌트 함수(또는 다른 훅) 안에서만 부를 수 있다

## 5. 테스트: `fake-indexeddb`

```ts
// recordRepository.test.ts 맨 위
import 'fake-indexeddb/auto'
```

- 테스트(Vitest)는 브라우저가 아니라 **Node**에서 돈다. Node에는 IndexedDB가 없다
- `fake-indexeddb`는 IndexedDB를 메모리에서 흉내 낸다. 이 한 줄을 맨 위에 두면 그 뒤로 불러오는 Dexie가 이걸 진짜 IndexedDB로 알고 쓴다. 그래서 `db.ts`를 불러오기 **전에** 있어야 한다
- 테스트마다 `beforeEach`에서 `db.records.clear()`로 비운다. 앞 테스트의 기록이 남지 않게 한다 (JUnit의 `@BeforeEach` + `deleteAll()`)
- Spring에서 테스트할 때 진짜 PostgreSQL 대신 H2 인메모리 DB를 쓰는 것과 같은 생각이다

## 6. 브라우저에서 직접 보기

1. 앱을 띄운 크롬에서 F12
2. 위쪽 탭에서 **Application** (안 보이면 `>>` 안에 있음)
3. 왼쪽 **Storage → IndexedDB → buchu-farm → records**
4. 저장한 기록이 한 줄씩 보인다. `synced: 0`도 보인다

**기록을 모두 지우고 처음부터 시험하려면:** 같은 Application 탭 왼쪽 **Storage**를 누르고 **Clear site data**. 폰에서는 브라우저 설정 → 사이트 설정 → 그 주소의 저장 데이터 삭제.

**주의:** 폰 브라우저가 저장 공간이 모자라면 오래 안 쓴 사이트의 데이터를 지울 수 있다. 그래서 진짜 원본은 6단계부터 Supabase(서버)에 둔다. 그 전까지 기록은 종이 영농일지가 원본이다 (`CLAUDE.md`).

## 관련

- [[2026-10-22-3단계-코드-읽기]]
- [[2026-10-22-React-state와-이벤트]]
- [[2026-10-22-Vitest-테스트와-순수-함수]]
- [[2026-10-22-TypeScript-구별된-유니온]]
