# task-2-recommendation-refresh-alignment

## 읽어야 할 파일

- AGENTS.md
- _docs/ARCHITECTURE.md
- _docs/plans/plan-45-saved-video-review-fixes/plan.md
- front/AGENTS.md
- front/src/screens/RecommendationScreen.tsx
- front/src/features/playback/recommendationPreviewBuffer.ts
- front/tests/unit/recommendationPreviewBuffer.test.ts

## 작업

### 파일 범위

- front/src/screens/RecommendationScreen.tsx
- front/tests/unit/recommendationPreviewBuffer.test.ts

선언된 파일만 apply_patch로 수정한다. 다른 작업의 변경을 되돌리지 않는다. dev에서만 작업하고 branch·worktree·commit·push·계획 상태 직접 변경은 하지 않는다.

### 의존성과 검증

- depends_on: ["task-1"]

~~~text
npm --prefix front run test -- tests/unit/recommendationPreviewBuffer.test.ts tests/unit/savedVideoScreens.test.ts
~~~

### 문제와 완료 목표

추천 화면의 스크롤·플레이어 수명과 저장 상태 동기화 소비 테스트를 선택한다. 공통 모듈·계약·실행기를 변경하지 않으므로 전체 test·typecheck·export는 최종 $finish-plan에서 수행한다. savedVideoScreens.test.ts는 검증만 하며 수정 허용 파일이 아니다.

화면 복귀 후 새 컬렉션에서 active UUID는 유지하지만 기존 스크롤 offset은 이전 순서를 가리킬 수 있다. initialScrollIndex는 이미 mounted된 FlatList를 재배치하지 않는다. 순서 변경·비공개 전환·삭제 후에도 화면에 보이는 카드와 재생/조작 대상이 같아야 한다.

### 구현 지시

- 새 컬렉션을 수용한 렌더에서 현재 UUID의 새 인덱스를 계산한다. 이전 UUID가 사라졌으면 현재 코드가 선택한 fallback UUID의 새 인덱스를 사용한다.
- activeId·collection state가 같은 새 목록을 가리킨 뒤 alignment를 요청한다. 응답 callback에서 setCollection 직후 이전 dramasRef로 offset을 계산하지 않는다.
- 기존 stopMotion, pendingAlignmentRef, committedIndexRef, setRequestedOffset, onContentSizeChange, handleScroll 경로를 재사용한다. 단순히 activeId/목록 개수가 바뀔 때만 정렬하면 같은 길이의 재정렬을 놓치므로 collection 수용 자체를 트리거로 삼는다.
- 새 목록 길이와 실제 content height가 맞지 않으면 기다렸다가 정렬한다. 길이가 같아 onContentSizeChange가 다시 발생하지 않는 재정렬은 새 컬렉션 렌더에서 즉시 정렬을 요청한다.
- 실제 scroll offset의 도착과 generation 일치로 pending을 해제한다. 요청 offset만 바꾸고 실제 도착한 것으로 처리하지 않는다. blur·새 요청·resize와 겹친 stale frame/scroll은 새 정렬을 확정하지 못하게 한다.
- 새 목록이 비었거나 카드 높이가 아직 없을 때는 잘못된 index scroll을 보내지 않는다. 기존 초기 배치·resize·휠/드래그·버퍼 수명과 저장 상태 동기화를 유지한다.
- 저장 여부만 바뀐 렌더나 unrelated state 때문에 매번 scroll하거나 VideoPlayer를 재생성하지 않는다.
- 기존 recommendationPreviewBuffer.test.ts의 전체 화면 harness에서 목록 응답을 요청별로 제어할 수 있게 최소 확장한다. 단일 home deferred 결과를 모든 새로고침에 재사용해 변경 목록 케이스를 놓치지 않는다.
- 코드를 쓰기 전 Expo v57 버전 문서를 확인한다. 새 스크롤 라이브러리나 공통 모듈을 도입하지 않는다.

### 주요 로직 코드 또는 변경 예시

다음은 새 컬렉션이 렌더된 뒤 기존 alignment 경로로 연결하는 예시다. 실제 코드에서는 기존 resize/content-size effect와 중복되지 않게 합치고, pending 도착 확인 로직을 그대로 사용한다.

~~~tsx
useEffect(() => {
  if (!screenFocused || !collection) return;
  stopMotion();
  const height = cardHeightRef.current;
  const nextIndex = dramasRef.current.findIndex(drama => drama.uuid === activeIdRef.current);
  if (height <= 0 || nextIndex < 0) {
    pendingAlignmentRef.current = null;
    return;
  }
  committedIndexRef.current = nextIndex;
  const pending = {
    height, generation: generationRef.current, requested: false,
  };
  pendingAlignmentRef.current = pending;
  const expectedHeight = dramasRef.current.length * height;
  if (Math.abs(contentHeightRef.current - expectedHeight) > PAGE_SETTLE_TOLERANCE) return;
  const target = nextIndex * height;
  if (Math.abs(actualOffsetRef.current - target) <= PAGE_SETTLE_TOLERANCE &&
      Math.abs(requestedOffsetRef.current - target) <= PAGE_SETTLE_TOLERANCE) {
    pendingAlignmentRef.current = null;
    return;
  }
  pending.requested = true;
  setRequestedOffset(target);
}, [collection, screenFocused]);
~~~

content height가 늦게 맞춰지는 경우는 기존 pending 요청 effect/콜백을 통해 같은 target으로 보낸다. 같은 길이의 새 컬렉션도 수용 렌더에서 이 흐름을 실행해야 한다. scroll 도착 전 잠금을 사용한다면 기존 드래그/휠 상태 해제 경로까지 일관되게 유지한다.

### 회귀 검증과 완료 조건

- 예: [A,B,C]에서 B를 보고 blur → [B,A,C]로 갱신 → active B, offset 0, B의 조작 버튼/플레이어가 같은 카드에 있음.
- 같은 길이 목록 재정렬은 content-size 이벤트가 없어도 정렬됨.
- 보고 있던 작품이 제거되면 fallback 작품이 화면에 보이고, 목록이 줄어들어 offset이 native에서 clamp되어도 실제 위치와 active가 일치함.
- 전체 작품 제거 시 빈 상태로 전환하고 잘못된 scroll·플레이어 재생을 보내지 않음.
- 갱신 직전 모션/resize/blur가 겹쳐도 stale alignment가 새 인덱스를 덮지 않음. 정렬 완료 후 다음 드래그·휠이 정상 동작함.
- UUID·인덱스·길이가 유지되는 메타데이터/저장 표시 갱신은 재생 중 위치를 불필요하게 초기화하지 않음.
- 기존 추천 플레이어 생성·release, 순차 이동, click 취소, resize 테스트를 유지하고 새 실패 재현을 먼저 추가한다.
- 선언한 check가 통과하면 완료한다. 서버가 필요한 실제 확인에서는 기존 8081/3000을 사용하며 서버를 자동 실행하거나 다른 포트로 우회하지 않는다.
