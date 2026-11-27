# 백엔드 작업 목록 (PEEKA 화면 적용 이후)

> 2026-11-27 · 기준 커밋 origin/dev `3648896` (PR #11 병합 시점) · 대상 `back/`, 관리자 지표

## 1. 목적과 현재 상태

PEEKA 디자인이 앱(`front/`, PR #4~#11), 관리자(`admin/`), 시안(`web-prototype/`)까지 dev에 들어갔습니다. 화면은 API와 재생 로직을 그대로 둔 채 모양과 문구만 바꿨습니다. 그래서 백엔드에 데이터나 API가 없는 기능은 화면에 자리만 비워 두었습니다.

이 문서는 그 빈자리를 한곳에 모은 것입니다. 표의 내용은 기준 커밋의 코드로 다시 확인했습니다. 코드로 확인하지 못한 항목에는 (확인 필요)를 붙였습니다.

- 프론트 코드에서 `TODO(backend)`로 검색하면 빈자리 6곳이 나옵니다.
- 화면에 붙일 때는 API가 생긴 뒤 작은 프론트 PR로 따로 올리는 것을 전제로 합니다.
- REST endpoint를 바꾸면 같은 작업에서 [API 문서](../api/README.md)도 고쳐야 합니다(AGENTS.md 규칙).

## 2. 기능별 작업

경로는 저장소 루트 기준입니다. 우선순위는 운영 출시에 막히는 것을 높음, 화면 기능이 빠져 있는 것을 중간, 표시를 다듬는 것을 낮음으로 잡았습니다.

| 기능 | 필요한 API·필드·테이블 | 쓰는 화면과 지금 비워 둔 자리 | 관련 PR | 우선순위 |
| --- | --- | --- | --- | --- |
| 운영 재생 경로 | `GET /episodes/:episodeId/playback`, `GET /dramas/:dramaId/previews/:videoId/playback`이 `NODE_ENV !== 'development'`면 404를 줍니다(`back/src/content/publicCatalogService.ts`의 `getEpisodePlaybackUrl`·`getDramaPreviewPlaybackUrl`). 서명 URL도 개발 환경에서만 만듭니다(`back/src/content/s3VideoUrlService.ts`). 운영에서 쓸 재생 방식(서명 URL 유지, CDN 등)을 정해야 합니다 | 영상이 나오는 모든 화면: `front/src/screens/playbackScreen_episode.tsx`, `playbackScreen_preview.tsx`, `RecommendationScreen.tsx`, `HomeScreen.tsx` 대표 영역 | #4 계획 전체 | 높음. 운영에서 영상이 하나도 나오지 않고, 지표 수집(3절)도 이 경로가 있어야 시작할 수 있습니다 |
| 회차 구매 개발 환경 제한 해제 | `POST /me/episodes/:episodeUuid/purchaseSingle`이 `assertDevelopment()`로 운영에서 404입니다(`back/src/economy/pointController.ts`). `POST /me/points/increase`도 같습니다 | 잠금 창 `front/src/components/EpisodeUnlockDialog.tsx`(작품 소개·홈·재생기·미리보기·빼꼼 5곳에서 사용) | #7 | 높음. 운영에서 유료 회차를 열 수 없습니다 |
| 광고 보상·충전 API, 잔액 조회 | 테이블과 엔티티는 있습니다(`ad_reward_offers`, `ad_reward_claims`, `point_products`, `point_purchase_orders`, `back/src/economy/entities/`). 이를 쓰는 endpoint가 없습니다. 잔액은 로그인·refresh 응답의 `availablePoints`와 구매 응답으로만 받고, 따로 조회하는 API는 없습니다 | `front/src/screens/PointsScreen.tsx`의 광고·충전은 체험 상태(화면을 나가면 초기화). 잠금 창과 끝 카드에서 포인트가 모자라면 "광고 보고 10P 받기" 대신 "포인트 충전하기"를 보여 줍니다(`EpisodeUnlockDialog.tsx`, `playbackScreen_episode.tsx`의 `TODO(backend)`) | #7, #8 | 높음. 운영에서 포인트를 얻을 방법이 없어 구매 해제와 함께 필요합니다 |
| 시청 기록 `isCompleted`·`positionMs`, 중간 위치 저장 | `GET /me/watch-history` 응답(`back/src/playback/watchHistoryResponses.ts`)에 두 값이 없습니다. 작품 상세의 `episodes[].watchProgress`에는 이미 있습니다. 저장은 `PUT /me/videos/:videoUuid/watch-progress`가 `STARTED`(0)와 2/3 지점 `COMPLETED`만 받아서 중간 위치가 남지 않습니다(`watchProgressService.ts`, 앱은 `front/src/features/playback/watchProgress.ts`) | 홈 이어보기 진행 막대와 "다 본 작품 빼기"(`HomeScreen.tsx`), 보관함 시청 기록 줄의 진행 막대(`LibraryScreen.tsx`의 `TODO(backend)`) | #5, #9 | 중간. 이어보기가 끝까지 본 작품도 보여 주고, 진행 막대가 없습니다 |
| 시청 기록 삭제 API | `me/watch-history`에는 `GET`만 있습니다. 한 줄 삭제(되돌리기 가능하게)가 필요합니다 | 보관함 시청 기록 줄의 × 지우기와 되돌리기(`LibraryScreen.tsx`의 `TODO(backend)`) | #9 | 중간 |
| 순위순 정렬·계산된 랭킹 | `GET /dramas`가 `sort=latest`만 받습니다(`publicCatalogController.ts`). 순위 계산 기준이 없습니다 | 홈 랭킹 탭은 편집 TOP 3(`EDITORIAL_TOP_3`)만 보여 줌(`HomeScreen.tsx`). 찾기 결과의 순위순·최신순 정렬(`SearchScreen.tsx`의 `TODO(backend)`). 마지막 화 끝 카드의 "다음으로 볼 작품"(`playbackScreen_episode.tsx`의 `TODO(backend)`) | #5, #8, #10 | 중간. 지표 수집(3절)의 조회수가 생기면 그 값으로 계산할 수 있습니다 |
| `publishedAt` 노출(NEW 배지) | 작품 목록·상세 응답(`back/src/content/contentResponses.ts`)에 `publishedAt`이 없습니다. 서버는 정렬에만 씁니다 | 홈 "새로 올라온 이야기"의 NEW 배지(`HomeScreen.tsx`) | #5 | 낮음 |
| 전체 회차 수("N부작") | 목록의 `episodeCount`는 공개된 회차 수입니다. 공개 예정을 포함한 전체 회차 수 필드가 없습니다 | 홈 대표 영역과 작품 소개의 "N부작"(지금은 "N화") (`HomeScreen.tsx`, `DramaDetailScreen.tsx`) | #5, #6 | 낮음. 함께 정할 것: "N화까지 무료"를 `freeEpisodeCount`로 적는데, 무료 회차가 1화부터 이어진다는 보장이 없습니다 |
| 막(act) 이름·회차 짧은 제목 | 막 개념이 데이터 모델에 없습니다. 회차 `title`은 있지만 시드 값이 "N화"입니다 | 작품 소개 회차 격자를 막별 소제목("1~4화")으로 묶기(`DramaDetailScreen.tsx`), 칸 읽기 이름과 잠금 창 부제의 회차 제목, 끝 카드의 다음 화 줄(지금은 `synopsis`로 대신함) | #6, #8 | 낮음. 막은 데이터 모델 변경이 필요해 `_docs/AI_DRAMA_data_model/`(git 추적 제외)부터 정해야 합니다. 짧은 제목은 데이터만 채우면 됩니다 |
| 장르 `tileImage`·`episodes[].image` URL | 두 값이 URL이 아니라 storage key로 내려옵니다(`publicCatalogService.ts`, [genres.md](../api/02-content/genres.md), [dramas.md](../api/02-content/dramas.md)). 작품 `imageUrls`처럼 URL로 주거나 프론트 변환 규칙을 정해야 합니다 | 앱은 지금 두 값을 쓰지 않습니다. 시안의 장르 배너 그림과 회차 칸 그림에 필요합니다(`HomeScreen.tsx` 장르 탭, `DramaDetailScreen.tsx`) | 계획 §4 | 낮음 |
| 작품 단위 저장 | 저장은 영상 단위입니다(`PUT/DELETE /me/saved-videos/:videoUuid`). 작품 단위로 바꿀지 결정이 먼저입니다 | 홈 대표 작품의 저장은 첫 미리보기 영상을 저장합니다(`HomeScreen.tsx`). 보관함에 같은 작품이 미리보기·회차로 두 줄 나올 수 있습니다(`LibraryScreen.tsx`) | #5, #9 | 낮음. 결정이 필요합니다 |
| 3초 엿보기(잠긴 회차 미리보기) | 잠긴 회차 재생은 401/403입니다. 잠긴 회차의 앞 3초만 볼 수 있는 재생 규칙이나 별도 URL이 필요합니다 | 작품 소개 칸 길게 누르기(`DramaDetailScreen.tsx`), 잠금 창 보조 버튼(`EpisodeUnlockDialog.tsx`), 끝 카드 보조 버튼(`playbackScreen_episode.tsx`의 `TODO(backend)`) | #6, #7, #8 | 낮음. 재생 권한 규칙이 새로 생기므로 운영 재생 경로와 함께 정하는 것이 좋습니다 |
| 목록 전체 개수 | 페이지 응답이 `items`·`page`·`hasNext`만 줍니다(`back/src/common/pagination/paginationResponses.ts`) | 찾기 결과 머리말 "· N편"이 지금까지 받은 수를 보여 주고, 다음 쪽이 있으면 "이상"을 붙입니다(`SearchScreen.tsx`) | #10 | 낮음 |

## 3. 지표 수집(관리자 실제 숫자)

관리자 대시보드의 숫자는 지금 예시 값입니다. 세 화면이 모두 `admin/src/lib/sampleMetrics.ts`의 `statsForCampaign()`을 부릅니다. 계산식은 `admin/src/lib/metrics.ts`에 이미 있어서, 같은 모양의 데이터를 DB에서 채우면 화면은 고치지 않아도 됩니다. 앱·백엔드에는 노출이나 재생 이벤트를 모으는 코드가 아직 없습니다.

계약 초안: [Analytics API](../api/06-analytics/README.md), [이벤트 수집](../api/06-analytics/events.md), [데이터 모델 제안](../api/06-analytics/data-model-proposal.md) (상태: 제안, 미구현)

### 결정된 정의 (요약)

- **노출**: 빼꼼에서 작품의 쇼츠(1화 미리보기) 카드가 화면에 뜬 횟수. 작품 단위이고, 홈·찾기 포스터는 넣지 않습니다.
- **조회**: 본편 회차 재생이 시작된 횟수(유튜브 기준, 최소 시청 시간 없음). 빼꼼 쇼츠 재생은 넣지 않습니다.
- **조회율**: 빼꼼 노출 뒤 같은 기기에서 24시간 안에 그 작품 본편을 재생한 비율.
- **회차(캠페인) 화면**: 노출수·조회율을 뺍니다.
- **수집 대상**: 비로그인 사용자도 수집합니다(기기 설치 ID).
- **보관**: 개인 식별자가 든 원본은 90일 뒤 삭제하고, 식별자 없는 일별 집계는 계속 보관합니다.
- **추천안(확정 전)**: 노출 30분 중복 제거, 완주 90%, 참여 조회 3초, 30초 안에 다시 연 회차는 같은 조회. 앱의 기존 시청 완료(2/3)는 이어보기용으로 그대로 둡니다.

### 구현 순서

| 단계 | 생기는 지표 | 대략 일수 |
| --- | --- | --- |
| 선행 | 운영 재생 경로(2절 첫 줄). 없으면 운영에서 재생 이벤트가 생기지 않습니다 | 확인 필요 |
| 1. 재생 지표 | 조회수, 일별 조회수, 평균 시청 비율, 완주율·이탈률, 구간 이탈 곡선·도달률 | 8~11일 |
| 2. 빼꼼 노출 | 노출수, 조회율 | 3~5일 |
| 3. 운영화 | 일별 집계 배치, 오프라인 재전송, 남용 방지, 90일 삭제 | 5~8일 |

숫자는 수집을 시작한 날부터 쌓입니다. 과거 데이터는 되살릴 수 없고, 90일 증감은 수집 후 180일이 지나야 의미가 생깁니다.

### 남은 질문

1. 재생 세션 ID를 `GET /episodes/:episodeId/playback`에서 발급할지(GET이 행을 만듦), 운영 재생 경로도 이 API를 거칠지.
2. 회차 길이 기준: `episodes.duration_ms`와 `content_videos.duration_ms` 중 하나로 통일할지.
3. 작품 소개 등에 30초 넘게 있다가 돌아와 재생하면 새 조회로 볼지, 그때 재생 API를 다시 부를지.
4. 요청 한도 값(IP 300회/분, 세션 발급 60개/분, installId당 30회/분 제안)과 카운터 위치. 한도를 넘으면 `playbackSessionId: null`(재생은 계속)로 줄지, 429로 막을지.
5. 일별 집계·90일 삭제 실행 방식(외부 cron + CLI, 또는 `@nestjs/schedule` + DB 잠금).
6. 개인정보: 처리방침 외에 동의가 필요한지(법무 확인), 탈퇴 시 원본 삭제 범위와 탈퇴 처리 흐름.
7. 앱 저장 위치: 설치 ID와 오프라인 큐(새 의존성 필요). 정해지면 [전역 상태](../../front/README.md#전역-상태)에 기록합니다.
8. 이벤트 type 표기: 소문자 snake_case(`feed_impression`)로 둘지, 기존 열거값처럼 대문자로 맞출지.
9. 끝 카드가 뜨는 것을 100% 도달로 볼지.

## 4. 리뷰에서 나온 확인 사항 (기준 커밋 상태)

| 항목 | 지금 상태 | 할 일 |
| --- | --- | --- |
| 이미 산 회차에도 잠금 창이 뜨던 곳 | 해결됨. #7은 그대로 두었지만 #8(재생기), #9(빼꼼)에서 고쳤고, 지금은 작품 소개·홈·재생기·미리보기·빼꼼 5곳 모두 `pricePoints > 0 && !isUnlocked`일 때만 잠금 창을 엽니다. 빼꼼은 구매 뒤 돌아와도 다시 뜨지 않습니다(#9 추가 수정) | 이미 연 유료 회차는 잠금 창 없이 바로 재생하는 동작을 정책으로 확정만 해 주세요 |
| 비로그인 "로그인하기" 경로 | 2곳이 남아 있습니다. 잠금 창 주 버튼은 비로그인이면 "로그인하기"인데, `playbackScreen_preview.tsx`와 `RecommendationScreen.tsx`는 이 버튼을 포인트 화면(`/points`)으로 보냅니다. 작품 소개·홈·재생기는 `/auth/login`으로 보냅니다 | 프론트 수정입니다. 두 곳도 로그인 화면으로 보낼지 정해 주세요 |
| 보관함 `PAGE_SIZE = 30` 전제 | `front/src/screens/LibraryScreen.tsx`가 저장 취소 뒤 "더 보기" 위치를 고정 페이지 크기 30으로 계산합니다. 서버 값은 `SAVED_VIDEO_PAGE_SIZE`·`WATCH_HISTORY_PAGE_SIZE` = 30입니다 | 서버 페이지 크기를 바꾸면 프론트 값도 같이 바꿔야 합니다. 커서 방식 페이지가 생기면 이 계산이 필요 없어집니다 |
| API 문서의 옛 문장 | 그대로 남아 있습니다. [points.md](../api/05-economy/points.md) "현재 회차 재생 URL API는 구매 권한을 확인하지 않는다"와 [dramas.md](../api/02-content/dramas.md) 상세 노출 규칙 마지막 줄 "사용자별 구매·해제 여부는 재생 API 접근을 제한하지 않는다"는 코드와 [episodes.md](../api/04-playback/episodes.md)(유료 회차는 entitlement 필요)와 다릅니다 | 두 문장을 지우거나 episodes.md를 가리키게 고쳐 주세요 |
| 회차 끝 카드 접근성 | 끝 카드 묶음에 `accessibilityLabel`만 있고 `accessible`이 없어 네이티브 낭독기가 묶음 이름을 읽지 않을 수 있습니다. 끝났다는 사실은 announce로 알립니다. 끝 카드로 포커스를 옮기는 처리도 없습니다(`playbackScreen_episode.tsx`) | 프론트 수정입니다. 급하지 않습니다 |
| `autoplayNext` 설정 | 끝 카드는 자동으로 넘어가지 않습니다. 설정값은 `UserProvider`에 남아 있습니다 | 설정을 남길지 정해 주세요 |
| 저장 목록 페이지 경쟁 | #9에서 저장 취소와 "더 보기"가 겹칠 때 항목이 빠지던 문제를 고쳤습니다. 저장 취소 중에 탭이나 계정이 바뀌면 한 항목을 건너뛸 수 있는 한계가 남아 있습니다(이전 동작과 같음) | 커서 방식 페이지가 생기면 해결됩니다 |

## 5. 관련 문서

- [API 문서](../api/README.md), 공통 규칙 [conventions.md](../api/00-overview/conventions.md)
- 재생: [episodes.md](../api/04-playback/episodes.md), [watch-history.md](../api/04-playback/watch-history.md), [watch-progress.md](../api/04-playback/watch-progress.md), [saved-videos.md](../api/04-playback/saved-videos.md)
- 콘텐츠: [dramas.md](../api/02-content/dramas.md), [genres.md](../api/02-content/genres.md)
- 포인트: [points.md](../api/05-economy/points.md)
- 지표: [06-analytics](../api/06-analytics/README.md)
- 구조: [ARCHITECTURE.md](../ARCHITECTURE.md), 프론트 [전역 상태](../../front/README.md#전역-상태), [백엔드 검증](../../back/README.md#검증)
- 디자인 규칙: `web-prototype/DESIGN.md`
- PR: #4~#11 본문의 "백엔드" 절과 리뷰 요약
