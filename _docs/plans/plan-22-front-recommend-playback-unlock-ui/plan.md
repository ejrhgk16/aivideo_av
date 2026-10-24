# 프론트 추천·재생·회차 열기 UI 이식

## 목표

현재 프론트의 추천 화면을 한 작품씩 세로로 넘기는 화면으로 바꾸고, 별도의 회차 재생 화면에 재생·저장·회차·공유 조작을 배치한다. 유료 회차 선택 시 회차 열기 및 포인트 정보 미연결 상태를 알리는 팝업을 표시한다. 기존 재생 화면 파일은 보존하고 새 재생 화면을 회차 라우트에 연결한다.

## 범위와 비목표

- `front/` 화면 UI와 화면 안의 임시 상태만 변경한다. 추천 컬렉션, 작품 상세, 회차 재생을 가져오는 기존 API 함수와 호출은 유지한다.
- 추천 미리보기는 현재 컬렉션의 포스터를 표시한다. 미리보기 영상 요청, 저장 동기화, 실제 잔액 조회·차감, 광고 보상, 충전 완료, 백엔드·API 계약 변경은 이번 범위가 아니다.
- 저장 표시는 화면 내부 임시 상태로만 바꾼다. 공유는 플랫폼 공유 기능을 사용하되 서버 저장을 추가하지 않는다.
- 유료 회차 팝업의 회차 가격은 상세 응답의 `pricePoints`를 사용한다. 잔액은 `— P`로 표시하고 포인트 화면으로 연결한다. 기존 포인트 화면의 준비 중 상태와 실제 회차 해제 여부는 변경하지 않는다.
- 회차 목록 버튼은 기존 작품 상세 화면의 `전체 회차` 탭으로 연결한다. 추천 화면의 본편 보기 버튼도 작품 상세의 회차 탭으로 연결한다.
- `front/src/screens/EpisodePlaybackScreen.tsx`는 변경하지 않는다. 새 재생 화면이 기존 `getEpisodePlayback`을 사용하며 로딩·오류·재생·탐색 동작을 유지한다.
- 추가 `task-4`는 작품 ID가 있을 때 기존 `getDramaContent` 함수로 공개 회차 목록과 제목 메타데이터를 조회한다. 재생 API와 백엔드 계약은 변경하지 않는다. 자막 트랙·신고 처리 API는 없으므로 해당 메뉴 항목을 준비 중으로 표시한다.
- 기존 시안의 컴포넌트와 CSS는 UI 대조를 위한 읽기 전용 참고 자료다. 해당 파일은 task의 변경 파일이나 검증 대상에 넣지 않는다.

## 영향 범위

`front/src/screens/` 화면, `front/src/components/`의 회차 열기 팝업, `front/src/app/`의 회차 라우트만 수정한다. 디렉터리 책임이나 API 경로는 바꾸지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 추천 세로 피드 UI | `front/src/screens/RecommendationScreen.tsx` | 기존 추천 컬렉션을 세로 페이지 피드로 표시하고 재생 표시·저장·회차·공유·본편 보기 UI 배치 |
| 2 | 회차 열기 팝업 UI | `front/src/screens/DramaDetailScreen.tsx`, `front/src/components/EpisodeUnlockDialog.tsx` | 유료 회차 선택 시 가격과 잔액 미연결 상태를 보여주고 포인트 화면 연결 |
| 3 | 새 회차 재생 화면 UI와 연결 | `front/src/screens/ImmersiveEpisodePlaybackScreen.tsx`, `front/src/app/episode/[id].tsx` | 기존 재생 화면을 보존한 채 새 화면에 실제 영상과 조작 UI를 배치하고 라우트 전환 |
| 4 | 재생 화면 회차 이동·제목·더보기 UI | `front/src/screens/ImmersiveEpisodePlaybackScreen.tsx` | 이전/다음 화 버튼, 작품 제목 버튼, 더보기 메뉴의 자막·자동 재생·신고 항목 추가 |

## 실행 순서 및 병렬 작업

- `task-1`과 `task-2`는 파일이 겹치지 않아 병렬 실행 가능하다.
- `task-3`은 `task-1`과 `task-2` 완료 후 실행한다. 상세 화면에서 전달하는 작품 식별자를 재생 화면이 사용하고, 마지막에 프론트 전체 검증을 수행한다.
- `task-4`는 완료된 `task-3` 위에 추가한다. 기존 재생 화면 파일과 프로토타입은 읽기 전용이다.

## 검증

- `task-1`, `task-2`: `npm --prefix front run typecheck`
- `task-3`: `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`
- `task-4`: `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`
- 완료 기준: 추천 컬렉션 API를 유지한 세로 피드가 보이고, 유료 회차에서 가격 기반 팝업이 뜨며, 무료 회차는 새 재생 화면에서 기존 API 영상과 재생 컨트롤을 사용한다. 기존 재생 화면 파일은 보존된다.
