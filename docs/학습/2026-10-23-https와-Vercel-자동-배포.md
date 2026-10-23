# https와 Vercel 자동 배포

5단계에서 PWA를 폰으로 시험할 방법을 고르다가 Vercel 배포를 앞당겼다 ([[결정기록]] 2026-10-23 "Vercel 배포를 5단계로 앞당김"). 그때 나온 내용을 정리한다.

## 1. 왜 https가 필요한가: "안전한 주소"에서만 되는 기능

브라우저는 주소를 두 가지로 나눈다.

| 주소 | 브라우저가 보기에 | 예 |
|---|---|---|
| `https://...` | 안전함 | Vercel 주소 |
| `http://localhost...` | 안전함 (내 PC 안이라서) | PC에서 `npm run dev` |
| `http://192.168.x.x...` | **안전하지 않음** | 폰에서 같은 와이파이로 연 개발 서버 |

안전하지 않은 주소에서는 일부 기능이 막힌다.

- `crypto.randomUUID()` (기록 id 만들기). 3단계에서 `crypto.getRandomValues()`로 직접 만들어 피했다 → [[2026-10-22-Vite-개발-서버와-화면-확인]] 4번
- **서비스 워커**: 인터넷이 끊겨도 앱이 열리게 하는 PWA의 핵심 기능이다. 이건 피할 방법이 없다
- 홈 화면에 "앱처럼" 추가하기 (안드로이드 크롬의 "앱 설치")

그래서 PWA를 폰에서 시험하려면 폰에서 `https://` 주소나 `localhost`로 열어야 한다.

Spring으로 치면 Spring Security의 `requiresChannel().anyRequest().requiresSecure()`처럼 "https로만 받겠다"는 설정이 있는데, 여기서는 그 결정을 **서버가 아니라 브라우저가** 한다. 서버가 아무리 허락해도 브라우저가 http 주소에서는 서비스 워커를 안 켠다.

## 2. 폰에서 https로 여는 방법들 (고른 것: Vercel)

| 방법 | 어떻게 | 왜 안 골랐나 / 골랐나 |
|---|---|---|
| USB 포트 포워딩 | 폰을 USB로 PC에 꽂고 PC 크롬 `chrome://inspect`에서 폰의 `localhost:5173`을 PC로 이어 준다 | **안드로이드 크롬 전용.** 개발자 폰은 아이폰이라 못 씀 |
| 터널 도구 (cloudflared 등) | PC에서 돌린 개발 서버에 임시 `https://...trycloudflare.com` 주소를 붙여 준다 | 시험할 때만 쓰고 버릴 도구. 켤 때마다 주소가 바뀐다 |
| **Vercel 배포** | GitHub에 올린 코드를 Vercel이 빌드해서 `https://` 주소로 열어 준다 | 어차피 할 일(원래 7단계)이고 주소가 고정된다 → **골랐다** |

주소가 바뀌면 안 되는 이유: 폰은 주소마다 저장소를 따로 둔다 ([[2026-10-22-IndexedDB와-Dexie]] 2번). 주소가 바뀌면 폰에서는 다른 앱으로 보고 기록이 빈 상태로 다시 시작한다.

## 3. Vercel 자동 배포가 하는 일

```
내 PC                GitHub               Vercel                     폰
git push  ───────→  main 브랜치  ───────→  npm install            https://buchu-farm-app-….vercel.app
                    (코드 보관)            npm run build  → dist/  ←──── 브라우저로 열기
                                           dist/ 파일을 주소에 올림
```

- **push하면 저절로 배포된다.** Vercel이 GitHub를 지켜보다가 `main`에 새 커밋이 오면 `npm run build`를 돌리고, 나온 `dist/` 폴더를 주소에 올린다
- `dist/`에는 HTML 한 개, CSS 한 개, JS 한 개 정도만 있다 (`npm run build` 결과). **돌아가는 서버 프로그램이 없다.** 파일만 나눠 준다. 계산·저장은 모두 폰의 브라우저 안에서 한다
- `main`이 아닌 브랜치에 push하면 따로 "미리보기 주소"를 만들어 준다. 진짜 주소는 그대로다

### Spring에서는

Spring Boot 앱을 배포한다면 보통 이렇게 한다.

```
git push → Jenkins / GitHub Actions가 ./gradlew build → app.jar
        → 서버에 app.jar 복사 → java -jar app.jar (계속 돌아가는 프로세스)
```

| | Spring Boot 배포 | 우리 앱 (Vercel) |
|---|---|---|
| 빌드 | `./gradlew build` → `app.jar` | `npm run build` → `dist/` 폴더 |
| 빌드를 누가 돌리나 | Jenkins, GitHub Actions 등을 직접 설정 | Vercel이 알아서 (설정 없음, Vite인 걸 알아봄) |
| 올린 뒤 | `java -jar`가 계속 돌며 요청을 처리 | 파일만 나눠 줌. Nginx로 정적 파일만 서비스하는 것과 비슷 |
| 데이터 | 서버의 DB | 지금은 각 폰 안(IndexedDB). 6단계부터 Supabase |

### 조심할 것

- **`main`에 올리는 순간 진짜 주소가 바뀐다.** 지금은 쓰는 사람이 없어서 괜찮지만, 아버지가 쓰시기 시작하면 고장 난 코드가 아버지 폰에 바로 간다
- 그래서 push 전에 두 가지를 돌린다

  ```
  npm test        # 테스트 (Spring의 ./gradlew test)
  npm run build   # Vercel이 돌릴 것과 같은 빌드. 여기서 실패하면 Vercel에서도 실패한다
  ```

- 빌드가 실패하면 Vercel은 새 버전을 올리지 않고 **예전 버전을 그대로 둔다.** 앱이 깨지지는 않지만, 고친 것도 반영되지 않는다
- 레포가 공개(PUBLIC)라 코드는 누구나 볼 수 있다. 지금은 비밀 키가 없어서 괜찮다. 6단계의 Supabase 키는 `.env`에 둔다 (`.gitignore`에 이미 있음). Vercel에는 Vercel 화면의 "Environment Variables"에 따로 넣는다 (6단계에서)

## 4. `npm install`: 받아 둔 라이브러리가 빠졌을 때

배포 전에 `npm run build`를 돌렸더니 `Cannot find module 'dexie'` 에러가 났다. `package.json`에는 Dexie가 적혀 있는데, 이 PC의 `node_modules/` 폴더에 실제 파일이 없었다. `npm install`로 다시 받으니 해결됐다.

- `package.json`: 쓰는 라이브러리 **목록** (Gradle의 `build.gradle` `dependencies`)
- `package-lock.json`: 정확한 버전 (Gradle의 lock 파일)
- `node_modules/`: 실제로 받아 둔 **파일** (Gradle의 `~/.gradle/caches`). Git에 안 올린다 (`.gitignore`)
- `npm install`: 목록대로 받아 오기. Gradle은 빌드할 때 알아서 받지만, npm은 직접 `npm install`을 해야 한다

Vercel은 빌드할 때마다 `npm install`부터 하므로 이 문제가 없다. 내 PC에서 다른 PC로 옮기거나, `git pull`로 라이브러리가 늘어난 뒤에는 `npm install`을 한 번 한다.

## 5. 아이폰과 갤럭시 (5.1단계 PWA에서 확인할 것)

개발자 폰은 아이폰, 아버지 폰은 갤럭시(안드로이드)다. 실제로 쓰실 분이 아버지라 **기준은 안드로이드 크롬**이고, 아이폰은 개발 중 확인용이다.

| | 갤럭시 (크롬) | 아이폰 (사파리) |
|---|---|---|
| 홈 화면에 추가 | 크롬이 "앱 설치"를 띄워 준다 | 공유 버튼 → "홈 화면에 추가"를 직접 누른다 |
| 저장소 | (5.1단계에서 확인) | 사파리에서 연 것과 홈 화면 앱의 기록이 따로라고 알려져 있다 (확인 필요) |

아이폰에서 시험할 때는 헷갈리지 않게 홈 화면 앱으로만 입력해 본다.

## 관련

- [[2026-10-22-Vite-개발-서버와-화면-확인]]
- [[2026-10-22-IndexedDB와-Dexie]]
- [[2026-10-23-날짜-칸-덮기와-클릭-이벤트-전파]]
- [[결정기록]]
