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
- 레포가 공개(PUBLIC)라 코드는 누구나 볼 수 있다. Supabase 주소와 publishable 키는 `.env`에 두고(Git에 안 올림), Vercel에는 화면의 "Environment Variables"에 따로 넣었다. 둘 다 원래 공개되어도 되는 값이고, Secret 키는 어디에도 넣지 않는다 → [[2026-10-23-환경-변수와-Supabase-권한]]

## 4. `npm install`: 받아 둔 라이브러리가 빠졌을 때

배포 전에 `npm run build`를 돌렸더니 `Cannot find module 'dexie'` 에러가 났다. `package.json`에는 Dexie가 적혀 있는데, 이 PC의 `node_modules/` 폴더에 실제 파일이 없었다. `npm install`로 다시 받으니 해결됐다.

- `package.json`: 쓰는 라이브러리 **목록** (Gradle의 `build.gradle` `dependencies`)
- `package-lock.json`: 정확한 버전 (Gradle의 lock 파일)
- `node_modules/`: 실제로 받아 둔 **파일** (Gradle의 `~/.gradle/caches`). Git에 안 올린다 (`.gitignore`)
- `npm install`: 목록대로 받아 오기. Gradle은 빌드할 때 알아서 받지만, npm은 직접 `npm install`을 해야 한다

Vercel은 빌드할 때마다 `npm install`부터 하므로 이 문제가 없다. 내 PC에서 다른 PC로 옮기거나, `git pull`로 라이브러리가 늘어난 뒤에는 `npm install`을 한 번 한다.

### 새 PC에서 할 일: 처음 한 번만

Git에 일부러 안 올리는 것이 둘 있어서, PC를 바꾸면 그 PC에서 **처음 한 번** 채워야 한다. 그다음부터 그 PC에서는 `git pull`만 하면 된다.

| Git에 없는 것 | 왜 안 올리나 | 새 PC에서 |
|---|---|---|
| `node_modules/` | 파일이 수만 개라 무겁다. `package.json` 목록만 있으면 다시 받을 수 있다 | `npm install` |
| `.env` (Supabase 주소·키) | 키를 Git에 남기지 않으려고 → [[2026-10-23-환경-변수와-Supabase-권한]] 1번 | `.env.example`을 **복사**해 `.env`를 만들고 값을 채운다 |

- Spring으로 치면 `build.gradle`만 Git에 있고 jar는 PC마다 `~/.gradle/caches`로 받는 것, Git에 안 올리는 `application-local.yml`을 PC마다 만드는 것과 같다
- **이름 바꾸기가 아니라 복사다.** 10월 23일에 `.env.example`이 지워진 채 `.env`만 남은 적이 있다. 그대로 커밋하면 견본이 Git에서 사라져 다음 PC에서 무엇을 채울지 모른다. `git restore .env.example`로 되살렸다
- 같은 PC로 돌아왔을 때 `npm install`은 다른 PC에서 라이브러리를 늘렸을 때만 다시 한다. 헷갈리면 그냥 해도 된다 (바뀐 게 없으면 몇 초 만에 끝난다)
- **폰 앱은 PC의 `.env`와 상관없다.** 폰은 Vercel 주소를 열고, Vercel은 자기 환경 변수로 빌드한다. 그래서 이 PC에 `.env`가 없어도 폰 로그인은 됐다. `.env`는 이 PC에서 `npm run dev`로 띄울 때만 쓴다
- 기록도 PC와 폰이 따로다. IndexedDB는 기기마다, 주소(origin)마다 따로라서 같은 PC라도 `localhost`와 Vercel 주소의 기록이 다르다 → [[2026-10-22-IndexedDB와-Dexie]] 2번. 동기화(6-4 올리기, 6-5 내려받기)가 끝나면 Supabase를 거쳐 같은 기록을 갖게 된다

## 5. 아이폰과 갤럭시

아버지는 갤럭시(안드로이드 크롬), 형과 개발자는 아이폰(사파리)이다. **두 폰 모두 실제로 쓰는 폰이라 둘 다 동작해야 한다** → [[결정기록]] "아버지 폰(갤럭시)과 형 폰(아이폰) 모두 지원". 홈 화면 추가 방법과 저장소 차이는 [[2026-10-23-PWA와-서비스-워커]] 4번.

## 6. 커밋 작성자와 push 계정은 따로다

이 PC에서 만든 커밋이 개인 계정이 아니라 회사 GitHub 계정으로 표시된 적이 있다.

| | 무엇으로 정해지나 | 이 PC에서 |
|---|---|---|
| **커밋 작성자** (누가 썼나) | 커밋할 때 그 PC의 `git config user.name` / `user.email` | 전역 설정(`~/.gitconfig`)이 회사 계정이었다 |
| **push 계정** (누가 올렸나) | GitHub 로그인 (`gh auth`) | 개인 계정(`jaejin33`)으로 로그인돼 있었다 |

GitHub는 커밋 작성자의 **메일 주소**를 보고 계정을 연결한다. 그래서 개인 계정으로 push했는데도 회사 메일이 붙은 커밋은 회사 계정으로 보였다.

이 레포에만 개인 설정을 넣어 고쳤다. `--global` 없이 쓰면 이 레포의 `.git/config`에만 들어가고, 회사 레포는 전역 설정을 그대로 쓴다.

```
git config user.name "jaejin"
git config user.email "개인 메일 주소"
```

- 우선순위는 레포 설정(`.git/config`) → 전역 설정(`~/.gitconfig`)이다. Spring의 `application-local.yml`이 `application.yml` 값을 덮어쓰는 것과 비슷하다
- 다른 PC에서 레포를 새로 받으면 그 PC의 전역 설정을 따르므로, 위 두 줄을 다시 한 번 실행한다
- 이미 올라간 커밋 3개(10월 23일)는 회사 계정으로 남겨 두었다. 바꾸려면 강제 push가 필요해서 그냥 두기로 했다

## 관련

- [[2026-10-22-Vite-개발-서버와-화면-확인]]
- [[2026-10-22-IndexedDB와-Dexie]]
- [[2026-10-23-날짜-칸-덮기와-클릭-이벤트-전파]]
- [[2026-10-23-PWA와-서비스-워커]]
- [[2026-10-23-환경-변수와-Supabase-권한]]
- [[결정기록]]
