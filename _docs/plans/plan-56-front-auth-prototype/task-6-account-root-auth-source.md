# task-6-account-root-auth-source

## 기본 입력
- 이 task 문서와 index.json의 task-6 항목.
- 컨텍스트로 전달된 적용 지침과 task-4·task-5 완료 요약.
- 다른 worker와 같은 저장소를 사용한다. 다른 사람의 변경을 되돌리지 않고 수용한다.

## 읽어야 할 파일
- front/src/screens/AccountScreen.tsx (프로필·기존 설정)
- front/src/app/_layout.tsx (Stack·만료 이동)
- front/src/features/user/UserProvider.tsx (user 공개 타입만)
- front/src/components/ui.tsx (Button)
- front/README.md (프로토타입·전역 상태·검증)
- _docs/ARCHITECTURE.md (Frontend·Documentation의 prototype 역할)

## 필요 시 참고할 문서
- 전달된 프로젝트 지침이 누락되거나 변경됐을 때만 루트 AGENTS.md를 확인한다.
- 구조·파일 책임 판단이 필요할 때만 _docs/ARCHITECTURE.md의 Frontend 및 Documentation and tooling 섹션을 확인한다.
- 아래 계약이 누락되거나 충돌할 때만 plan.md의 AUTH-ENTRY·AUTH-NAV·AUTH-UI 섹션을 확인하고 메인에 보고한다. 임의로 계약을 변경하지 않는다.
- 테스트 API/SDK 차이가 있을 때만 설치 패키지 타입 및 적용 스킬의 해당 reference를 확인한다. 이미 전달된 전체 공통 문서를 다시 읽을 필요는 없다.

## 실패 시 참고할 파일
- front/tests/unit/accountAuth.test.tsx, front/tests/unit/sessionExpiredDialog.test.tsx, front/tests/unit/accountSubtitles.test.tsx, front/tests/unit/authScreens.test.tsx (실패 지점)

## 작업
기존 프로필 부근에 조건부 로그인·회원가입 버튼을 추가하고 루트 Stack에 두 인증 route를 연결한다. 만료 팝업 onLogin의 목적지를 변경한다. README에 front의 /auth/login·/auth/signup과 개발용 /login, 시안 비저장·비인증 동작과 로컬 상태 소유권을 기록한다. ARCHITECTURE의 인증 화면/연령 함수 책임을 현재 front 구조 설명에 반영하고 auth-prototype 보존 설명은 유지한다. 전체 AccountScreen을 원본으로 덮어쓰지 않아 자막 설정을 보존한다.

### 역할과 완료 조건
- 역할: 소스 구현 및 검증.
- 선행 task: task-4, task-5.
- 수정 허용 files:
- `front/src/screens/AccountScreen.tsx`
- `front/src/app/_layout.tsx`
- `front/README.md`
- `_docs/ARCHITECTURE.md`
- checks:
```powershell
npm --prefix front run test -- tests/unit/accountAuth.test.tsx tests/unit/accountSubtitles.test.tsx tests/unit/sessionExpiredDialog.test.tsx tests/unit/authScreens.test.tsx
```
- 선언한 checks를 실제 실행·통과하고 결과를 보고해야 완료한다.
- 비목표: OAuth/가입 API·실제 저장·인증 권한·관리자·무관한 설정·공용 runner 변경.
- 먼저 직접 실패한 관련 검사로 수정하고 마지막에 위 선언 검사를 모두 통과한다. 범위 밖 테스트를 수정하거나 기대값을 약화하지 않는다. 결함 발견 시 계약 근거를 메인에 보고하고 공통 reset 절차를 따른다.
- 이 task는 전체 회귀 검사를 선언하지 않는다. 전체 typecheck/test/export는 finish 단계에서 수행한다.

### 적용 계약
아래 발췌의 원본은 plan.md의 동일 ID 섹션이다. 충돌 시 작업을 보류하고 메인에서 일치시킨다.

### AUTH-ENTRY: 기존 앱 진입점
정의 담당 task-6(루트·계정), task-8(소비 화면), 테스트 소비 task-5·7.
`front/src/app/_layout.tsx`의 세션 만료 onLogin은 기존 dismissSessionExpired() 후 router.push('/auth/login')한다. Stack에 auth/login과 auth/signup을 등록하고 기존 login도 유지한다. 기존 닫기·시스템 닫힘 동작과 단일 Provider/만료 팝업 구조를 보존한다.
`front/src/screens/AccountScreen.tsx`는 user === null 또는 user.accountType === 'GUEST'일 때 button '로그인' → push('/auth/login'), button '회원가입' → push('/auth/signup')을 프로필 부근에 표시한다. MEMBER·OPERATOR·PARTNER에서는 두 버튼을 숨긴다. 포인트·자막 설정·선호 언어를 유지한다. 기존 null/GUEST 라벨은 변경하지 않는다.
다음 기존 사용자 로그인 이동의 목적지만 '/login'에서 '/auth/login'으로 변경한다: DramaDetailScreen의 비로그인 회차 팝업, LibraryScreen의 비로그인 보관함, PointsScreen의 비로그인 내역, RecommendationScreen의 비로그인 저장, playbackScreen_preview의 비로그인 저장, playbackScreen_episode의 인증 필요 안내·비로그인 저장·회차 팝업. 기존 조건·복귀·요청·재생·구매 로직을 보존한다.
`front/src/app/login.tsx`, features/user, HTTP/저장소는 수정하지 않는다. 실제 로그인 성공을 필요로 하는 사용자는 개발용 /login을 계속 사용한다. 화면 시안 완료는 실제 권한을 부여하지 않는다.
task-5의 accountAuth.test.tsx·sessionExpiredDialog.test.tsx, task-7의 기존 소비 화면 테스트로 검증한다.

### AUTH-NAV: 화면 복귀
정의 담당 task-4, 테스트 소비 task-3. 로그인 '닫기', '나중에 할게요', 결과 '확인'은 canGoBack이면 back(), 아니면 replace('/')한다. '처음이라면 시작하기' link는 dismissTo('/auth/signup'), 회원가입 1·2단계의 '이미 계정이 있나요? 로그인' link는 push('/auth/login')이다. 3단계에서 해당 link는 숨긴다.
회원가입에서 로그인으로 이동한 뒤 나중에 하기·닫기·시작하기 링크로 복귀할 때 기존 약관 선택과 입력 단계가 보존된다. 원본 Stack 상태 유지 방식을 재사용하며 Provider/내비게이션을 재마운트하지 않는다. 직접 진입, 이전 화면 존재, 왕복 입력 상태를 tests/unit/authScreens.test.tsx에서 검증한다.

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

### 반복 작업 위임
불가. 날짜 경계 또는 UI/Router 시나리오의 일관된 판단이 필요하고 기계적 대량 반복이 아니다. 자식 슬롯은 0개이며 worker가 직접 통합·검증한다.

### 주요 로직 코드 또는 변경 예시

```tsx
const showAuthEntry = user === null || user.accountType === 'GUEST';
// 기존 프로필 부근 JSX:
{showAuthEntry ? <View>
  <Button label="로그인" onPress={() => router.push('/auth/login')} />
  <Button label="회원가입" variant="secondary" onPress={() => router.push('/auth/signup')} />
</View> : null}
// AppNavigation의 기존 만료 팝업 callback:
onLogin={() => {
  dismissSessionExpired();
  router.push('/auth/login');
}}
// 기존 login 등록과 함께 Stack.Screen name="auth/login", name="auth/signup" 추가.
```

