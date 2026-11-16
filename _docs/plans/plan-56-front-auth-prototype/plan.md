# front-auth-prototype

## 목표
auth-prototype의 로그인·회원가입 화면 시안을 현재 front 앱에 이식하고 사용자 로그인 진입점으로 연결한다. 사용자는 범위와 계약/task 구성을 두 차례 승인했으며 최종 제공자는 Google·카카오·네이버로 승인했다.

## 범위·비목표·가정
- 프론트 route·화면·화면 로컬 상태·순수 날짜 검증·기존 진입점·관련 테스트·제품 문서를 변경한다.
- 실제 OAuth·회원가입 API·본인/나이 인증·약관/생년월일 저장·보호자 요청 전송·관리자 화면·백엔드·패키지 추가는 제외한다.
- auth-prototype은 읽기 전용 참조로 유지한다. 현재 front 공통 UI/theme·재생 설정은 보존한다.
- /auth/login은 화면 경로이고 POST /auth/login은 기존 API 경로다. 시안 완료는 실제 로그인되지 않는다. 개발용 /login 자동 로그인과 API·세션 계층은 유지한다.
- 서버를 자동 실행하지 않는다. 아래 자동 테스트는 서버·DB 없이 수행한다. 별도 수동 브라우저 확인을 할 경우 기존 localhost:8081만 사용하고 부재는 검증 불가로 기록한다.
- 기존 호출 지점과 변경 조건을 모두 열거할 수 있어 관련 화면·세션 suite로 영향 범위를 한정한다. 전체 검사는 finish 단계에서 수행한다.

## 공통 계약
### AUTH-AGE: 생년월일과 만 나이
정의 담당 task-2, 테스트 소비 task-1, 화면 소비 task-4. 정의 경로 `front/src/features/auth/authAge.ts`. named export:
```ts
export type CalendarDate = { year: number; month: number; day: number };
export type BirthDateCheck = { ok: true; age: number } | { ok: false; error: string };
export const GUARDIAN_CONSENT_AGE = 14;
export function kstToday(now: Date): CalendarDate;
export function ageOn(birth: CalendarDate, today: CalendarDate): number;
export function checkBirthDate(year: string, month: string, day: string, today: CalendarDate): BirthDateCheck;
```
프로토타입의 순수 함수를 이식한다. 월은 1~12. KST 자정에 날짜가 바뀌며 만 나이는 생일 당일 증가한다. 평년의 2/29 생일은 3/1에 증가한다. 연도 4자리, 월·일 1~2자리 숫자만 받는다. 실제 달력 날짜, 미래 여부, 만 120세 이하를 순서대로 검증한다. 오류 문구는 각각 '연도 4자리와 월, 일을 모두 입력해 주세요.', '달력에 없는 날짜예요. 다시 확인해 주세요.', '오늘 이후 날짜는 입력할 수 없어요.', '만 120세 이하로 입력해 주세요.'를 유지한다.
검증 데이터: 기준일 2026-11-13, 2012-11-13은 14세, 2012-11-14는 13세, 1906-11-13은 120세 허용, 1905-11-13은 거부. KST 경계는 2026-11-12T14:59:59Z와 15:00:00Z. tests/unit/authAge.test.ts로 검증한다.

### AUTH-UI: 인증 화면과 공통 UI
정의 담당 task-4, 테스트 소비 task-3, 진입점 소비 task-6·8. 다음 named export를 정의하고 각 route가 default export 함수에서 해당 화면을 반환한다.
```ts
// front/src/screens/AuthLoginScreen.tsx
export function AuthLoginScreen(): React.JSX.Element;
// front/src/screens/AuthSignupScreen.tsx
export function AuthSignupScreen(): React.JSX.Element;
// front/src/components/authUi.tsx
import type { TextStyle } from 'react-native';
import type { IconName } from '@/components/ui';
export const keepAll: TextStyle;
export function AuthNotice(props: { text: string }): React.JSX.Element;
export function AuthLink(props: { prefix?: string; label: string; onPress: () => void }): React.JSX.Element;
export function AuthStatus(props: { icon: IconName; title: string; description: string }): React.JSX.Element;
```
`front/src/app/auth/login.tsx`는 default `AuthLoginRoute`, `front/src/app/auth/signup.tsx`는 default `AuthSignupRoute`이다. props는 없다.
로그인 제공자 순서는 Google·카카오·네이버. 접근성 button 이름은 'Google로 로그인', '카카오로 로그인', '네이버로 로그인'. Apple 버튼은 없다. Google은 기존 어두운 버튼, 카카오는 노란 버튼, 네이버는 초록 배경과 흰 N 문자로 표시한다. 새 이미지·패키지는 추가하지 않는다. 네이버의 초록색 값은 기존 테마와 조화되는 구현 선택이다. 카카오 도입 검토 안내는 기존대로 유지한다.
누른 제공자의 표시명으로 '${제공자} 계정으로 연결했어요 (시안)' 결과와 '확인'을 보여준다. 결과 중 제공자 버튼·회원가입 링크는 숨긴다. '시안 화면이에요. 실제 로그인은 연결 전이에요.'를 유지한다.
결과·입력·동의·보호자 요청 상태는 화면 로컬 state이다. API, OAuth, 저장소, UserProvider login/setUser 등 실제 인증 상태 변경은 없다. 기존 `front/src/components/ui.tsx`와 theme을 재사용하고 수정하지 않는다. tests/unit/authScreens.test.tsx에서 표시·입력·완료 후에도 실제 로그인/저장 요청이 없음을 검증한다.

### AUTH-FLOW: 회원가입 단계
정의 담당 task-4, 테스트 소비 task-3. AUTH-AGE를 import한다. 필수 '이용약관 (필수)'·'개인정보 수집·이용 (필수)' checkbox와 '전체 동의' checkbox를 제공한다. 둘 다 체크해야 '다음' 활성화. '보기'는 기존 임시 약관 Modal을 열고 동의를 변경하지 않는다.
2단계 입력 label은 '출생 연도', '출생 월', '출생 일'. 숫자만 연도 4자리·월/일 2자리로 제한하고 길이를 채우면 다음 입력으로 포커스 이동. 미완성은 '다음' 비활성, 잘못된 완성 날짜는 제출 시 AUTH-AGE 오류 표시. '이전'과 2단계 Android back은 1단계로 돌아가며 입력과 동의를 유지한다.
유효한 생년월일 제출 후 3단계로 이동. 만 14세 이상은 '시작할 준비가 됐어요'와 '시작하기', 미만은 '보호자 동의가 필요해요', 가능/제한 기능 목록, '보호자 동의 요청하기', '무료 시청으로 시작하기' 표시. 보호자 요청은 실제 전송 없이 '보호자 동의를 기다리고 있어요' 상태로 변경한다. 3단계에는 이전 버튼이 없고 원본의 gesture 제한을 유지한다. 생년월일 재입력을 막는 서버 보안 기능은 만들지 않는다.
두 시작 버튼은 홈 '/'로 replace한다. '시안 화면이에요. 입력한 내용은 저장되거나 전송되지 않아요.' 유지. 선택 동의·실제 연령 권한 부여는 추가하지 않는다.
테스트 시 기준시각을 2026-11-13T03:00:00Z로 고정한다. 2012-11-13은 완료, 2012-11-14는 보호자 안내, 2011-02-29와 미래 날짜는 오류. 시계만 고정할 때 scheduler를 멈추지 않도록 Date 경계 또는 fake timer/userEvent 조합을 스킬대로 사용한다.

### AUTH-NAV: 화면 복귀
정의 담당 task-4, 테스트 소비 task-3. 로그인 '닫기', '나중에 할게요', 결과 '확인'은 canGoBack이면 back(), 아니면 replace('/')한다. '처음이라면 시작하기' link는 dismissTo('/auth/signup'), 회원가입 1·2단계의 '이미 계정이 있나요? 로그인' link는 push('/auth/login')이다. 3단계에서 해당 link는 숨긴다.
회원가입에서 로그인으로 이동한 뒤 나중에 하기·닫기·시작하기 링크로 복귀할 때 기존 약관 선택과 입력 단계가 보존된다. 원본 Stack 상태 유지 방식을 재사용하며 Provider/내비게이션을 재마운트하지 않는다. 직접 진입, 이전 화면 존재, 왕복 입력 상태를 tests/unit/authScreens.test.tsx에서 검증한다.

### AUTH-ENTRY: 기존 앱 진입점
정의 담당 task-6(루트·계정), task-8(소비 화면), 테스트 소비 task-5·7.
`front/src/app/_layout.tsx`의 세션 만료 onLogin은 기존 dismissSessionExpired() 후 router.push('/auth/login')한다. Stack에 auth/login과 auth/signup을 등록하고 기존 login도 유지한다. 기존 닫기·시스템 닫힘 동작과 단일 Provider/만료 팝업 구조를 보존한다.
`front/src/screens/AccountScreen.tsx`는 user === null 또는 user.accountType === 'GUEST'일 때 button '로그인' → push('/auth/login'), button '회원가입' → push('/auth/signup')을 프로필 부근에 표시한다. MEMBER·OPERATOR·PARTNER에서는 두 버튼을 숨긴다. 포인트·자막 설정·선호 언어를 유지한다. 기존 null/GUEST 라벨은 변경하지 않는다.
다음 기존 사용자 로그인 이동의 목적지만 '/login'에서 '/auth/login'으로 변경한다: DramaDetailScreen의 비로그인 회차 팝업, LibraryScreen의 비로그인 보관함, PointsScreen의 비로그인 내역, RecommendationScreen의 비로그인 저장, playbackScreen_preview의 비로그인 저장, playbackScreen_episode의 인증 필요 안내·비로그인 저장·회차 팝업. 기존 조건·복귀·요청·재생·구매 로직을 보존한다.
`front/src/app/login.tsx`, features/user, HTTP/저장소는 수정하지 않는다. 실제 로그인 성공을 필요로 하는 사용자는 개발용 /login을 계속 사용한다. 화면 시안 완료는 실제 권한을 부여하지 않는다.
task-5의 accountAuth.test.tsx·sessionExpiredDialog.test.tsx, task-7의 기존 소비 화면 테스트로 검증한다.

### AUTH-TEST: 테스트 경계와 검증
Jest 29.7.0, jest-expo 57.0.6, RNTL 13.3.3, React 19.2.3, Expo Router 57.0.20(현재 package.json/lockfile·설치 export 확인). 실제 RNTL render/screen/userEvent, expo-router/testing-library의 renderRouter/testRouter, Stack을 사용한다. testRouter는 자체 act를 수행하므로 중첩 act하지 않는다. 기존 tests/setup.ts의 safe-area·Feather·video mock과 tests/support/video.ts를 재사용한다.
task-3은 새 route·화면·AUTH-AGE를 직접 import, 외부 아이콘 '@expo/vector-icons/FontAwesome'만 필요한 경우 mock한다. 실제 UI/Router 전체 mock 금지. 화면 테스트에서 실제 인증/전송이 없음을 관찰할 때 '@/features/user/UserProvider' 경계의 login/setUser와 fetch/저장소 경계 spy를 필요한 경우 사용하되 실제 계약에 없는 제품 prop·export를 만들지 않는다. 초기 세션은 user:null, points:null, isRestoring:false이며 기존 useUser 타입의 재생 설정·setter도 제공한다. 저장소/API spy는 시안 동작 직전 기준을 잡아 초기 세션 복원과 구분하고 원복한다.
task-5는 accountAuth.test.tsx에서 '@/features/user/UserProvider'의 useUser를 mock하고 실제 AccountScreen과 route를 렌더링한다. null·GUEST·MEMBER·OPERATOR·PARTNER를 parameterize한다. sessionExpiredDialog.test.tsx의 기존 useUser·expo-font 경계를 재사용하며 실제 RootLayout을 검사하고 auth route fixture를 등록한다.
task-7은 각 기존 suite의 useUser와 feature API mock 및 공개 응답 fixture를 재사용한다. 변경된 route fixture key는 'auth/login'. 로그인 버튼을 눌러 pathname과 목적 화면 commit을 확인한다. 실제 API·DB·계정·서버 fixture는 필요 없다. 네트워크 지연 fixture는 기존 deferred helper로 완료한다. fixture 응답 필드·세션 버전·시나리오는 유지한다.
미구현 기능 테스트 작성 task-1·3·5·7의 새 동작 실행은 각각 task-2·4·6·8로 유예한다. 새로운 독립 helper/fixture module·runner 변경이 없고, 관련 모듈 미존재 또는 승인된 경로 동작 구현 전이라 작성 중 checks는 []. import·fixture·이벤트 순서·assertion·계약 대응을 각 작성자가 자체 검토하고 계약별 테스트 이름과 유예 task를 보고한다. 기존 기능만 검증하는 독립 테스트를 새로 추가하게 되면 작성 task에서 실행 가능한 검사로 분리·선언해야 하며 무조건 유예하지 않는다.
소스 task는 실패한 관련 검사로 수정 후 선언된 checks를 모두 통과해야 완료한다. 범위 밖 테스트 수정·assertion 약화 금지, 결함은 메인에 보고하고 공통 reset 절차로 해결한다. 최종 전체 typecheck/test/export는 명시적으로 호출할 $finish-plan에서 수행한다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | auth-age-tests | `front/tests/unit/authAge.test.ts` | 미구현 기능 테스트 작성 |
| 2 | auth-age-source | `front/src/features/auth/authAge.ts` | 소스 구현 및 검증 |
| 3 | auth-screen-tests | `front/tests/unit/authScreens.test.tsx` | 미구현 기능 테스트 작성 |
| 4 | auth-screen-source | `front/src/app/auth/login.tsx`<br>`front/src/app/auth/signup.tsx`<br>`front/src/screens/AuthLoginScreen.tsx`<br>`front/src/screens/AuthSignupScreen.tsx`<br>`front/src/components/authUi.tsx` | 소스 구현 및 검증 |
| 5 | account-root-auth-tests | `front/tests/unit/accountAuth.test.tsx`<br>`front/tests/unit/sessionExpiredDialog.test.tsx` | 미구현 기능 테스트 작성 |
| 6 | account-root-auth-source | `front/src/screens/AccountScreen.tsx`<br>`front/src/app/_layout.tsx`<br>`front/README.md`<br>`_docs/ARCHITECTURE.md` | 소스 구현 및 검증 |
| 7 | consumer-auth-navigation-tests | `front/tests/unit/dramaDetailScreen.test.tsx`<br>`front/tests/unit/libraryScreen.test.tsx`<br>`front/tests/unit/pointsScreen.test.tsx`<br>`front/tests/unit/savedVideoScreens.test.tsx`<br>`front/tests/unit/playbackScreenEpisode.test.tsx` | 미구현 기능 테스트 작성 |
| 8 | consumer-auth-navigation-source | `front/src/screens/DramaDetailScreen.tsx`<br>`front/src/screens/LibraryScreen.tsx`<br>`front/src/screens/PointsScreen.tsx`<br>`front/src/screens/RecommendationScreen.tsx`<br>`front/src/screens/playbackScreen_preview.tsx`<br>`front/src/screens/playbackScreen_episode.tsx` | 소스 구현 및 검증 |

## 실행 순서 및 병렬 작업
- task-1·3·5·7은 선행 의존성이 없고 수정 파일이 서로 독립적이며 별도 출력/공용 fixture를 생성하지 않아 병렬 작성 가능하다.
- task-2는 task-1 후 실행. task-4는 task-2·3 후 실행. task-6은 task-4·5 후 실행. task-8은 task-6·7 후 실행.
- task-2 → 4 → 6 → 8의 소스 통합 순서를 유지한다. 각 소스 task는 앞선 독립 테스트 작성 task와 쓰기 파일이 겹치지 않으면 병렬 진행할 수 있다.
- source task의 관련 테스트 실행 중 동일 suite 작성 task는 완료 상태여야 한다. 공유 runner/config/helper는 변경하지 않고 각 Jest 프로세스가 독립적으로 정리한다. export·공용 출력 생성은 task에서 실행하지 않는다.
- 반복 작업 하위 위임은 모든 task에서 불가. task-7·8도 소규모 경로 치환과 기존 fixture 적응으로 직접 수행한다. 메인 제외 최대 worker 4개, 자식 예약 0개, 전체 동시 에이전트 최대 5개(메인 포함).
- 각 task는 dev에서 지정 files만 apply_patch로 수정한다. branch/worktree·직접 commit/push는 하지 않는다.

## 검증과 결과물
### task-2
```powershell
npm --prefix front run test -- tests/unit/authAge.test.ts
```

### task-4
```powershell
npm --prefix front run test -- tests/unit/authScreens.test.tsx tests/unit/authAge.test.ts
```

### task-6
```powershell
npm --prefix front run test -- tests/unit/accountAuth.test.tsx tests/unit/accountSubtitles.test.tsx tests/unit/sessionExpiredDialog.test.tsx tests/unit/authScreens.test.tsx
```

### task-8
```powershell
npm --prefix front run typecheck
npm --prefix front run test -- tests/unit/dramaDetailScreen.test.tsx tests/unit/libraryScreen.test.tsx tests/unit/pointsScreen.test.tsx tests/unit/savedVideoScreens.test.tsx tests/unit/playbackScreenEpisode.test.tsx tests/unit/recommendationPreviewBuffer.test.tsx
npm --prefix front run test -- tests/unit/login.test.ts tests/unit/session.test.ts tests/unit/api.test.ts
```
- task-1·3·5·7은 AUTH-TEST에 따라 미구현 제품에 의존하는 실행을 담당 소스 task로 유예한다. 독립 helper/실행기 추가는 승인 범위에 없다.
- 작성자는 역할별 자체 검토 후 계약 ID별 테스트 이름과 실행/유예를 보고한다. 소스 담당은 변경된 동작·검사 명령·실제 결과·제한을 보고한다.
- frontend source 책임과 전역 상태 문서는 task-6에서 갱신한다. REST·DB 계약은 변경하지 않는다.
- 계획 검증: `node tools/harness/cli.mjs validate --plan plan-56-front-auth-prototype`.
- 실행은 명시적 $harness, 최종 typecheck/test/export 및 commit/push는 명시적 $finish-plan으로 수행한다.

