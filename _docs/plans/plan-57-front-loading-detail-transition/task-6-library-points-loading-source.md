# task-6-library-points-loading-source

## 기본 입력
- 이 task 문서와 index.json의 task-6 항목.
- 컨텍스트로 전달된 루트 AGENTS.md 및 적용 지침 원문, 선행 task 완료 요약.
- 선행 task: task-2, task-5.
- 다른 작업자가 같은 저장소에서 작업한다. 다른 task의 변경을 되돌리지 말고 승인된 파일 안에서 수용한다.

## 읽어야 할 파일
- front/src/screens/LibraryScreen.tsx: 소유권/로딩 분기·FlatList·스타일
- front/src/screens/PointsScreen.tsx: 실제 내역 loading/empty/header/footer·체험 표시·스타일
- front/src/components/ui.tsx: LoadingState·Page

- front/package.json·front/package-lock.json: 해당 라이브러리 버전 항목만; 실행 환경과 계약 버전 확인.

## 필요 시 참고할 문서
- AGENTS.md: 전달된 원문이 누락되었거나 이후 변경된 경우만.
- _docs/ARCHITECTURE.md의 Frontend 및 Boundaries: 파일 책임/모듈 경계를 바꿔야 한다고 판단한 경우만. 승인 범위와 충돌하면 변경하지 않고 메인에 보고.
- plan.md의 LOAD-UI·LOAD-HISTORY·LOAD-TEST 섹션: 아래 계약의 누락/불일치가 발견된 경우만. 전체 plan 재조회 불필요.
- front/README.md의 검증: 선택 실행 명령/서버 정책이 누락되거나 달라졌을 때만.


## 실패 시 참고할 파일
- front/tests/unit/libraryScreen.test.tsx: 실패한 복원/로그인/탭/페이지 시나리오
- front/tests/unit/pointsScreen.test.tsx: 실패한 실제내역·체험 보존 시나리오

## 작업
두 화면의 복원/최초 로딩 안내를 LoadingState로 교체하고 기존 상단·탭·체험 내역을 유지한다. 기본 로딩이 남은 실제 콘텐츠 높이 안에서 중앙 정렬되도록 View/FlatList contentContainerStyle을 필요한 만큼 조정한다. 포인트 실제내역을 기다린다고 체험 행을 숨기지 않는다. 두 목록의 nextLoading footer를 compact형으로 교체하며 계정 소유권·데이터 요청·로그인·실패·빈 상태는 보존한다. 코드 예시는 보관함의 표시 gate다. 포인트의 기존 historyEmpty 우선순위에서 isRestoring 및 !visibleHistory/status loading 두 결과를 각각 <LoadingState />로 치환하고, 실제 내역 footer의 nextLoading 결과는 <LoadingState compact />로 치환한다. 나머지 기존 결과와 historyHeader는 그대로 연결한다.

### 역할과 완료 조건
- 역할: **소스 구현**.
- 수정 허용 files:
  - `front/src/screens/LibraryScreen.tsx`
  - `front/src/screens/PointsScreen.tsx`
- checks(저장소 루트에서 실행):
  - `npm --prefix front run typecheck`
  - `npm --prefix front run test -- tests/unit/libraryScreen.test.tsx tests/unit/pointsScreen.test.tsx`
- 선행 테스트 작성 완료 후 구현하고 선언 checks를 모두 실행·통과해야 완료한다. 테스트 작성 task의 완료를 기능 통과로 간주하지 않는다.
- 범위: 승인 계약의 표시 동작과 해당 소비만. 백엔드·API·전역 상태·영상 내부 동작·다른 route는 변경하지 않는다.
- 수정은 files 안에서 apply_patch만 사용한다. branch/worktree·commit/push·자동 서버 실행을 하지 않는다.
- 작성자는 완료 전 import·실제 export·fixture/mock 전제·이벤트 순서·assertion을 계약 및 도구 API에 대조한다. 기존 시나리오를 skip/약화하거나 경고를 숨기지 않는다.
- 소스 작업자는 관련 실패 검사로 먼저 수정하고 최종 변경 후 선언 checks를 모두 통과시킨다. 테스트 결함이면 범위 밖 수정 없이 메인에 보고한다.
- 완료 요약: 계약 ID별 검증 파일/테스트 이름, 실제 실행 명령과 suite/test/skip 결과, 유예한 검사와 소스 task, 기기/실서버 검증의 결과 또는 미실행을 구분한다. 별도 검토 task는 없다.

### 적용 계약
아래는 plan.md 원본 계약의 해당 task 발췌다. 이름·타입·기본값·동작을 임의로 바꾸지 않는다. 충돌은 메인에 보고하고 관련 작업을 보류한다.

#### LOAD-UI
정의: `front/src/components/ui.tsx`의 named export, task-2 소유; task-1·3~10 소비.
```tsx
export function LoadingState({ compact = false }: { compact?: boolean })
```
반환값은 React element. 입력 compact는 optional boolean이며 기본값 false. 콜백·내부 mutable state·네트워크·전역 상태 없음.
기본형: 남은 콘텐츠 높이를 채워 수평/수직 중앙에 large ActivityIndicator 하나. compact=true: footer 흐름 안에서 small ActivityIndicator 하나(상하 padding 16), 목록을 덮지 않음. 색상 colors.accent.
ActivityIndicator에 accessible=true, accessibilityRole="progressbar", accessibilityLabel="로딩 중", accessibilityState={{ busy: true }}. 화면에 로딩 문구·아이콘·버튼은 표시하지 않음. 호출자는 부모 영역 높이를 제공하며 Page의 기존 기본 배치는 변경하지 않음.

#### LOAD-HISTORY
정의/소유: `LibraryScreen` named export(`front/src/screens/LibraryScreen.tsx`)와 `PointsScreen` named export(`front/src/screens/PointsScreen.tsx`), task-6. task-5가 검증. 입력/export·API 불변.
보관함의 복원 중 또는 로그인 사용자 목록 idle/loading/소유권 미일치 → 상단바·제목·탭 아래 LOAD-UI 기본형 하나. 로그인 복원 완료 후 비회원이면 기존 로그인 안내; 계정 변경 전 목록은 표시하지 않음.
포인트는 복원/실제 내역 최초 조회 중 → 실제 이용 내역 구역에 LOAD-UI 기본형. 뒤로가기·잔액·탭·체험 행과 historyHeader는 유지. 충전 체험 탭을 실제 내역 응답 때문에 가리지 않음.
양쪽 추가 페이지 → 기존 목록과 체험 행 유지+footer compact형. 빈 결과/오류/재시도/로그인 이동/소유권·세션 차단은 기존대로.

#### LOAD-TEST
runner/라이브러리: package.json 및 package-lock.json 기준 Expo 57.0.21, expo-router 57.0.20, React Native 0.86.3, Jest 29.7.0, jest-expo 57.0.6, RNTL 13.3.3, TypeScript 6.0.3. 실행 시 설치 버전/export와 일치 여부 확인; 임의 업그레이드 없음.
검증 책임: task-1→2(공통); 3→4(홈/찾기); 5→6(보관함/포인트); 7→8(추천); 9→10(상세/본편/프리뷰 및 savedVideoScreens 통합); 11(RootLayout 소비). 새 공개 export를 import하는 task-1은 타입/동작 검사를 task-2로 유예. 다른 테스트 작성 task는 task-2 뒤 typecheck 가능하므로 즉시 실행하며 변경 동작 검사는 명명된 소스 task로만 유예. 기존 테스트 시나리오와 의미를 보존하고 skip·경고 무시·assertion 약화 금지.
실제 공간 배치/네이티브 슬라이드는 RNTL 범위 밖. 접근성·상태 전환은 자동 검사하고 기기 중앙 정렬·전환은 별도로 보고. 서버 확인은 기존 localhost:8081/3000만 허용하며 서버가 없으면 실환경 검증 실패로 보고하고 자동 실행하지 않음. 안내 명령: `npm --prefix front run start -- --port 8081`, `npm --prefix back run start:dev`.

### 반복 작업 위임
불가. 이 task는 각 화면의 비동기 상태·fixture 또는 공용 UI 계약을 직접 판단하는 작업이므로 하위 worker를 만들지 않는다. 하위 슬롯 배정 0. 부모가 직접 통합·검증하고 파일 밖 변경은 하지 않는다.

### 주요 로직 코드 또는 변경 예시
아래는 핵심 흐름 예시다. 기존 코드에 연결할 때 계약과 기존 스타일을 유지하고, 테스트용 제품 props 또는 승인되지 않은 새 공개 export를 추가하지 않는다.

```tsx
const listLoading = isRestoring || (!!owner && (
  status === 'loading' || status === 'idle' || (status === 'loaded' && !ownsCurrentList)
));
if (listLoading) {
  return <Page header={<AppTopBar />} scroll={false} contentStyle={styles.page}>
    <SectionTitle eyebrow="MY COLLECTION" title="보관함" />
    <View style={styles.tabs} accessibilityRole="tablist">
      {(['저장한 작품', '시청 기록'] as const).map((item) => <Pressable key={item}
        accessibilityRole="tab" accessibilityState={{ selected: tab === item }}
        style={[styles.tab, tab === item && styles.activeTab]} onPress={() => setSelectedTab(item)}>
        <AppText weight={tab === item ? 'semibold' : 'regular'}
          style={[styles.tabLabel, tab === item && styles.activeLabel]}>{item}</AppText>
      </Pressable>)}
    </View>
    <LoadingState />
  </Page>;
}
```
