# task-2-home-library-remove-provider

## 읽어야 할 파일

- `AGENTS.md`, `front/AGENTS.md`, `_docs/ARCHITECTURE.md`
- `_docs/plans/plan-47-screen-local-saved-videos/plan.md`, `index.json`, `task-1-screen-saved-actions.md`
- `front/src/screens/HomeScreen.tsx`, `LibraryScreen.tsx`, `front/src/app/_layout.tsx`
- `front/src/features/playback/SavedVideosProvider.tsx`, `savedVideoState.ts`, `savedVideos.ts`
- `front/src/features/user/UserProvider.tsx`, `front/src/components/ui.tsx`
- task-1의 변경된 재생 소스·테스트와 아래 수정 허용 테스트
- 읽기/실행 전용 `front/tests/unit/session.test.ts`, `login.test.ts`, `episodeUnlockDialog.test.ts`
- Expo SDK 57 문서: https://docs.expo.dev/versions/v57.0.0/ . 기존 Router·safe area 동작을 유지한다.

## 작업

task-1 완료 후 남은 홈·보관함 소비처와 루트 wrapper를 전환하고 Provider/store를 삭제한다. 수정 허용 파일은 아래 10개뿐이다. 삭제 대상도 `files`에 포함한다.

```text
front/src/screens/HomeScreen.tsx
front/src/screens/LibraryScreen.tsx
front/src/app/_layout.tsx
front/src/features/playback/SavedVideosProvider.tsx
front/src/features/playback/savedVideoState.ts
front/tests/unit/savedVideoState.test.ts
front/tests/unit/savedVideoScreens.test.ts
front/tests/unit/libraryScreen.test.ts
front/tests/unit/sessionExpiredDialog.test.ts
_docs/ARCHITECTURE.md
```

### 구현 조건

1. 홈의 저장 아이콘 버튼·저장 오류·토글 함수·Provider import·saved flag accept/revision·저장 표시 전용 owner 상태를 제거한다. 그 결과 쓰지 않는 import·스타일·변수만 정리한다. 세션 복원과 늦은 컬렉션 응답 차단은 유지한다.
2. '재생 준비 중' 기본 버튼은 `label="분위기 미리보기"`로 바꾸고 `/preview/[dramaId]/[videoId]`로 연결한다. dramaId는 현재 hero.uuid, videoId는 현재 hero.previewVideos[0].uuid이다. 없는 프리뷰·복원 중 비활성화, 익명 사용자는 로그인 이동 없이 바로 미리보기, hero 전환 시 현재 작품 UUID로 이동을 검증한다. '작품 소개' 링크와 다른 홈 섹션은 유지한다.
3. 보관함에서 Provider import·`accept`·revision 의존성을 제거한다. 기존 `items`, page, generation, inFlight, session/owner 검사는 유지한다. 저장한 작품 탭의 focus 진입마다 1페이지부터 재조회한다. 저장 플래그 변경을 통지하는 전역 이벤트나 새 store를 추가하지 않는다. 실패는 오류로, 정상 빈 목록은 빈 목록으로 구분한다.
4. 보관함의 페이지 중복 요청 방지·UUID 중복 제거·같은 페이지 재시도·탭 분리·로그아웃/계정 전환 차단은 유지한다. 화면 복귀 전의 페이지 응답은 generation 검사로 무시한다.
5. 모든 소비처 전환 후 `_layout.tsx`에서 `SavedVideosProvider` import/wrapper를 제거하고 `SavedVideosProvider.tsx`, `savedVideoState.ts`, `savedVideoState.test.ts`를 삭제한다. task-1에서 이동한 사용자 동작 테스트를 유지하고 삭제된 내부 store 구현 전용 테스트만 없앤다.
6. 루트의 `UserProvider`, `SafeAreaProvider`, 폰트 로딩, Stack, 세션 만료 모달은 유지한다. `UserProvider.tsx`의 `subtitlesEnabled`, `autoplayNext`와 setter는 외부 사용처가 없어도 명시적으로 유지한다. `useLogin` 등 다른 훅 정리는 하지 않는다.
7. `_docs/ARCHITECTURE.md`의 저장 Provider/store 설명을 화면 내부 저장 상태·API 쓰기·포커스 서버 재조회 설명으로 바꾼다. 사용자/포인트/세션과 향후 사용할 두 재생 설정을 UserProvider에서 유지한다는 기존 책임을 보존한다. SafeAreaProvider가 루트에서 안전 영역 값을 제공하며 Page/재생 컨트롤에서 적용한다는 점과 이번 점검 결과를 짧게 반영한다. 기존 plan-46 문서 변경을 덮어쓰거나 백엔드 설명을 정리하지 않는다.

### 주요 로직 코드 또는 변경 예시

홈의 기존 heroActions 영역은 아래 흐름으로 바꾼다. 새 함수·훅·route 파일은 필요하지 않다.

```tsx
<View style={styles.heroActions}>
  <Button
    style={styles.heroButton}
    label="분위기 미리보기"
    disabled={!heroPreview || isRestoring}
    icon={<Icon name="play" size={17} color={colors.background} />}
    onPress={() => {
      if (!heroPreview || isRestoring) return;
      router.push({
        pathname: '/preview/[dramaId]/[videoId]',
        params: { dramaId: hero.uuid, videoId: heroPreview.uuid },
      });
    }}
  />
</View>
```

보관함의 기존 loadPage에서 전역 store 승인 단계를 제거하고 서버 page 응답을 기존 화면 목록에 직접 반영한다. loadPage의 기존 로딩·오류·finally 경로와 focus effect의 generation 초기화/cleanup을 유지한다.

```tsx
const result = await getSavedVideos(page);
if (generation.current !== requestGeneration ||
    !isCurrentSession(version) || user?.uuid !== userUuid) return;
setItems((current) => {
  const previous = replace ? [] : current;
  const seen = new Set(previous.map((item) => item.videoUuid));
  return [...previous, ...result.items.filter((item) => !seen.has(item.videoUuid))];
});
setHasNext(result.hasNext);
nextPage.current = page + 1;
setStatus('loaded');
setItemsOwner({ uuid: userUuid, version });
setError(null);
setNextError(null);
```

focus effect 의존성은 기존 `tab`, `isRestoring`, `owner`, `sessionVersion`, `loadPage`로 한정한다. `savedVideos.snapshot.revision`만 제거한다. 기존 focus 경로에서 `loadPage(1, true, requestGeneration, sessionVersion, owner)`를 호출하므로 새 구독·알림 시스템이 필요 없다.

루트 wrapper 변경은 `UserProvider > SavedVideosProvider > 로딩/내비게이션`에서 `UserProvider > 로딩/내비게이션`으로 한 단계 제거하는 것이다. 루트에서 다른 새 로직은 추가하지 않는다.

### 테스트와 완료 조건

- `savedVideoScreens.test.ts`의 홈 저장 테스트와 home harness를 홈 미리보기 이동 검증으로 바꾼다. 프리뷰 있음/없음, 익명 사용자, 복원 중, hero 전환 시 정확한 경로 인자를 검사하고 홈에서 저장 쓰기가 발생하지 않음을 확인한다. task-1의 미리보기 저장 테스트는 보존한다.
- `libraryScreen.test.ts`에서 사용하지 않는 Provider mock을 제거한다. focus를 떠났다가 복귀하는 실제 호출 흐름을 지원하고, 그 사이 서버에서 저장 목록에 항목이 추가/삭제된 응답으로 새 목록이 표시되는지 검사한다. 더 보기 응답이 새 focus 조회보다 늦는 경우, 계정 전환, 오류/빈 목록, 페이지 중복 제거·재시도도 유지한다.
- `sessionExpiredDialog.test.ts`에서 삭제된 Provider mock을 제거하고 단일 루트 모달·닫기·명시적 로그인 이동 검증을 유지한다.
- `front/src`와 `front/tests` 전체에서 삭제 모듈 이름과 `useSavedVideos`, 이전 `useSavedVideo`, `createSavedVideoState` 참조가 없어야 한다. 예: `rg -n 'SavedVideosProvider|savedVideoState|useSavedVideos|useSavedVideo|createSavedVideoState' front/src front/tests`의 종료 코드 1은 예상된 빈 결과다. 새 custom hook도 만들지 않는다. 과거 계획의 역사적 언급은 수정하지 않는다.
- Provider 전수 점검은 `rg -n 'createContext|Provider|useSyncExternalStore' front/src`와 실제 소비처로 확인한다. UserProvider와 SafeAreaProvider의 현재 필요한 사용처, 사용자 명시로 유지하는 두 설정을 최종 요약에 구분해 기록한다.
- 아키텍처 문구와 소스의 책임이 일치하며 UserProvider 두 설정과 SafeAreaProvider가 그대로여야 한다.
- 검증 명령:

```text
npm --prefix front run typecheck
npm --prefix front run test -- tests/unit/savedVideoScreens.test.ts tests/unit/libraryScreen.test.ts tests/unit/sessionExpiredDialog.test.ts tests/unit/session.test.ts tests/unit/login.test.ts tests/unit/episodeUnlockDialog.test.ts
```

문서 일치와 참조 검색은 위 checks와 별도로 worker가 확인하고 결과를 보고한다. 읽기/실행 전용 session/login/episodeUnlockDialog 테스트를 수정 허용 파일에 추가하지 않는다. 이 task는 task-1의 공유 테스트를 이어서 수정하므로 반드시 순차 실행한다. 실제 서버나 DB fixture를 쓰지 않으며 제품 전체 export/test는 `$finish-plan`에서 수행한다.

