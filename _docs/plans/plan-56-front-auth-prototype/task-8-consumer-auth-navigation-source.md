# task-8-consumer-auth-navigation-source

## 기본 입력
- 이 task 문서와 index.json의 task-8 항목.
- 컨텍스트로 전달된 적용 지침과 task-6·task-7 완료 요약.
- 다른 worker와 같은 저장소를 사용한다. 다른 사람의 변경을 되돌리지 않고 수용한다.

## 읽어야 할 파일
- front/src/screens/DramaDetailScreen.tsx, front/src/screens/LibraryScreen.tsx, front/src/screens/PointsScreen.tsx, front/src/screens/RecommendationScreen.tsx, front/src/screens/playbackScreen_preview.tsx, front/src/screens/playbackScreen_episode.tsx (各 '/login' 이동 handler와 조건 주변만)

## 필요 시 참고할 문서
- 전달된 프로젝트 지침이 누락되거나 변경됐을 때만 루트 AGENTS.md를 확인한다.
- 구조·파일 책임 판단이 필요할 때만 _docs/ARCHITECTURE.md의 Frontend 및 Documentation and tooling 섹션을 확인한다.
- 아래 계약이 누락되거나 충돌할 때만 plan.md의 AUTH-ENTRY 섹션을 확인하고 메인에 보고한다. 임의로 계약을 변경하지 않는다.
- 테스트 API/SDK 차이가 있을 때만 설치 패키지 타입 및 적용 스킬의 해당 reference를 확인한다. 이미 전달된 전체 공통 문서를 다시 읽을 필요는 없다.

## 실패 시 참고할 파일
- front/tests/unit/dramaDetailScreen.test.tsx, front/tests/unit/libraryScreen.test.tsx, front/tests/unit/pointsScreen.test.tsx, front/tests/unit/savedVideoScreens.test.tsx, front/tests/unit/playbackScreenEpisode.test.tsx, front/tests/unit/recommendationPreviewBuffer.test.tsx (실패 시나리오)
- front/tests/unit/login.test.ts, front/tests/unit/session.test.ts, front/tests/unit/api.test.ts (인증 회귀 실패 시 관련 case)

## 작업
승인된 6개 화면의 router 로그인 목적지만 /auth/login으로 바꾼다. 구매 시 points 분기, 권한·저장 조건, 콘텐츠 로딩·재생·버퍼·자막 로직은 그대로 둔다. 코드 흐름 추가 없이 같은 목적지 문자열을 치환하는 작업이다. typecheck는 선행 모든 제품 구현 뒤에 실행하므로 미래 모듈 미존재에 의한 실패를 피한다.

### 역할과 완료 조건
- 역할: 소스 구현 및 검증.
- 선행 task: task-6, task-7.
- 수정 허용 files:
- `front/src/screens/DramaDetailScreen.tsx`
- `front/src/screens/LibraryScreen.tsx`
- `front/src/screens/PointsScreen.tsx`
- `front/src/screens/RecommendationScreen.tsx`
- `front/src/screens/playbackScreen_preview.tsx`
- `front/src/screens/playbackScreen_episode.tsx`
- checks:
```powershell
npm --prefix front run typecheck
npm --prefix front run test -- tests/unit/dramaDetailScreen.test.tsx tests/unit/libraryScreen.test.tsx tests/unit/pointsScreen.test.tsx tests/unit/savedVideoScreens.test.tsx tests/unit/playbackScreenEpisode.test.tsx tests/unit/recommendationPreviewBuffer.test.tsx
npm --prefix front run test -- tests/unit/login.test.ts tests/unit/session.test.ts tests/unit/api.test.ts
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

### 반복 작업 위임
불가. 기존 독립 파일의 경로와 fixture를 좁게 변경하는 소규모 작업이어서 자식 배정·통합 비용이 더 크다. 자식 슬롯은 0개이며 worker가 직접 통합·검증한다.

### 주요 로직 코드 또는 변경 예시
새 로직 없이 목적지 문자열만 바꾼다.
```tsx
// 직접 이동:
router.push('/auth/login');
// 기존 비로그인/포인트 분기:
router.push(user === null ? '/auth/login' : '/points');
// 기존 조건과 action의 나머지 분기는 보존한다.
```

