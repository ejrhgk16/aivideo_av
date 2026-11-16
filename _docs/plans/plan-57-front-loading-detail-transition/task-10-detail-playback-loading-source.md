# task-10-detail-playback-loading-source

## 기본 입력
- 이 task 문서와 index.json의 task-10 항목.
- 컨텍스트로 전달된 루트 AGENTS.md 및 적용 지침 원문, 선행 task 완료 요약.
- 선행 task: task-2, task-9, task-4, task-8.
- 다른 작업자가 같은 저장소에서 작업한다. 다른 task의 변경을 되돌리지 말고 승인된 파일 안에서 수용한다.

## 읽어야 할 파일
- front/src/screens/DramaDetailScreen.tsx: ui import·초기/복원/404/error return
- front/src/screens/playbackScreen_episode.tsx: ui import·loadState/playbackOwner와 초기 return
- front/src/screens/playbackScreen_preview.tsx: ui import·PreviewState/세션소유권과 초기 return
- front/src/components/ui.tsx: LoadingState·Page

- front/package.json·front/package-lock.json: 해당 라이브러리 버전 항목만; 실행 환경과 계약 버전 확인.

## 필요 시 참고할 문서
- AGENTS.md: 전달된 원문이 누락되었거나 이후 변경된 경우만.
- _docs/ARCHITECTURE.md의 Frontend 및 Boundaries: 파일 책임/모듈 경계를 바꿔야 한다고 판단한 경우만. 승인 범위와 충돌하면 변경하지 않고 메인에 보고.
- plan.md의 LOAD-UI·LOAD-MEDIA·LOAD-TEST 섹션: 아래 계약의 누락/불일치가 발견된 경우만. 전체 plan 재조회 불필요.
- front/README.md의 검증: 선택 실행 명령/서버 정책이 누락되거나 달라졌을 때만.


## 실패 시 참고할 파일
- front/tests/unit/dramaDetailScreen.test.tsx: 실패한 로딩/오류 시나리오
- front/tests/unit/playbackScreenEpisode.test.tsx: 실패한 로딩/복원 시나리오
- front/tests/unit/savedVideoScreens.test.tsx: 실패한 프리뷰 또는 홈/추천 통합 시나리오
- front/tests/support/video.ts: player mock 경계 오류일 때만

## 작업
세 화면에서 기존 로딩 조건식은 보존하고 해당 return을 scroll={false} Page와 LoadingState 기본형으로 바꿔 남은 화면 중앙에 표시한다. 로딩 종료 시 원래 상세/재생 레이아웃을 사용한다. 오류/404/로그인/권한/재시도와 플레이어 내부 버퍼링·자막·진행률·저장을 바꾸지 않는다. task-4·8 이후 savedVideoScreens 전체를 실행하여 홈→미리보기·추천 저장 소비 경계도 확인한다. 코드 예시는 DramaDetailScreen의 실제 조건과 return이다. 본편과 프리뷰도 자신의 기존 소유권 조건을 추가한 원래 조건식 전체를 그대로 둔 채 같은 Page/LoadingState 결과로 치환한다.

### 역할과 완료 조건
- 역할: **소스 구현**.
- 수정 허용 files:
  - `front/src/screens/DramaDetailScreen.tsx`
  - `front/src/screens/playbackScreen_episode.tsx`
  - `front/src/screens/playbackScreen_preview.tsx`
- checks(저장소 루트에서 실행):
  - `npm --prefix front run typecheck`
  - `npm --prefix front run test -- tests/unit/dramaDetailScreen.test.tsx tests/unit/playbackScreenEpisode.test.tsx tests/unit/savedVideoScreens.test.tsx`
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

#### LOAD-MEDIA
정의/소유: `RecommendationScreen` named export(`front/src/screens/RecommendationScreen.tsx`)는 task-8; `DramaDetailScreen({ id }: { id: string })` named export(`front/src/screens/DramaDetailScreen.tsx`), `PlaybackScreenEpisode` named export(`front/src/screens/playbackScreen_episode.tsx`), `PlaybackScreenPreview({ dramaId, videoId }: { dramaId: string; videoId: string })` named export(`front/src/screens/playbackScreen_preview.tsx`)는 task-10. 기존 나머지 props/exports는 변경하지 않음. 테스트 task-7·9 소비.
추천은 기존 컬렉션 status loading(복원 포함) 동안 기존 flex:1 피드 영역에 LOAD-UI 기본형 하나. 탭 navigator/하단바를 변경하거나 상단바를 추가하지 않음. 컬렉션 완료 후 기존 error/empty/feed 분기. 영상 URL/플레이어 ready/자막을 새로운 전체 로딩 조건에 포함하지 않음.
상세·본편·프리뷰는 기존 최초 loading·복원·소유권 불일치 조건에서 scroll=false Page와 LOAD-UI 기본형. 결과가 오면 기존 콘텐츠/404/오류/로그인/권한/재시도 분기로 전환. 이전 계정·route의 콘텐츠를 로딩 중 노출하지 않음. API·저장·진행률·플레이어 내부 버퍼링·자막 동작 불변.

#### LOAD-TEST
runner/라이브러리: package.json 및 package-lock.json 기준 Expo 57.0.21, expo-router 57.0.20, React Native 0.86.3, Jest 29.7.0, jest-expo 57.0.6, RNTL 13.3.3, TypeScript 6.0.3. 실행 시 설치 버전/export와 일치 여부 확인; 임의 업그레이드 없음.
검증 책임: task-1→2(공통); 3→4(홈/찾기); 5→6(보관함/포인트); 7→8(추천); 9→10(상세/본편/프리뷰 및 savedVideoScreens 통합); 11(RootLayout 소비). 새 공개 export를 import하는 task-1은 타입/동작 검사를 task-2로 유예. 다른 테스트 작성 task는 task-2 뒤 typecheck 가능하므로 즉시 실행하며 변경 동작 검사는 명명된 소스 task로만 유예. 기존 테스트 시나리오와 의미를 보존하고 skip·경고 무시·assertion 약화 금지.
실제 공간 배치/네이티브 슬라이드는 RNTL 범위 밖. 접근성·상태 전환은 자동 검사하고 기기 중앙 정렬·전환은 별도로 보고. 서버 확인은 기존 localhost:8081/3000만 허용하며 서버가 없으면 실환경 검증 실패로 보고하고 자동 실행하지 않음. 안내 명령: `npm --prefix front run start -- --port 8081`, `npm --prefix back run start:dev`.

### 반복 작업 위임
불가. 이 task는 각 화면의 비동기 상태·fixture 또는 공용 UI 계약을 직접 판단하는 작업이므로 하위 worker를 만들지 않는다. 하위 슬롯 배정 0. 부모가 직접 통합·검증하고 파일 밖 변경은 하지 않는다.

### 주요 로직 코드 또는 변경 예시
아래는 핵심 흐름 예시다. 기존 코드에 연결할 때 계약과 기존 스타일을 유지하고, 테스트용 제품 props 또는 승인되지 않은 새 공개 export를 추가하지 않는다.

```tsx
if (isRestoring || loadState === 'loading') {
  return <Page scroll={false}><LoadingState /></Page>;
}
```
