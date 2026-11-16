# task-3-auth-screen-tests

## 기본 입력
- 이 task 문서와 index.json의 task-3 항목.
- 컨텍스트로 전달된 적용 지침과 선행 task 없음.
- 다른 worker와 같은 저장소를 사용한다. 다른 사람의 변경을 되돌리지 않고 수용한다.

## 읽어야 할 파일
- auth-prototype/tests/unit/authScreens.test.tsx (화면·Router 시나리오)
- auth-prototype/src/screens/AuthLoginScreen.tsx, auth-prototype/src/screens/AuthSignupScreen.tsx (UI·상태 전이)
- auth-prototype/src/components/authUi.tsx (role/name)
- front/tests/setup.ts, front/jest.config.cjs (기존 mock·cleanup)
- front/src/features/user/UserProvider.tsx (공개 세션 타입과 초기화 경계만)
- front/src/common/storage/refreshTokenStorage.ts, front/src/common/storage/refreshTokenStorage.web.ts (전송/저장 spy 필요 시 공개 export만)
- .agents/skills/react-native-testing/SKILL.md 및 references/api-reference-v13.md·references/expo.md
- .agents/skills/javascript-typescript-jest/SKILL.md

## 필요 시 참고할 문서
- 전달된 프로젝트 지침이 누락되거나 변경됐을 때만 루트 AGENTS.md를 확인한다.
- 구조·파일 책임 판단이 필요할 때만 _docs/ARCHITECTURE.md의 Frontend 및 Documentation and tooling 섹션을 확인한다.
- 아래 계약이 누락되거나 충돌할 때만 plan.md의 AUTH-UI·AUTH-FLOW·AUTH-NAV·AUTH-TEST 섹션을 확인하고 메인에 보고한다. 임의로 계약을 변경하지 않는다.
- 테스트 API/SDK 차이가 있을 때만 설치 패키지 타입 및 적용 스킬의 해당 reference를 확인한다. 이미 전달된 전체 공통 문서를 다시 읽을 필요는 없다.

## 실패 시 참고할 파일
- 해당 없음.

## 작업
실제 route를 renderRouter의 Stack에 등록하고 기존 화면 시나리오를 이식한다. 제공자는 Google·카카오·네이버 순서로 검사하고 Apple 부재를 확인한다. 각 제공자 결과·닫기·이력 없는 홈 복귀, 필수 동의·Modal·입력 오류·단계/동의 보존·14세 경계·보호자 대기·홈 완료·Android back을 검사한다. 시안 동작으로 실제 login/setUser나 전송·저장이 발생하지 않는 경계를 관찰한다. 현재 연도 의존을 제거하고 고정 Date를 사용한다.

### 역할과 완료 조건
- 역할: 미구현 기능 테스트 작성.
- 선행 task: 없음.
- 수정 허용 files:
- `front/tests/unit/authScreens.test.tsx`
- checks:
  - [] — 미구현 계약을 검증하는 테스트이며 현재 실행 가능한 독립 helper/runner 변경이 없다.
- 유예 검사·구현 전제: task-4의 두 route·화면·authUi 및 선행 task-2의 authAge가 필요하므로 실행은 task-4로 유예한다.
- 비목표: OAuth/가입 API·실제 저장·인증 권한·관리자·무관한 설정·공용 runner 변경.
- 완료 전에 imports·실제 테스트 export·mock/fixture 초기 상태·입력/비동기 이벤트 순서·assertion을 아래 승인 계약과 대조한다. 계약 ID별 검증 파일·테스트 이름·유예 소스 task를 완료 요약에 기록한다. 작성 완료를 제품 동작 통과로 보고하지 않는다.
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

### AUTH-TEST: 테스트 경계와 검증
Jest 29.7.0, jest-expo 57.0.6, RNTL 13.3.3, React 19.2.3, Expo Router 57.0.20(현재 package.json/lockfile·설치 export 확인). 실제 RNTL render/screen/userEvent, expo-router/testing-library의 renderRouter/testRouter, Stack을 사용한다. testRouter는 자체 act를 수행하므로 중첩 act하지 않는다. 기존 tests/setup.ts의 safe-area·Feather·video mock과 tests/support/video.ts를 재사용한다.
task-3은 새 route·화면·AUTH-AGE를 직접 import, 외부 아이콘 '@expo/vector-icons/FontAwesome'만 필요한 경우 mock한다. 실제 UI/Router 전체 mock 금지. 화면 테스트에서 실제 인증/전송이 없음을 관찰할 때 '@/features/user/UserProvider' 경계의 login/setUser와 fetch/저장소 경계 spy를 필요한 경우 사용하되 실제 계약에 없는 제품 prop·export를 만들지 않는다. 초기 세션은 user:null, points:null, isRestoring:false이며 기존 useUser 타입의 재생 설정·setter도 제공한다. 저장소/API spy는 시안 동작 직전 기준을 잡아 초기 세션 복원과 구분하고 원복한다.
task-5는 accountAuth.test.tsx에서 '@/features/user/UserProvider'의 useUser를 mock하고 실제 AccountScreen과 route를 렌더링한다. null·GUEST·MEMBER·OPERATOR·PARTNER를 parameterize한다. sessionExpiredDialog.test.tsx의 기존 useUser·expo-font 경계를 재사용하며 실제 RootLayout을 검사하고 auth route fixture를 등록한다.
task-7은 각 기존 suite의 useUser와 feature API mock 및 공개 응답 fixture를 재사용한다. 변경된 route fixture key는 'auth/login'. 로그인 버튼을 눌러 pathname과 목적 화면 commit을 확인한다. 실제 API·DB·계정·서버 fixture는 필요 없다. 네트워크 지연 fixture는 기존 deferred helper로 완료한다. fixture 응답 필드·세션 버전·시나리오는 유지한다.
미구현 기능 테스트 작성 task-1·3·5·7의 새 동작 실행은 각각 task-2·4·6·8로 유예한다. 새로운 독립 helper/fixture module·runner 변경이 없고, 관련 모듈 미존재 또는 승인된 경로 동작 구현 전이라 작성 중 checks는 []. import·fixture·이벤트 순서·assertion·계약 대응을 각 작성자가 자체 검토하고 계약별 테스트 이름과 유예 task를 보고한다. 기존 기능만 검증하는 독립 테스트를 새로 추가하게 되면 작성 task에서 실행 가능한 검사로 분리·선언해야 하며 무조건 유예하지 않는다.
소스 task는 실패한 관련 검사로 수정 후 선언된 checks를 모두 통과해야 완료한다. 범위 밖 테스트 수정·assertion 약화 금지, 결함은 메인에 보고하고 공통 reset 절차로 해결한다. 최종 전체 typecheck/test/export는 명시적으로 호출할 $finish-plan에서 수행한다.

### 반복 작업 위임
불가. 날짜 경계 또는 UI/Router 시나리오의 일관된 판단이 필요하고 기계적 대량 반복이 아니다. 자식 슬롯은 0개이며 worker가 직접 통합·검증한다.

### 주요 로직 코드 또는 변경 예시

```tsx
import { screen, userEvent } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import AuthLoginRoute from '@/app/auth/login';
test('세 제공자를 승인 순서로 표시한다', () => {
  renderRouter({
    _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
    'auth/login': AuthLoginRoute,
  }, { initialUrl: '/auth/login' });
  const labels = screen.getAllByRole('button', { name: /로 로그인$/ })
    .map(button => button.props.accessibilityLabel);
  expect(labels).toEqual(['Google로 로그인', '카카오로 로그인', '네이버로 로그인']);
  expect(screen.queryByRole('button', { name: 'Apple로 로그인' })).not.toBeOnTheScreen();
});
```

