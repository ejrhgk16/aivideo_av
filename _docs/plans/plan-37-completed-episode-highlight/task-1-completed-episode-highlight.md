# task-1-completed-episode-highlight

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md`
- `front/src/screens/DramaDetailScreen.tsx`
- `front/tests/unit/dramaDetailScreen.test.ts`
- `front/src/features/drama/dramaContent.ts` (기존 응답 타입 확인용)
- https://docs.expo.dev/versions/v57.0.0/ (front 지침에 따라 코드 작성 전 확인)

## 작업
드라마 상세 회차 배경색의 기준을 시청기록 존재 여부에서 시청 완료 여부로 변경한다.

수정 가능한 파일:
- `front/src/screens/DramaDetailScreen.tsx`
- `front/tests/unit/dramaDetailScreen.test.ts`

### 주요 로직 코드 또는 변경 예시
화면의 기존 조건 `episode.watchProgress !== null && styles.watchedEpisode`를 `episode.watchProgress?.isCompleted === true && styles.watchedEpisode`로 교체한다. 기존 API의 boolean을 직접 사용하므로 새 상태·이벤트·요청 흐름이나 별도 함수는 필요하지 않다.

기존 `drama detail distinguishes free, purchased and locked episodes` 테스트에는 이미 세 가지 시청 상태 fixture가 있다. `free` 회차는 `isCompleted: false`이므로 `hasBackground(free, '#CBF46A18')` 기대값을 true에서 false로 변경한다. 완료된 `locked` 회차의 true 기대값과 기록이 null인 `owned`, `locked2`, `free2` 회차의 false 기대값을 유지해 세 상태를 검증한다. 기존 구매·재생 분기 검증은 유지한다. 수정 전 테스트에서 미완료 회차에 대한 새 기대값이 실패하고, 화면 조건 수정 후 통과하는지 확인한다.

색상 값, API·DB·2/3 완료 기준, 타입 및 파일 책임은 변경하지 않는다. 모든 수정은 `apply_patch`로 수행한다.

검증 명령:
- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

완료 조건:
- 시청기록 null과 `isCompleted: false`는 기본 배경색을 유지한다.
- `isCompleted: true`에만 기존 시청 배경색 `#CBF46A18`을 적용한다.
- 위 검증 명령이 모두 통과하고 변경이 선언된 두 파일에 한정된다.
