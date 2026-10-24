# task-2-episode-unlock-dialog

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md` 및 해당 파일이 요구하는 Expo 57 공식 문서
- `front/src/screens/DramaDetailScreen.tsx`
- `front/src/features/drama/dramaContent.ts`
- `front/src/screens/PointsScreen.tsx`
- `front/src/components/ui.tsx`
- `web-prototype/components/drama-app.tsx` (회차 열기 팝업 UI 대조용, 읽기만)
- `web-prototype/app/globals.css` (팝업 스타일 대조용, 읽기만)

## 작업

변경 파일은 `front/src/screens/DramaDetailScreen.tsx`와 새 `front/src/components/EpisodeUnlockDialog.tsx`다. 상세 API 요청과 소개·회차 탭은 유지한다. 무료 회차 선택은 기존 회차 라우트로 보내되 `dramaId`와 `dramaTitle`도 전달한다. `pricePoints > 0`인 회차를 선택하면 회차 열기 팝업을 열고 회차 번호·가격·잔액 `— P`를 표시한다. 가격은 고정값으로 쓰지 않는다.

잔액 조회·회차 해제 API가 없으므로 실제 결제·차감·재생을 수행하는 버튼은 제공하지 않는다. 팝업의 충전 버튼은 기존 `/points` 화면으로 이동한다. 광고·충전 완료·팝업 복귀 상태는 추가하지 않는다. 팝업 닫기 및 기기 뒤로 가기를 지원하고, 선택한 회차가 바뀌면 표시 내용도 바뀌게 한다.

읽기 전용 시안의 잠금 아이콘, 제목 `다음 이야기가 기다려요`, 작품명·회차, `이번 회차`·`내 포인트` 요약, 하단 안내와 충전 버튼의 배치·색·간격을 대조한다. 실제 잔액을 알 수 없으므로 부족액이나 차감 후 잔액을 숫자로 계산하지 않는다. 시안 파일은 수정하거나 검증하지 않는다.

검증 명령: `npm --prefix front run typecheck`.

완료 조건: 무료 회차는 기존처럼 회차 라우트로 이동하고, 유료 회차는 재생 API 요청 대신 가격이 정확한 팝업을 연다. 팝업에 알 수 없는 잔액을 임의의 숫자로 표시하지 않으며 충전 버튼은 기존 포인트 화면으로 이동한다.

### 주요 로직 코드 또는 변경 예시

```tsx
type Episode = DramaContent['episodes'][number];
const [lockedEpisode, setLockedEpisode] = useState<Episode | null>(null);

function openEpisode(episode: Episode) {
  if (episode.pricePoints > 0) {
    setLockedEpisode(episode);
    return;
  }
  router.push({
    pathname: '/episode/[id]',
    params: { id: episode.uuid, dramaId: drama.uuid, dramaTitle: drama.title },
  });
}

<EpisodeUnlockDialog
  episode={lockedEpisode}
  dramaTitle={drama.title}
  onClose={() => setLockedEpisode(null)}
  onCharge={() => {
    setLockedEpisode(null);
    router.push('/points');
  }}
/>
```

새 팝업 컴포넌트는 다음 데이터와 행동만 받는다.

```tsx
<Modal transparent visible={episode !== null} onRequestClose={onClose} animationType="fade">
  <View style={styles.backdrop}>
    <View style={styles.dialog}>
      <AppText weight="bold">다음 이야기가 기다려요</AppText>
      <AppText>{dramaTitle} · {episode?.episodeNumber}화</AppText>
      <AppText>이번 회차 {episode?.pricePoints} P</AppText>
      <AppText>내 포인트 — P</AppText>
      <AppText>포인트 정보를 확인할 수 없어요.</AppText>
      <Button label="포인트 충전하기" onPress={onCharge} />
      <Button label="닫기" variant="secondary" onPress={onClose} />
    </View>
  </View>
</Modal>
```
