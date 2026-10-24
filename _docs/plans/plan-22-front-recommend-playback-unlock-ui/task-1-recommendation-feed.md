# task-1-recommendation-feed

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md` 및 해당 파일이 요구하는 Expo 57 공식 문서
- `front/src/screens/RecommendationScreen.tsx`
- `front/src/features/home/homeContent.ts`
- `front/src/components/ui.tsx`
- `front/src/app/(tabs)/_layout.tsx`, `front/src/app/(tabs)/_layout.web.tsx`
- `web-prototype/components/recommendation-feed.tsx` (UI 대조용, 읽기만)
- `web-prototype/app/globals.css` (추천 카드 스타일 대조용, 읽기만)

## 작업

변경 파일은 `front/src/screens/RecommendationScreen.tsx` 하나다. 기존 `getHomeCollection('RECOMMENDATION_DAILY')` 호출, 로딩·오류·빈 목록 상태, `initialId` 우선 순서는 유지한다. 포스터 이미지와 작품 정보를 한 작품씩 세로로 넘기는 전체 높이 카드에 표시한다. 각 카드에 중앙 재생 표시, 우측 저장·회차·공유 표시, 하단 제목·장르·무료 회차 정보와 본편 보기 버튼을 배치한다.

미리보기 영상 API 요청은 추가하지 않는다. 포스터를 미디어 배경으로 쓰고 재생 표시는 정적인 UI로 제공한다. 본편 보기와 회차 버튼은 작품 상세의 회차 탭으로 이동한다. 저장은 화면을 벗어나면 사라지는 선택 표시만 토글한다. 공유는 플랫폼 공유 시트를 사용하며 서버 요청을 추가하지 않는다. 영상이 재생되는 것처럼 시간이나 진행률을 가짜로 증가시키지 않는다. 새 의존성을 추가하지 않는다.

읽기 전용 시안과 대조할 요소는 상단의 `추천`·미리보기 표시, 화면 전체의 세로형 포스터, 중앙 재생 표시, 우측 저장·회차·공유 세로 배열, 하단의 작품 제목·설명·장르·무료 회차·본편 보기, 한 작품씩 넘어가는 세로 페이징이다. 실제 영상 URL이 없는 상태는 안내 문구로 표시하며 소리·탐색 조작은 활성화하지 않는다. 시안 파일은 수정하거나 검증하지 않는다.

검증 명령: `npm --prefix front run typecheck`.

완료 조건: 추천 API 결과가 카드 순서에 반영되고, 화면을 세로로 넘기면 다음 작품이 한 장씩 보인다. 로딩·오류·빈 목록 상태가 유지된다. 저장 표시가 토글되고, 회차·본편 버튼이 해당 작품 상세의 회차 탭으로 연결되며, 공유 동작이 서버 요청 없이 열려야 한다.

### 주요 로직 코드 또는 변경 예시

```tsx
const [savedIds, setSavedIds] = useState<string[]>([]);
const [cardHeight, setCardHeight] = useState(0);
const openEpisodes = (drama: HomeCollectionDrama) => router.push({
  pathname: '/drama/[id]',
  params: { id: drama.uuid, tab: 'episodes' },
});
const toggleSave = (id: string) => setSavedIds((ids) =>
  ids.includes(id) ? ids.filter((savedId) => savedId !== id) : [...ids, id]);
const shareDrama = (drama: HomeCollectionDrama) =>
  Share.share({ message: drama.title });

<FlatList
  data={dramas}
  keyExtractor={(drama) => drama.uuid}
  pagingEnabled
  onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
  renderItem={({ item }) => (
    <View style={{ height: cardHeight }}>
      <Image source={{ uri: imageFor(item) ?? undefined }} style={StyleSheet.absoluteFill} />
      <View style={styles.sideActions}>
        <Pressable onPress={() => toggleSave(item.uuid)} accessibilityLabel="작품 저장">
          <Icon name="bookmark" />
        </Pressable>
        <Pressable onPress={() => openEpisodes(item)} accessibilityLabel="전체 회차">
          <Icon name="layers" />
        </Pressable>
        <Pressable onPress={() => void shareDrama(item)} accessibilityLabel="작품 공유">
          <Icon name="share-2" />
        </Pressable>
      </View>
      <Button label="1화부터 본편 보기" onPress={() => openEpisodes(item)} />
    </View>
  )}
/>
```

실제 화면에는 이미지가 없는 경우의 배경, 중앙 재생 표시, 제목·장르·무료 회차 정보와 접근성 레이블을 함께 둔다.
