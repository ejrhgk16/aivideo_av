# task-11-drama-detail-slide-source

## 기본 입력
- 이 task 문서와 index.json의 task-11 항목.
- 컨텍스트로 전달된 루트 AGENTS.md 및 적용 지침 원문, 선행 task 완료 요약.
- 선행 task: task-10.
- 다른 작업자가 같은 저장소에서 작업한다. 다른 task의 변경을 되돌리지 말고 승인된 파일 안에서 수용한다.

## 읽어야 할 파일
- front/src/app/_layout.tsx: AppNavigation Stack와 drama/[id] 선언

- front/package.json·front/package-lock.json: 해당 라이브러리 버전 항목만; 실행 환경과 계약 버전 확인.

## 필요 시 참고할 문서
- AGENTS.md: 전달된 원문이 누락되었거나 이후 변경된 경우만.
- _docs/ARCHITECTURE.md의 Frontend 및 Boundaries: 파일 책임/모듈 경계를 바꿔야 한다고 판단한 경우만. 승인 범위와 충돌하면 변경하지 않고 메인에 보고.
- plan.md의 DETAIL-NAV·LOAD-TEST 섹션: 아래 계약의 누락/불일치가 발견된 경우만. 전체 plan 재조회 불필요.
- front/README.md의 검증: 선택 실행 명령/서버 정책이 누락되거나 달라졌을 때만.
- https://docs.expo.dev/router/advanced/stack/ 및 설치된 expo-router/의 Stack 타입과 내부 의존 native-stack 타입: animation 옵션 지원을 확인할 때만.

## 실패 시 참고할 파일
- front/tests/unit/sessionExpiredDialog.test.tsx: RootLayout 소비 회귀가 실패한 경우 해당 렌더/mocks

## 작업
drama/[id]의 Stack.Screen에만 options={{ animation: 'slide_from_right' }}를 추가한다. 새 로직·새 모듈·새 테스트는 없다. 기본 Stack screenOptions와 다른 route·탭 전환을 바꾸지 않는다. 설치 SDK의 공식 문서·타입에서 옵션을 확인하고 typecheck 및 RootLayout 소비 회귀를 실행한다. RNTL은 실제 네이티브 전환을 검증하지 않으므로 기기 확인 여부를 별도로 보고한다.

### 역할과 완료 조건
- 역할: **소스 구현·선언 설정**.
- 수정 허용 files:
  - `front/src/app/_layout.tsx`
- checks(저장소 루트에서 실행):
  - `npm --prefix front run typecheck`
  - `npm --prefix front run test -- tests/unit/sessionExpiredDialog.test.tsx`
- 선행 task-10 완료 후 선언 옵션을 변경하고 checks를 모두 실행·통과해야 완료한다. 이 단일 선언 변경은 새 테스트 작성 task 없이 기존 RootLayout 소비 검사를 사용한다.
- 범위: 승인 계약의 표시 동작과 해당 소비만. 백엔드·API·전역 상태·영상 내부 동작·다른 route는 변경하지 않는다.
- 수정은 files 안에서 apply_patch만 사용한다. branch/worktree·commit/push·자동 서버 실행을 하지 않는다.
- 작성자는 완료 전 import·실제 export·fixture/mock 전제·이벤트 순서·assertion을 계약 및 도구 API에 대조한다. 기존 시나리오를 skip/약화하거나 경고를 숨기지 않는다.
- 소스 작업자는 관련 실패 검사로 먼저 수정하고 최종 변경 후 선언 checks를 모두 통과시킨다. 테스트 결함이면 범위 밖 수정 없이 메인에 보고한다.
- 완료 요약: 계약 ID별 검증 파일/테스트 이름, 실제 실행 명령과 suite/test/skip 결과, 유예한 검사와 소스 task, 기기/실서버 검증의 결과 또는 미실행을 구분한다. 별도 검토 task는 없다.

### 적용 계약
아래는 plan.md 원본 계약의 해당 task 발췌다. 이름·타입·기본값·동작을 임의로 바꾸지 않는다. 충돌은 메인에 보고하고 관련 작업을 보류한다.

#### DETAIL-NAV
정의/소유: `front/src/app/_layout.tsx`의 기존 AppNavigation 내부 Stack.Screen, task-11. RootLayout default export와 route 호출 소비자는 그대로.
정확한 변경: `<Stack.Screen name="drama/[id]" options={{ animation: 'slide_from_right' }} />`.
기존 router.push로 드라마 상세 진입 시 네이티브 화면이 오른쪽에서 진입; 데이터 준비를 기다려 전환을 지연하지 않음. 복귀는 Stack의 기본 pop 동작. headerShown=false·다른 route·탭 전환/탭바 유지. 웹에 네이티브와 동일한 애니메이션을 보장하는 별도 구현은 추가하지 않음.
근거: SDK 57.0.21 / expo-router 57.0.20, [공식 Stack 문서](https://docs.expo.dev/router/advanced/stack/). 실행 시 설치 타입과 typecheck로 확인. RNTL에서는 실제 네이티브 이동 프레임을 검증하지 않으며 기기 확인 결과/미실행을 별도로 보고.

#### LOAD-TEST
runner/라이브러리: package.json 및 package-lock.json 기준 Expo 57.0.21, expo-router 57.0.20, React Native 0.86.3, Jest 29.7.0, jest-expo 57.0.6, RNTL 13.3.3, TypeScript 6.0.3. 실행 시 설치 버전/export와 일치 여부 확인; 임의 업그레이드 없음.
검증 책임: task-1→2(공통); 3→4(홈/찾기); 5→6(보관함/포인트); 7→8(추천); 9→10(상세/본편/프리뷰 및 savedVideoScreens 통합); 11(RootLayout 소비). 새 공개 export를 import하는 task-1은 타입/동작 검사를 task-2로 유예. 다른 테스트 작성 task는 task-2 뒤 typecheck 가능하므로 즉시 실행하며 변경 동작 검사는 명명된 소스 task로만 유예. 기존 테스트 시나리오와 의미를 보존하고 skip·경고 무시·assertion 약화 금지.
실제 공간 배치/네이티브 슬라이드는 RNTL 범위 밖. 접근성·상태 전환은 자동 검사하고 기기 중앙 정렬·전환은 별도로 보고. 서버 확인은 기존 localhost:8081/3000만 허용하며 서버가 없으면 실환경 검증 실패로 보고하고 자동 실행하지 않음. 안내 명령: `npm --prefix front run start -- --port 8081`, `npm --prefix back run start:dev`.

### 반복 작업 위임
불가. 이 task는 한 route 선언을 바꾸는 작은 작업이므로 하위 worker를 만들지 않는다. 하위 슬롯 배정 0. 부모가 직접 통합·검증하고 파일 밖 변경은 하지 않는다.

### 주요 로직 코드 또는 변경 예시
새 로직 없음. front/src/app/_layout.tsx에서 기존 `<Stack.Screen name="drama/[id]" />`를 `<Stack.Screen name="drama/[id]" options={{ animation: 'slide_from_right' }} />`로 치환한다. 다른 Screen과 기본 screenOptions는 유지한다.
