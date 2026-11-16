# task-5-account-root-auth-tests

## 기본 입력
- 이 task 문서와 index.json의 task-5 항목.
- 컨텍스트로 전달된 적용 지침과 선행 task 없음.
- 다른 worker와 같은 저장소를 사용한다. 다른 사람의 변경을 되돌리지 않고 수용한다.

## 읽어야 할 파일
- front/src/screens/AccountScreen.tsx (프로필·useUser·메뉴)
- front/src/app/_layout.tsx (Stack·세션 만료 onLogin)
- front/src/components/SessionExpiredDialog.tsx (기존 callback)
- front/tests/unit/sessionExpiredDialog.test.tsx (RootLayout fixture·회귀 시나리오)
- front/tests/unit/accountSubtitles.test.tsx (기존 계정 route 패턴)
- front/src/features/user/UserProvider.tsx (공개 useUser 타입만)
- front/tests/setup.ts (cleanup·native mock)
- .agents/skills/react-native-testing/SKILL.md 및 references/api-reference-v13.md·references/expo.md
- .agents/skills/javascript-typescript-jest/SKILL.md

## 필요 시 참고할 문서
- 전달된 프로젝트 지침이 누락되거나 변경됐을 때만 루트 AGENTS.md를 확인한다.
- 구조·파일 책임 판단이 필요할 때만 _docs/ARCHITECTURE.md의 Frontend 및 Documentation and tooling 섹션을 확인한다.
- 아래 계약이 누락되거나 충돌할 때만 plan.md의 AUTH-ENTRY·AUTH-TEST 섹션을 확인하고 메인에 보고한다. 임의로 계약을 변경하지 않는다.
- 테스트 API/SDK 차이가 있을 때만 설치 패키지 타입 및 적용 스킬의 해당 reference를 확인한다. 이미 전달된 전체 공통 문서를 다시 읽을 필요는 없다.

## 실패 시 참고할 파일
- 해당 없음.

## 작업
accountAuth.test.tsx에서 미로그인/GUEST의 두 버튼·각 목적지와 MEMBER/OPERATOR/PARTNER의 버튼 부재를 검사한다. 세션 만료 suite에서 auth/login·auth/signup fixture를 추가하고 목적지를 수정하되 닫기·시스템 닫힘·단일 팝업 assertions는 보존한다. 기존 accountSubtitles 테스트는 수정하지 않는다.

### 역할과 완료 조건
- 역할: 미구현 기능 테스트 작성.
- 선행 task: 없음.
- 수정 허용 files:
- `front/tests/unit/accountAuth.test.tsx`
- `front/tests/unit/sessionExpiredDialog.test.tsx`
- checks:
  - [] — 미구현 계약을 검증하는 테스트이며 현재 실행 가능한 독립 helper/runner 변경이 없다.
- 유예 검사·구현 전제: task-6의 AccountScreen 버튼과 RootLayout route 등록·세션 만료 이동 변경이 필요하다. 새 동작 실행은 task-6에서 수행한다. 기존 단독 팝업 테스트는 기존 것을 유지하는 것으로 테스트 전용 신규 작업이 아니다.
- 비목표: OAuth/가입 API·실제 저장·인증 권한·관리자·무관한 설정·공용 runner 변경.
- 완료 전에 imports·실제 테스트 export·mock/fixture 초기 상태·입력/비동기 이벤트 순서·assertion을 아래 승인 계약과 대조한다. 계약 ID별 검증 파일·테스트 이름·유예 소스 task를 완료 요약에 기록한다. 작성 완료를 제품 동작 통과로 보고하지 않는다.
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
// 이 파일의 renderAccount는 기존 useUser 공개 타입 fixture와
// 실제 AccountScreen을 renderRouter에 연결하는 로컬 helper이다.
test.each([null, 'GUEST'] as const)('체험 상태 %s에서 로그인으로 이동한다', async accountType => {
  const view = renderAccount(accountType);
  await userEvent.setup().press(screen.getByRole('button', { name: '로그인' }));
  expect(await screen.findByText('로그인 목적 화면')).toBeOnTheScreen();
  expect(view.getPathname()).toBe('/auth/login');
});
// 회원가입 이동과 MEMBER/OPERATOR/PARTNER 버튼 부재도 같은 실제 화면으로 검사한다.
```

