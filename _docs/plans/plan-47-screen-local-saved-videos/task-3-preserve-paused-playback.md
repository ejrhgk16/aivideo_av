# task-3-preserve-paused-playback

## 읽어야 할 파일

- `AGENTS.md`, `front/AGENTS.md`, `_docs/ARCHITECTURE.md`
- `_docs/plans/plan-47-screen-local-saved-videos/plan.md`, `index.json`
- `front/src/screens/RecommendationScreen.tsx`
- `front/src/screens/playbackScreen_preview.tsx`, `front/src/screens/playbackScreen_episode.tsx` (읽기 전용)
- `front/src/features/playback/recommendationPreviewBuffer.ts` (읽기 전용)
- 아래 수정 허용 테스트 세 파일
- 코드 작성 전 `front/AGENTS.md`에 따른 Expo SDK 57 문서: https://docs.expo.dev/versions/v57.0.0/

## 작업

추천 화면에서 사용자가 일시정지한 영상을 저장하거나 저장 해제할 때 다시 재생되는 P2 리뷰 문제를 수정한다. 별도 미리보기·에피소드 화면도 같은 사용자 동작이 일시정지를 유지하는지 테스트한다.

### 수정 허용 파일

- `front/src/screens/RecommendationScreen.tsx`
- `front/tests/unit/recommendationPreviewBuffer.test.ts`
- `front/tests/unit/savedVideoScreens.test.ts`
- `front/tests/unit/playbackScreenEpisode.test.ts`

`task-1`·`task-2` 완료 후 실행한다. 공유 파일이 있으므로 병렬 실행하지 않는다. 다른 작업의 변경을 되돌리지 않고 기존 구현에 맞춰 최소 수정한다. 새 훅·Provider·전역 상태·재생 설정을 추가하지 않는다. 미리보기·에피소드 제품 코드, 추천 버퍼 모듈, UserProvider, API 계약, 테스트 실행기는 수정하지 않는다.

### 원인과 수정 방향

`updateSavedPreview`는 저장 성공 후 collection의 drama 객체를 새로 만든다. 현재 `activePreviewTarget`은 해당 객체를 의존성으로 사용하므로 동일한 영상도 새 target 참조를 갖는다. 자동 재생 effect가 이 참조를 의존하므로 다시 실행되어 `player.play()`를 호출한다.

자동 재생은 현재 영상 식별자·플레이어·포커스 등 실제 재생 조건이 바뀔 때 실행되어야 한다. 저장 플래그나 작품 메타데이터만 바뀔 때는 기존 target 참조와 플레이어를 유지한다. effect 의존성을 무조건 비우거나 필요한 의존성을 숨기지 않는다. collection 갱신·세션 보호·저장 경합 방지·카드 재진입 시 저장 표시 보존도 유지한다.

### 주요 로직 코드 또는 변경 예시

현재 target 생성 부분의 최소 수정 예시는 다음과 같다. 자동 재생 effect의 나머지 준비 상태·현재 영상·buffer 검사는 유지한다.

```tsx
const activeDramaForPreview = dramas.find((drama) => drama.uuid === activeId);
const activePreviewDramaId = activeDramaForPreview?.uuid;
const activePreviewVideoId = activeDramaForPreview?.previewVideos[0]?.uuid;
const activePreviewTarget = useMemo(() =>
  activePreviewDramaId && activePreviewVideoId
    ? { dramaId: activePreviewDramaId, videoId: activePreviewVideoId }
    : null,
[activePreviewDramaId, activePreviewVideoId]);
```

실제 영상 식별자는 같고 저장 플래그만 바뀌면 동일한 target을 재사용하므로 자동 재생 effect가 이 이유로 재실행되지 않는다. 영상이나 준비된 플레이어가 바뀌면 기존 경로로 자동 재생한다. 버퍼 entry 등 다른 의존성도 저장 변경만으로 달라지는지 확인하고, 재현 테스트로 효과를 검증한다. 모든 drama 객체 복사를 고치는 식의 주변 리팩토링은 하지 않는다.

### 테스트와 완료 조건

1. 추천 화면 harness로 영상 준비 → 화면의 일시정지 버튼 → 저장 성공 → 저장 해제 성공을 재현하는 테스트를 먼저 추가한다. 기존 구현에서 저장 성공 후 예상치 못한 `play()`로 실패하는지 확인한다. 실제 저장 API mock의 성공이 부모 collection을 갱신하도록 기존 자식/부모 렌더 경로를 사용한다. `onSavedChange`만 수동 호출하거나 target을 mock해 문제 경로를 우회하지 않는다.
2. 각 저장·해제의 pending 및 완료 재렌더 이후에도 `playing === false`, 추가 `play()` 호출 없음, 같은 플레이어와 재생 위치 유지, 올바른 저장 버튼 표시를 확인한다. 실패 후 재시도나 동일 영상의 metadata 재조회도 일시정지를 풀지 않는지 검사한다.
3. 다음 추천 영상으로 실제 전환하면 준비된 새 영상이 자동 재생되는 기존 동작을 확인한다. 기존 준비 상태 이벤트·스와이프·버퍼 수명 테스트도 통과해야 한다.
4. `savedVideoScreens.test.ts`의 별도 미리보기 harness와 `playbackScreenEpisode.test.ts`의 에피소드 harness에서도 화면 버튼으로 일시정지한 뒤 저장·해제하고 성공 응답까지 처리한다. 같은 플레이어·재생 위치와 일시정지를 유지하는지 확인한다. 필요하면 기존 mock에 재생 호출 횟수·생성 횟수 추적만 최소 추가한다. React 재렌더만으로 플레이어 초기화 콜백을 반복 실행하는 부정확한 mock을 만들지 않는다.
5. 세 화면 테스트는 실제 영상·HTTP 서버·DB 없이 기존 모의 환경에서 실행한다. API 요청 횟수와 재생 호출 횟수 등 관찰 가능한 결과를 검사하고 구현 문자열 비교로 대체하지 않는다.

### 검증 명령

```text
npm --prefix front run typecheck
npm --prefix front run test -- tests/unit/recommendationPreviewBuffer.test.ts tests/unit/savedVideoScreens.test.ts tests/unit/playbackScreenEpisode.test.ts
```

추천 테스트는 직접 변경하는 autoplay와 저장 collection 경로를 검증하고, 나머지 두 테스트는 사용자가 질문한 별도 미리보기·에피소드에서 저장 변경의 재생 영향이 없음을 검증한다. 타입 검사는 target의 nullable 값과 props 호환을 확인한다. 전체 프론트 test·export는 최종 `$finish-plan`에서 수행한다. 재현 실패 확인과 수정 후 선택 검사의 실제 결과를 완료 보고에 기록한다.
