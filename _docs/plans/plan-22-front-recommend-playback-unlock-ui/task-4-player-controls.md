# task-4-player-controls

## 읽어야 할 파일

- `AGENTS.md`, `_docs/ARCHITECTURE.md`, `front/AGENTS.md` 및 Expo 57 공식 문서
- `front/src/screens/ImmersiveEpisodePlaybackScreen.tsx` (변경 대상)
- `front/src/screens/EpisodePlaybackScreen.tsx` (기존 재생 방식 확인만)
- `front/src/features/playback/episodePlayback.ts`
- `front/src/features/drama/dramaContent.ts`
- `front/src/components/EpisodeUnlockDialog.tsx`
- `_docs/api/02-content/dramas.md`, `_docs/api/04-playback/episodes.md`
- `web-prototype/components/drama-app.tsx`, `web-prototype/app/globals.css` (UI 대조용, 읽기만)

## 프로토타입 확인 결과

- 재생 화면 상단에는 닫기, `N화`, 배속, `…` 설정 버튼이 있다.
- 하단에는 제작사, 큰 작품 제목과 오른쪽 화살표로 된 제목 버튼, 장르·`N화 / 총 M화`, `이전 화`·`다음 화` 버튼, 진행 막대가 있다. 제목 버튼은 작품 상세를 열고, 이전/다음 버튼은 범위 안의 회차를 선택한다.
- `…` 버튼은 자막 표시, 다음 회차 자동 재생, 화질 행이 있는 설정 팝업을 연다. **신고 항목은 프로토타입에 없으며 이번 요청으로 추가한다.**
- 프로토타입의 자막·자동 재생은 브라우저 안의 예시 상태와 60초짜리 체험 타이머를 사용한다. 이를 실제 영상 재생 로직에 그대로 복사하지 않는다.

## 작업

변경 파일은 `front/src/screens/ImmersiveEpisodePlaybackScreen.tsx` 하나다. 기존 `getEpisodePlayback` 호출, `expo-video` 재생·탐색·오류 처리, 배속 메뉴를 유지한다. `front/src/screens/EpisodePlaybackScreen.tsx`, API 함수와 백엔드, `web-prototype/`은 수정하지 않는다.

1. 작품 ID(`dramaId`)가 전달된 경우에만 기존 `getDramaContent(dramaId)`로 공개 회차 목록·제작사·장르·작품명을 가져온다. `PlaybackVideo`에도 현재 회차 `id`를 전달하고, 목록을 `episodeNumber` 순으로 정렬해 현재 UUID의 앞뒤 회차를 찾는다. 조회가 실패해도 영상 재생은 유지하며 목록 기반 UI는 비활성 상태로 표시한다. 새 endpoint는 만들지 않는다.
2. 하단에 프로토타입 위치와 크기를 참고한 `이전 화`·`다음 화` 버튼을 둔다. 해당 회차가 없거나 작품 ID가 없어 확인할 수 없으면 버튼을 비활성화한다. 무료 회차(`pricePoints === 0`)는 기존 `/episode/[id]` 라우트로 이동하며 `dramaId`·`dramaTitle`을 계속 전달한다. 유료 회차는 영상을 일시정지하고 재생 URL로 바로 이동하지 않은 채 기존 `EpisodeUnlockDialog`를 열어 가격과 포인트 화면 연결을 보여준다. 해제·결제 성공을 가정하지 않는다.
3. 하단 제목은 `제작사`(있을 때), 큰 `작품명 >` 버튼, `장르 · N화 / 총 M화` 순으로 구성한다. 제목 버튼은 작품 ID가 있으면 해당 `/drama/[id]`로 이동한다. 직접 열린 회차 링크처럼 작품 ID가 없으면 제목을 일반 텍스트로 표시하고 회차명 또는 `N화`를 사용한다. 값이 없는 제작사·장르·총 회차는 임의로 만들지 않는다.
4. 상단 배속 버튼 옆에 `…` 더보기 버튼을 둔다. 누르면 `자막 표시`, `다음 화 자동 재생`, `신고`가 보이는 닫기 가능한 메뉴를 연다. 자막 트랙과 실제 자동 재생 동작은 현재 재생 응답에 없으므로 두 설정은 `준비 중`으로 명확히 표시하고 비활성화한다. 신고도 처리 API가 없어 `신고 준비 중`으로 표시하고 비활성화한다. 프로토타입의 화질 행은 이번 요청 항목이 아니므로 추가하지 않는다. 접근성 이름과 비활성 상태를 제공한다.
5. 더보기 메뉴가 열린 동안 재생 컨트롤의 자동 숨김 타이머가 메뉴를 가리지 않도록 하고, 메뉴 닫기·화면 이탈 시 상태를 정리한다.

## 완료 조건

- 영상 재생과 탐색이 기존대로 동작한다.
- 작품 상세에서 시작한 재생 화면에 제목 버튼과 앞뒤 회차 버튼이 보이고, 무료 앞뒤 회차는 올바른 UUID로 열리며 유료 회차는 회차 열기 팝업으로 이어진다.
- 첫 회차의 이전 버튼, 마지막 회차의 다음 버튼, 작품 ID가 없는 직접 링크의 인접 회차 버튼은 비활성화된다.
- 상단 `…`을 누르면 요청한 세 항목이 보이고 닫을 수 있다. 아직 지원되지 않는 동작을 실제 기능처럼 표시하지 않는다.
- 기존 재생 화면 파일과 웹 프로토타입은 변경되지 않는다.

검증 명령: `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`.

### 주요 로직 예시

```tsx
const [drama, setDrama] = useState<DramaContent | null>(null);
// PlaybackVideo는 부모에게 현재 회차 id를 함께 받는다.
useEffect(() => {
  if (!dramaId) return;
  let active = true;
  getDramaContent(dramaId).then((result) => {
    if (active) setDrama(result);
  }).catch(() => {
    if (active) setDrama(null);
  });
  return () => { active = false; };
}, [dramaId]);

const episodes = [...(drama?.episodes ?? [])].sort((a, b) => a.episodeNumber - b.episodeNumber);
const currentIndex = episodes.findIndex((episode) => episode.uuid === id);
const previous = currentIndex > 0 ? episodes[currentIndex - 1] : null;
const next = currentIndex >= 0 ? episodes[currentIndex + 1] ?? null : null;

function selectEpisode(episode: DramaContent['episodes'][number] | null) {
  if (!episode || !dramaId) return;
  if (episode.pricePoints > 0) {
    player.pause();
    setLockedEpisode(episode);
    return;
  }
  player.pause();
  router.replace({ pathname: '/episode/[id]', params: {
    id: episode.uuid, dramaId, dramaTitle: drama?.title ?? dramaTitle,
  } });
}
```

메뉴 항목은 `accessibilityRole="switch"` 또는 `button`과 `accessibilityState={{ disabled: true }}`로 현재 지원 상태를 표현한다. `EpisodeUnlockDialog`는 기존 컴포넌트를 재사용한다.
