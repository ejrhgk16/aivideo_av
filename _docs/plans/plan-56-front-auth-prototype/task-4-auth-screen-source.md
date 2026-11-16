# task-4-auth-screen-source

## 기본 입력
- 이 task 문서와 index.json의 task-4 항목.
- 컨텍스트로 전달된 적용 지침과 task-2·task-3 완료 요약.
- 다른 worker와 같은 저장소를 사용한다. 다른 사람의 변경을 되돌리지 않고 수용한다.

## 읽어야 할 파일
- auth-prototype/src/app/auth/login.tsx, auth-prototype/src/app/auth/signup.tsx (route wrapper)
- auth-prototype/src/screens/AuthLoginScreen.tsx, auth-prototype/src/screens/AuthSignupScreen.tsx, auth-prototype/src/components/authUi.tsx (원본 UI·로컬 상태)
- front/src/components/ui.tsx (AppText/Button/Page/Icon·IconName export)
- front/src/common/theme/tokens.ts (colors/typography)
- front/src/features/auth/authAge.ts (선행 task-2 공개 함수)
- .agents/skills/vercel-react-native-skills/SKILL.md (이식 구현에 적용되는 지침만)

## 필요 시 참고할 문서
- 전달된 프로젝트 지침이 누락되거나 변경됐을 때만 루트 AGENTS.md를 확인한다.
- 구조·파일 책임 판단이 필요할 때만 _docs/ARCHITECTURE.md의 Frontend 및 Documentation and tooling 섹션을 확인한다.
- 아래 계약이 누락되거나 충돌할 때만 plan.md의 AUTH-UI·AUTH-FLOW·AUTH-NAV·AUTH-AGE 섹션을 확인하고 메인에 보고한다. 임의로 계약을 변경하지 않는다.
- 테스트 API/SDK 차이가 있을 때만 설치 패키지 타입 및 적용 스킬의 해당 reference를 확인한다. 이미 전달된 전체 공통 문서를 다시 읽을 필요는 없다.

## 실패 시 참고할 파일
- front/tests/unit/authScreens.test.tsx, front/tests/unit/authAge.test.ts (실패한 시나리오)

## 작업
원본 화면·공통 UI·route를 front 스타일에 맞춰 이식한다. Apple 제공자와 관련 아이콘은 제거하고 Google·카카오·네이버 순서로 변경한다. 네이버는 별도 패키지 없이 초록 버튼과 흰 N 문자로 표시한다. 기존 공통 UI·토큰 수정 금지. 화면 state만 변경하고 인증·전송·저장 함수는 호출하지 않는다. 기존 SDK API는 설치된 Expo 57 공식 문서·타입을 확인해 사용한다.

### 역할과 완료 조건
- 역할: 소스 구현 및 검증.
- 선행 task: task-2, task-3.
- 수정 허용 files:
- `front/src/app/auth/login.tsx`
- `front/src/app/auth/signup.tsx`
- `front/src/screens/AuthLoginScreen.tsx`
- `front/src/screens/AuthSignupScreen.tsx`
- `front/src/components/authUi.tsx`
- checks:
```powershell
npm --prefix front run test -- tests/unit/authScreens.test.tsx tests/unit/authAge.test.ts
```
- 선언한 checks를 실제 실행·통과하고 결과를 보고해야 완료한다.
- 비목표: OAuth/가입 API·실제 저장·인증 권한·관리자·무관한 설정·공용 runner 변경.
- 먼저 직접 실패한 관련 검사로 수정하고 마지막에 위 선언 검사를 모두 통과한다. 범위 밖 테스트를 수정하거나 기대값을 약화하지 않는다. 결함 발견 시 계약 근거를 메인에 보고하고 공통 reset 절차를 따른다.
- 이 task는 전체 회귀 검사를 선언하지 않는다. 전체 typecheck/test/export는 finish 단계에서 수행한다.

### 적용 계약
아래 발췌의 원본은 plan.md의 동일 ID 섹션이다. 충돌 시 작업을 보류하고 메인에서 일치시킨다.

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

### 반복 작업 위임
불가. 날짜 경계 또는 UI/Router 시나리오의 일관된 판단이 필요하고 기계적 대량 반복이 아니다. 자식 슬롯은 0개이며 worker가 직접 통합·검증한다.

### 주요 로직 코드 또는 변경 예시

```tsx
const [linked, setLinked] = useState<string | null>(null);
const leave = () => router.canGoBack() ? router.back() : router.replace('/');
const providers = [
  { key: 'google', name: 'Google' },
  { key: 'kakao', name: '카카오' },
  { key: 'naver', name: '네이버' },
] as const;
// 각 제공자 Pressable의 onPress는 다음 로컬 이벤트만 연결한다.
const connectPreview = (name: string) => setLinked(name);
// 회원가입의 제출·시작 이벤트:
const submitBirth = () => {
  setAttempted(true);
  if (check.ok) setStep(3);
};
const start = () => router.replace('/');
```

