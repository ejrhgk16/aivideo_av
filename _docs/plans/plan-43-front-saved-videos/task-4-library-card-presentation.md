# task-4-library-card-presentation

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/plan-43-front-saved-videos/plan.md`
- `_docs/plans/plan-43-front-saved-videos/index.json`
- `back/src/playback/savedVideoService.ts`
- `back/src/content/mediaUrl.ts`
- `back/src/programming/publicCollectionService.ts`
- `back/test/api/README.md`
- `back/test/api/run.mjs`
- `back/test/api/public.postman_collection.json`
- `_docs/api/04-playback/saved-videos.md`
- `front/src/screens/HomeScreen.tsx`
- `front/src/screens/LibraryScreen.tsx`
- `front/src/features/playback/savedVideos.ts`
- `front/tests/unit/libraryScreen.test.ts`
- `_docs/plans/plan-44-scoped-parallel-tests/index.json`
- `_docs/plans/plan-45-saved-video-review-fixes/index.json`
- 프론트 제품 코드를 쓰기 전에 `front/AGENTS.md`에 따라 Expo 57 공식 버전 문서 `https://docs.expo.dev/versions/v57.0.0/`를 읽는다.

## 작업

보관함의 저장 영상 카드 이미지를 메인 TOP3와 같은 크기·이미지 출처로 맞추고, 드라마명·영상 종류·실제 영상시간을 표시한다. 프리뷰가 1분 미만일 때 0분으로 표시되는 문제를 고친다.

### 정확한 수정 범위

아래 5개 파일만 수정한다. 읽기 참고 파일과 수정 허용 파일을 혼동하지 않는다.

- `back/src/playback/savedVideoService.ts`
- `_docs/api/04-playback/saved-videos.md`
- `back/test/api/public.postman_collection.json`
- `front/src/screens/LibraryScreen.tsx`
- `front/tests/unit/libraryScreen.test.ts`

`depends_on: ["task-3"]`이다. 기존 task-1~3의 completed 상태를 유지하고 이 task만 실행한다. 같은 코드베이스에서 다른 작업도 진행될 수 있으므로 다른 사람의 변경을 되돌리지 말고 현재 구현에 맞춰 수정한다. plan-44 task-2 및 plan-45 task-3과 공유하는 Postman 컬렉션을 동시에 수정하지 않는다. plan-44의 컬렉션 분리가 먼저 완료되었다면 실행 전 정확한 task 파일 범위를 갱신·검증하고 현재 저장 테스트 파일에 반영한다. 옛 컬렉션을 복원하거나 선언 밖 파일을 수정하지 않는다.

### 구현 지시

1. 저장 목록의 기존 drama JOIN을 재사용한다. 이미지 서브쿼리에서 EPISODE_COVER 선택을 제거하고 DRAMA 소유 POSTER_LANDSCAPE, 없으면 POSTER를 선택한다. 각 종류 안에서는 기존 displayOrder ASC 규칙을 유지한다. 이미지나 공개 URL 설정이 없으면 기존처럼 null이다. 영상마다 별도 상세 API를 부르는 N+1 조회나 추가 JOIN은 도입하지 않는다.
2. PREVIEW와 EPISODE에 동일한 드라마 이미지 규칙을 적용한다. imageUrl 필드명·타입과 durationMs 등 응답 구조는 유지한다. durationMs는 현재 저장된 정확한 content_video의 길이이며 episode.durationMs로 바꾸지 않는다. 기존 인증·공개 조건·30개 페이지·정렬·저장/삭제 동작은 유지한다.
3. `_docs/api/04-playback/saved-videos.md`의 회차 커버 우선 설명을 드라마 POSTER_LANDSCAPE → POSTER → null로 바꾼다. 종류에 관계없이 동일한 포스터라는 점과 durationMs가 저장 영상의 밀리초 길이라는 점을 명시한다.
4. LibraryScreen 이미지와 이미지 없는 placeholder를 112×63으로 맞춘다. HomeScreen의 TOP3 rankImage를 참고해 반경 7과 cover 표시를 적용한다. 메인 화면 자체와 공통 컴포넌트는 수정하지 않는다.
5. 카드의 텍스트는 첫 줄 dramaTitle, 둘째 줄 PREVIEW면 미리보기/EPISODE면 에피소드 n화, 셋째 줄 영상시간으로 구성한다. episodeTitle은 카드에서 표시하지 않으며 API 필드 자체는 유지한다. 접근성 버튼 설명도 종류별 문구와 일치시킨다.
6. 기존 Math.floor(durationMs / 60000)분을 화면 내부의 작은 포맷 함수로 교체한다. 15,000ms → 15초, 60,000ms → 1분, 90,000ms → 1분 30초, 125,000ms → 2분 5초, 120,000ms → 2분으로 표시한다. 밀리초 잔여분은 버리고 유효한 양수 1초 미만은 1초로 표시한다. 시간 단위 신규 UI나 공통 유틸 추상화는 추가하지 않는다.
7. 기존 목록 조회·추가 페이지·재시도·로그인·계정 전환 차단·종류별 재생 이동은 유지한다. 시청 기록 탭, 저장 버튼, 메인 화면, DB 스키마·시드·runner·테스트 실행기는 수정하지 않는다.

### 주요 로직 코드 또는 변경 예시

저장 목록 쿼리의 기존 이미지 addSelect를 아래와 같이 변경한다. 기존 base 응답 매핑에서 imageKey로 공개 URL을 생성하는 흐름은 유지한다.

```ts
.addSelect(sub => sub.select('image.storageKey').from(ContentImage, 'image')
  .where("image.contentType = 'DRAMA' AND image.contentId = drama.id")
  .andWhere("image.kind IN ('POSTER_LANDSCAPE', 'POSTER')")
  .orderBy("CASE image.kind WHEN 'POSTER_LANDSCAPE' THEN 0 ELSE 1 END", 'ASC')
  .addOrderBy('image.displayOrder', 'ASC')
  .limit(1), 'imageKey')
```

보관함 내부 함수와 기존 FlatList renderItem의 표시 예시다. 기존 Pressable onPress 및 목록 상태 처리는 유지한다.

```tsx
function formatSavedDuration(durationMs: number): string {
  const totalSeconds = Math.max(1, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}초`;
  return seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`;
}

const videoLabel = item.contentType === 'PREVIEW'
  ? '미리보기'
  : `에피소드 ${item.episodeNumber}화`;

return <Pressable
  accessibilityRole="button"
  accessibilityLabel={`${item.dramaTitle} ${videoLabel}`}
  style={styles.card}
  onPress={() => router.push(savedVideoRoute(item))}
>
  {item.imageUrl
    ? <Image source={{ uri: resolveApiImageUrl(item.imageUrl) ?? undefined }}
        contentFit="cover" style={styles.image} />
    : <View style={[styles.image, styles.imagePlaceholder]} />}
  <View style={styles.cardText}>
    <AppText weight="semibold" numberOfLines={1}>{item.dramaTitle}</AppText>
    <AppText style={styles.meta}>{videoLabel}</AppText>
    <AppText style={styles.meta}>{formatSavedDuration(item.durationMs)}</AppText>
  </View>
</Pressable>;

// styles.image: width: 112, height: 63, borderRadius: 7,
// borderCurve: 'continuous', backgroundColor: colors.elevated
```

Postman은 기존 저장 시나리오에서 runner가 등록·정리하는 PREVIEW 30개와 임시 paid FULL이 저장된 시점의 combined를 사용한다. 아래는 기존 send/token을 사용하는 비교 예시다. 테스트별 send 인수가 전체 URL인지 상대 경로인지는 현재 구현에 맞춘다.

```js
const baseUrl = pm.variables.replaceIn('{{baseUrl}}');
for (const type of ['PREVIEW', 'EPISODE']) {
  const item = combined.find(saved => saved.contentType === type);
  pm.expect(item, type + ' saved fixture must exist').to.exist;
  const response = await send('GET', baseUrl + '/dramas/' + item.dramaUuid, token);
  pm.expect(response.code).to.equal(200);
  const drama = response.json();
  const expected = drama.imageUrls.posterLandscape ?? drama.imageUrls.poster;
  pm.test(type + ' saved card uses the drama poster', () => {
    pm.expect(item.imageUrl).to.equal(expected);
    pm.expect(item.durationMs).to.satisfy(Number.isInteger).and.be.above(0);
  });
}
```

### 검증과 완료 조건

- `front/tests/unit/libraryScreen.test.ts`의 기존 실제 화면 VM harness를 확장한다. API fixture에 15초 PREVIEW, 회차 제목이 있는 125초 EPISODE를 주고 renderItem 결과의 AppText들이 각각 드라마명/미리보기/15초, 드라마명/에피소드 2화/2분 5초인지 검증한다. 회차 제목이 출력되지 않음을 확인한다.
- 60초·90초·120초 및 양수 1초 미만의 카드 시간도 검증한다. helper 구현 복사 대신 실제 화면의 텍스트를 검사한다. 이미지 source/contentFit, 이미지와 placeholder의 112×63 크기를 확인한다. 기존 이동·페이지·에러·계정 전환 테스트는 유지한다. 이미 등록된 테스트 파일을 확장하므로 test-front.cjs 변경은 필요 없다.
- Postman의 기존 saved-video HTTP 시나리오에서 임시 FULL과 PREVIEW가 함께 저장된 시점에 상세 응답의 드라마 포스터와 비교한다. 단순 문자열 여부만 확인하지 않는다. 새 저장 fixture를 만들지 않고, 기존 runner가 소유권을 기록하고 finally에서 정리하는 항목만 재사용한다. plan-45에서 다루는 기존 FULL 저장 cleanup 수정은 이 task에 포함하지 않는다.
- 포스터 fallback과 이미지 없음은 실제 기존 데이터가 해당 조건을 제공하면 HTTP로 비교한다. 없는 조건을 만들기 위해 기존 이미지·시드·DB를 변경하지 않는다. 해당 조건의 실데이터 검증 한계는 결과에 기록하고 쿼리와 API 문서의 우선순위도 대조한다.
- 기존 `http://localhost:3000` 서버의 HTTP 연결과 코드 반영을 확인하고 실제 개발 DB 대상 검증을 실행한다. 서버가 없으면 실패로 처리하고 `npm --prefix back run start:dev`를 안내한다. 수동 UI 검증에 필요한 `http://localhost:8081` 서버가 없으면 실패와 `npm --prefix front run start -- --port 8081`를 안내한다. 서버를 자동 실행하거나 다른 포트로 우회하지 않는다. URL 이미지·영상 객체 다운로드 검증은 추가하지 않는다.
- 다른 계획과 전체 API 검증·프론트 export가 겹치지 않도록 조정한 뒤 아래 checks를 모두 통과한다. 이번 task 변경 후 검증 결과만 새 결과로 보고한다.

```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
```

- 위 5개 파일 안에서 승인된 표시·포스터 선택·문서·테스트 변경만 남고, 본편/프리뷰 이동과 페이지 처리 회귀 없이 모든 checks가 통과하면 완료다.
