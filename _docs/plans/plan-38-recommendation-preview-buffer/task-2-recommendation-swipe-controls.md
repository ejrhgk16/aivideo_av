# task-2-recommendation-swipe-controls

## 읽어야 할 파일
- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/plan-38-recommendation-preview-buffer/plan.md`
- `front/src/screens/RecommendationScreen.tsx`
- `front/src/features/playback/recommendationPreviewBuffer.ts` (참고만, 수정 금지)
- `front/tests/unit/recommendationPreviewBuffer.test.ts`
- Expo 57 문서: https://docs.expo.dev/versions/v57.0.0/ 및 https://docs.expo.dev/versions/v57.0.0/sdk/video/

## 작업
리뷰 P1: 영상 로드 후 목록 위의 전체 화면 Pressable이 터치를 받아 세로 스와이프가 막히는 문제를 수정한다. 버퍼용 VideoView는 유지하고 터치 컨트롤을 FlatList 카드 안으로 옮긴다.

### 수정 책임과 정확한 파일 범위
이 worker는 다음 두 파일만 수정한다. 다른 작업자의 변경을 되돌리지 말고 기존 변경을 반영한다. 수정은 apply_patch로만 한다.
- `front/src/screens/RecommendationScreen.tsx`
- `front/tests/unit/recommendationPreviewBuffer.test.ts`

`depends_on: ["task-1"]`. task-1의 버퍼 구현을 전제로 하며 같은 화면과 테스트 파일을 수정하므로 순차 실행한다.

### 구현 요구
1. `RecommendationPreviewPlayer`의 전체 화면 Pressable, 재생 버튼, 저장·공유·회차 등 대화형 컨트롤을 활성 FlatList 카드의 자식으로 렌더링한다. 카드 밖의 형제 레이어에 대화형 컨트롤을 남기지 않는다. 기존 모달은 기존 기능대로 유지한다.
2. 버퍼 VideoView들은 FlatList 가상화와 분리된 동일 부모·동일 key의 레이어에 계속 마운트한다. 레이어 전체에 `pointerEvents="none"`을 적용하고 개별 VideoView도 터치를 받지 않게 한다. 최대 3개 보관, 고정 `surfaceType="textureView"`, 활성 영상만 표시하는 기존 정책을 유지한다.
3. 영상 레이어를 FlatList보다 아래에 배치하고 활성 카드에서만 배경을 투명하게 하며 포스터를 숨긴다. 비활성 카드, 스크롤 중, preview 없음/오류, blur 상태는 기존 포스터/대체 화면을 유지한다. 목록 배경이 영상을 가리지 않아야 하며 영상이 컨트롤을 덮어서도 안 된다.
4. 현재 카드의 `maxWidth: 500`과 가운데 정렬을 영상 표시 영역에도 맞춘다. 레이어 바깥 화면은 기존 배경으로 유지한다. 불필요한 레이아웃 변경이나 스타일 정리는 하지 않는다.
5. FlatList는 PureComponent이므로 `renderItem`이 참조하는 focus·scroll·활성 페이지·플레이어/오류 상태·상세 정보·saved 변경이 카드에 반영되도록 안정적인 `extraData` 또는 동등한 명시적 갱신을 연결한다. 기존 `extraData={savedIds}`만으로 충분하다고 가정하지 않는다. 화면 render마다 무관한 새 객체를 만들지 않도록 필요한 값으로 memo한다.
6. `trackListener`, 오류 처리, 구매·공유·저장·슬라이더·재생 컨트롤을 카드 안으로 옮겨도 유지한다. 컨트롤 unmount는 플레이어를 release하지 않는다. 버퍼 관리 모듈, 요청 dedup, reset-to-zero, stale 응답/타이머 방지 로직은 변경하지 않는다.
7. 새 제스처 라이브러리나 overlay pan responder로 스크롤을 직접 구현하지 않는다. 기존 FlatList의 세로 paging과 responder 계층을 복구하는 최소 수정으로 해결한다.

### 주요 로직 코드 또는 변경 예시
다음은 레이어와 카드 연결의 핵심 예시다. 실제 타입·기존 prop·스타일에 맞춰 완성한다. 아래 일부 생략된 기존 FlatList prop은 보존한다.

```tsx
const cardState = useMemo(() => ({
  savedIds, screenFocused, scrolling, activeId, activePlayer,
  activeDrama, activeEntry, buffer,
}), [savedIds, screenFocused, scrolling, activeId, activePlayer,
  activeDrama, activeEntry, buffer]);

const renderCard = ({ item: drama }: { item: HomeCollectionDrama }) => {
  const showPreview = screenFocused && !scrolling &&
    activeId === drama.uuid && Boolean(activePlayer);
  const posterUrl = resolveApiImageUrl(drama.imageUrls.poster);
  return <View style={[styles.card, { height: cardHeight },
    showPreview && { backgroundColor: 'transparent' }]}>
    {!showPreview && (posterUrl
      ? <Image source={{ uri: posterUrl }} contentFit="cover" style={StyleSheet.absoluteFill} />
      : <View style={[StyleSheet.absoluteFill, styles.placeholder]} />)}
    {showPreview && <RecommendationPreviewPlayer
      player={activePlayer!}
      drama={drama}
      content={activeDrama}
      saved={savedIds.includes(drama.uuid)}
      trackListener={(subscription) => buffer!.trackSubscription(activePreviewTarget!, activePlayer!, subscription)}
      onError={() => {
        if (focusedRef.current && activeIdRef.current === drama.uuid && bufferRef.current === buffer) {
          buffer?.setUnavailable(activePreviewTarget!, activePlayer!);
        }
      }}
      onToggleSave={() => toggleSave(drama.uuid)}
      onOpenEpisodes={() => openEpisodes(drama)}
      onShare={() => { void shareDrama(drama); }}
    />}
  </View>;
};

const videoLayer = <View pointerEvents="none" style={StyleSheet.absoluteFill}>
  <View pointerEvents="none" style={styles.bufferVideoFrame}>
    {screenFocused && bufferEntries.map((entry) => entry.player && <VideoView
      key={recommendationPreviewKey(entry.target)}
      player={entry.player}
      pointerEvents="none"
      nativeControls={false}
      contentFit="contain"
      surfaceType="textureView"
      style={[StyleSheet.absoluteFill, styles.playerVideo, {
        opacity: !scrolling && entry.kind === 'ready' && entry.target.dramaId === activeId ? 1 : 0,
      }]}
    />)}
  </View>
</View>;
// feed 내부 순서: videoLayer, 그 위에 기존 FlatList.
// 기존 FlatList에 renderItem={renderCard}, extraData={cardState}를 연결한다.
// bufferVideoFrame: width '100%', maxWidth 500, height '100%', alignSelf 'center'.
```

### 회귀 검증
- 기존 화면 VM harness가 `renderItem`으로 만든 카드 서브트리도 검사하도록 보완한다. 현재 수정 전 화면에서는 실패하는 테스트를 먼저 확인한다.
- 준비된 활성 카드의 컨트롤이 FlatList의 renderItem 결과 안에 존재하고 형제 영상 레이어에는 대화형 컨트롤이 없음을 검사한다. 소스 문자열 검사가 아니라 렌더 결과를 검사한다. 미리보기 로드 전후와 1→2 전환을 모두 검사한다.
- 영상 레이어 및 VideoView의 pointerEvents가 none이며 영상 레이어가 목록 아래인 렌더 순서를 검사한다. 활성 카드는 투명·포스터 없음, 비활성/스크롤 중/오류 카드는 포스터 유지인지 검사한다.
- FlatList extraData가 focus·scroll·활성 페이지·플레이어 준비/오류·저장 상태 변화에 갱신되는지 검사한다. 카드 컨트롤을 옮겨도 유지되는 플레이어 참조/key와 URL 요청 수가 기존 재사용 조건을 만족해야 한다.
- 기존 manager/화면 회귀 검사를 유지한다. VM에서 scroll callback 호출이 통과해도 실제 터치 전달 검증으로 보고하지 않는다.

### 검증 명령
- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

### 실제 화면 확인 및 완료 조건
- 기존 `http://localhost:8081`, `http://localhost:3000`에 HTTP로 연결되는지 확인하고 변경 코드가 반영된 화면에서 검사한다. 서버를 자동 실행하거나 다른 포트로 우회하지 않는다.
- 실제 영상 로드 후 영상 중앙의 컨트롤 표시 상태와 숨김 상태 각각에서 터치 드래그로 1→2→1 이동을 확인한다. 단순 wheel이나 scroll callback 호출로 대체하지 않는다. 탭으로 컨트롤 표시/숨김, 재생 버튼, 슬라이더, 저장·회차 등의 기존 동작도 확인한다.
- 남아 있는 영상 요소/플레이어가 이동 시 재생성되지 않고 현재 영상 하나만 재생되며, 페이지 이탈 영상은 0초로 초기화되는지 확인한다.
- 자동 검사 3개 및 새 회귀 검사가 통과해야 한다. 실제 터치 검증 결과와 미검증 플랫폼을 별도로 보고한다. 브라우저/기기 도구가 없으면 실제 터치 확인을 미검증으로 명시하고 통과로 주장하지 않는다.
- 서버가 없으면 해당 실화면 확인은 실패로 기록하고 `npm --prefix front run start -- --port 8081`, `npm --prefix back run start:dev`를 안내한다.
