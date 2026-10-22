# TypeScript 구별된 유니온 (discriminated union)

앱 1단계 `src/domain/types.ts`에서 기록 타입을 만들 때 쓴 방식이다. 4번(`DistributiveOmit`)은 3단계 `src/data/recordRepository.ts`에서 썼다. Java·Spring을 아는 입장에서 정리한다.

## 0. 먼저: TypeScript는 무엇인가

- **JavaScript(JS)** 는 브라우저가 직접 실행하는 언어다. HTML의 `<script>` 안에서 돌아가는 그것. 변수에 타입이 없다 (`let x = 1; x = "글자"`가 그냥 된다)
- **TypeScript(TS)** 는 JS에 Java처럼 타입을 붙인 언어다. 브라우저는 TS를 모르기 때문에, 빌드할 때 **타입을 전부 지우고 JS로 바꿔서** 실행한다
  - Java로 치면 `javac`가 컴파일 단계에서 타입 검사를 하는 것과 같다. 다만 TS는 실행 시점에 타입 정보가 **하나도 남지 않는다** (Java 제네릭의 타입 소거가 언어 전체에 일어난다고 보면 된다)
  - 그래서 `instanceof SprayRecord` 같은 실행 중 타입 확인은 TS의 `interface`에는 쓸 수 없다. 이 점이 아래 "구별된 유니온"을 쓰는 이유와 연결된다
- 이 프로젝트에서는 `npx tsc -b`가 타입 검사를 한다 (`npm run build` 안에 포함)

## 1. 필요한 TS 문법 네 가지

### (1) `interface`: 객체의 모양

```ts
interface RecordBase {
  id: string
  house_no: number
  memo: string | null
}
```

- Java의 `interface`와 이름은 같지만 뜻이 다르다. Java는 "구현해야 할 메서드 목록"이고, TS는 **"이런 필드를 가진 객체"라는 모양 설명**이다. Java의 `record`나 DTO 클래스에 더 가깝다
- `class ... implements`를 쓰지 않아도, 필드가 맞는 객체면 그 타입으로 인정된다. 이것을 **구조적 타이핑**이라고 한다 (Java는 이름으로 맞추는 명목적 타이핑)
  ```ts
  const r: RecordBase = { id: 'a', house_no: 3, memo: null } // 클래스 없이 바로 OK
  ```
- `extends`로 필드를 물려받는다. Java의 상속처럼 생겼지만 "필드 목록을 합친다"는 뜻일 뿐이다

### (2) `string | null`: 유니온 타입 (또는)

- `|`는 "둘 중 하나"라는 뜻이다. `memo: string | null`은 "글자이거나 null"
- Java에서는 모든 객체 참조가 null이 될 수 있지만, TS는 **`| null`을 적지 않으면 null을 넣을 수 없다** (TypeScript 6부터 엄격 모드 `strict`가 기본값이라, `tsconfig`에 따로 적지 않아도 켜져 있다). Java의 `Optional`이나 `@Nullable`을 타입 자체에 넣은 것과 비슷하다

### (3) 리터럴 타입: 값 하나가 곧 타입

```ts
type RecordType = 'spray' | 'top_dressing' | 'fertigation' | 'harvest' | 'cancel'
```

- `'spray'`는 "아무 글자"가 아니라 **정확히 `'spray'`라는 값만 되는 타입**이다
- 이것들을 `|`로 묶으면 Java `enum`과 비슷한 효과가 난다. `'sprya'`처럼 오타를 내면 컴파일 에러
- `type 이름 = ...`은 타입에 별명을 붙이는 문법이다 (Java에는 대응 문법이 없다)

### (4) 타입 좁히기 (narrowing)

```ts
function f(x: string | null) {
  if (x !== null) {
    x.length // 이 안에서 x는 string으로 취급된다
  }
}
```

`if`로 확인하고 나면 TS가 그 블록 안에서 타입을 좁혀 준다. Java 16+의 `if (obj instanceof String s)` 패턴 매칭과 같은 효과다.

## 2. 구별된 유니온

위 네 가지를 합친 것이다. 종류마다 필드가 다른 데이터를 하나의 타입으로 묶고, **모든 종류에 공통으로 있는 구별용 필드**(여기서는 `type`)의 리터럴 값으로 가른다.

```ts
interface SprayRecord extends RecordBase {
  type: 'spray'          // ← 구별용 필드. 값이 'spray'로 고정
  pesticide: string | null   // 약 이름. 안 적으면 null (3단계에서 바뀜)
}
interface HarvestRecord extends RecordBase {
  type: 'harvest'        // ← 'harvest'로 고정
  cycle_days: number
}
interface HarvestAmountRecord extends RecordBase {
  type: 'harvest_amount'
  target_id: string
  boxes: number
  bunches: number
}
interface CancelRecord extends RecordBase {
  type: 'cancel'
  target_id: string
}
// 웃거름, 관비, 수확 시작, 문제도 같은 방식

type FarmRecord =
  | SprayRecord | TopDressingRecord | FertigationRecord
  | HarvestStartRecord | HarvestRecord | HarvestAmountRecord
  | ProblemRecord | CancelRecord
```

`type`을 확인하면 TS가 어떤 종류인지 알아서 좁혀 준다.

```ts
function show(r: FarmRecord) {
  if (r.type === 'spray') {
    r.pesticide    // OK: 여기서 r은 SprayRecord
  }
  r.pesticide      // 컴파일 에러: 웃거름 기록일 수도 있음
}
```

### 왜 이렇게 하나

- **실행 중에도 남는 값으로 구분하기 위해서.** 0번에서 말했듯 TS 타입은 실행 때 사라진다. 하지만 `type: 'spray'`는 진짜 데이터 값이라 실행 중에도 남는다. IndexedDB나 Supabase에서 읽어 온 평범한 JSON 객체도 `type` 값만 보면 종류를 알 수 있다
- **DB 테이블과 모양이 같다.** Supabase `records` 테이블은 `type` 컬럼 하나로 여덟 종류를 한 테이블에 담는다. 타입도 같은 구조라 변환 코드가 필요 없다
- **안전.** 수확 기록을 만들 때 `cycle_days`를 빼먹으면 컴파일 에러가 난다. 🟢 수확 가능 계산에 꼭 필요한 값이라 중요하다

### `harvestCalc.ts`에서 쓴 예: 타입 가드

```ts
// lastHarvestRecord 함수 안 (그 동의 마지막 수확 완료 기록)
return lastOf(records, (r): r is HarvestRecord => r.type === 'harvest' && r.house_no === houseNo)

// getHouseStatus 안
const spray = lastOf(records, (r): r is SprayRecord => r.type === 'spray' && r.house_no === houseNo)
```

`lastOf`는 "조건에 맞는 마지막 기록"을 찾는 함수이고, 두 번째 인자로 **조건 함수**를 받는다 ([[2026-10-22-1단계-코드-읽기]] 3-3).

- `(r) => ...`는 **화살표 함수**다. Java 람다 `r -> ...`와 같다
- `r is HarvestRecord`는 **타입 가드**다. "이 함수가 true를 돌려주면 r은 HarvestRecord다"라고 TS에 알려 준다. 그래서 찾은 마지막 수확 기록의 타입이 `FarmRecord`가 아니라 `HarvestRecord`가 되고, 뒤에서 `harvest.cycle_days`를 바로 쓸 수 있다
  - Java로 치면 `.filter(r -> r instanceof HarvestRecord).map(r -> (HarvestRecord) r)`의 캐스팅을 한 번에 하는 것
- 배열의 `.filter()`에도 같은 방식으로 쓴다. Java Stream의 `.filter()`와 같다 (JS 배열에 바로 붙어 있어서 `.stream()`이 필요 없다)

## 3. `Record` 대신 `FarmRecord`라고 부른 이유

TS에는 `Record<K, V>`라는 내장 타입이 이미 있다. 키 타입이 K, 값 타입이 V인 객체를 뜻한다 (Java의 `Map<K, V>`와 비슷). 같은 이름을 쓰면 내장 타입을 가려서 헷갈리므로 `FarmRecord`로 했다. [[결정기록]] 참고.

## 4. 종류마다 따로 빼기: `DistributiveOmit`

3단계에서 "새 기록" 타입을 만들 때 쓴 방법이다 (`src/data/recordRepository.ts`).

### 하고 싶은 것

화면은 기록을 저장할 때 동·날짜·종류·내용만 정하고, **id·입력한 사람·입력 시각은 저장소가 채운다.** 그래서 "기록에서 그 셋을 뺀 타입"이 필요하다.

TS에는 항목을 빼는 내장 타입 `Omit<T, 빼는 항목>`이 있다.

```ts
interface SprayRecord { id: string; house_no: number; type: 'spray'; pesticide: string | null }
type NewSpray = Omit<SprayRecord, 'id'>
// = { house_no: number; type: 'spray'; pesticide: string | null }
```

Java에는 이런 문법이 없다. 굳이 하면 `id` 없는 DTO 클래스(`SprayCreateRequest`)를 따로 만든다.

### 그냥 `Omit`을 유니온에 쓰면 망가진다

```ts
type Broken = Omit<FarmRecord, 'id' | 'recorded_by' | 'recorded_at'>
```

`Omit`은 유니온을 **하나로 뭉쳐서** 본다. 여덟 종류 **모두에 있는** 항목(`house_no`, `work_date`, `memo`, `type`)만 남고, `pesticide`, `cycle_days`처럼 일부 종류에만 있는 항목은 사라진다. 그러면 `{ type: 'spray', pesticide: '가약', ... }`을 넘길 때 "`pesticide`라는 항목은 없다"는 에러가 난다. `type`도 "여덟 값 중 아무거나"가 되어 종류별로 좁혀지지 않는다.

### 종류마다 따로 적용하기

```ts
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

export type NewRecord = DistributiveOmit<FarmRecord, 'id' | 'recorded_by' | 'recorded_at'>
// = Omit<SprayRecord, ...> | Omit<TopDressingRecord, ...> | ... | Omit<CancelRecord, ...>
```

- `T extends unknown ? X : Y`는 **타입의 삼항 연산자**다. "T가 unknown에 속하면 X, 아니면 Y". 모든 타입은 `unknown`에 속하므로 항상 X(`Omit<T, K>`)다
- 조건 자체는 의미가 없고, **이 모양을 쓰면 TS가 유니온을 한 종류씩 나눠서 적용한다**는 규칙을 이용한 것이다 (분배 조건부 타입, distributive conditional type). 그래서 결과가 "종류마다 `Omit`한 것들의 유니온"이 된다
- 그 결과 `NewRecord`도 구별된 유니온이다. `type: 'harvest'`인데 `cycle_days`를 빠뜨리면 여전히 빌드 에러가 난다
- `K extends PropertyKey`: K는 "객체 항목 이름으로 쓸 수 있는 것"(글자·숫자·심볼)만 받는다는 제약이다. Java 제네릭의 `<K extends Comparable<K>>` 같은 상한 제약과 같은 문법이다
- `never`는 "아무것도 아닌 타입"이다. 여기서는 쓰일 일이 없는 자리를 채운 것이다

외우지 않아도 된다. **"유니온 타입에서 항목을 뺄 때는 `Omit` 말고 `DistributiveOmit`을 쓴다"**만 기억하면 된다. 많이 쓰는 관용구다.

## 5. Spring(Java)에 대응되는 것

**Java 17+ `sealed interface` + `record` + `switch` 패턴 매칭**이 가장 가깝다.

```java
sealed interface FarmRecord permits SprayRecord, HarvestRecord, CancelRecord /* ... */ {}
record SprayRecord(String id, int houseNo, String pesticide) implements FarmRecord {}
record HarvestRecord(String id, int houseNo, int cycleDays) implements FarmRecord {}

String describe(FarmRecord r) {
  return switch (r) {
    case SprayRecord s   -> "약 " + s.pesticide();
    case HarvestRecord h -> "수확";
    // sealed라서 빠진 case가 있으면 컴파일 에러
  };
}
```

| | Java | TypeScript |
|---|---|---|
| 종류 구분 기준 | 클래스 자체 (`instanceof`) | 객체 안의 `type` 필드 값 |
| 종류 목록 고정 | `sealed ... permits` | `type FarmRecord = A \| B \| C` |
| 좁히기 | `case SprayRecord s ->` | `if (r.type === 'spray')` |
| 실행 중 타입 정보 | 남음 | 사라짐 (그래서 `type` 필드가 필요) |

**JPA 단일 테이블 상속**도 같은 생각이다.

```java
@Entity
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "type")
abstract class FarmRecordEntity { ... }

@Entity @DiscriminatorValue("spray")
class SprayRecordEntity extends FarmRecordEntity { String pesticide; }

@Entity @DiscriminatorValue("harvest")
class HarvestRecordEntity extends FarmRecordEntity { Integer cycleDays; }
```

여러 종류를 한 테이블에 넣고 구분 컬럼(`type`)으로 가른다. Supabase `records` 테이블이 이 구조다. 해당하지 않는 컬럼(웃거름 기록의 `cycle_days`, `boxes` 등)은 null로 비어 있다.

## 관련

- [[2026-10-22-Vitest-테스트와-순수-함수]]
- [[2026-10-22-3단계-코드-읽기]]
- [[진행기록]]
