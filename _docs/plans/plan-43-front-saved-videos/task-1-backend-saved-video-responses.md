# task-1-backend-saved-video-responses

## 읽어야 할 파일

- AGENTS.md
- _docs/ARCHITECTURE.md
- _docs/plans/plan-43-front-saved-videos/plan.md
- back/test/api/README.md
- back/src/playback/savedVideoController.ts
- back/src/playback/entities/userSavedVideo.entity.ts
- back/src/content/entities/contentVideo.entity.ts
- back/src/content/entities/contentImage.entity.ts
- back/src/content/mediaUrl.ts
- back/src/content/content.module.ts
- back/src/identity/identity.module.ts
- back/src/identity/optionalJwtAuthGuard.ts
- .agents/skills/api-and-interface-design/SKILL.md
- .agents/skills/nestjs-best-practices/SKILL.md
- back/src/playback/savedVideoService.ts
- back/src/content/publicCatalogController.ts
- back/src/content/publicCatalogService.ts
- back/src/programming/publicCollectionController.ts
- back/src/programming/publicCollectionService.ts
- back/src/programming/programming.module.ts
- back/test/unit/playback/savedVideoService.spec.ts
- back/test/unit/content/publicCatalogService.spec.ts
- back/test/unit/programming/publicCollectionService.spec.ts
- back/test/api/public.postman_collection.json
- _docs/api/04-playback/saved-videos.md
- _docs/api/04-playback/episodes.md
- _docs/api/02-content/dramas.md
- _docs/api/03-programming/collections.md
- _docs/api/00-overview/authentication.md

## 작업

### 파일 범위

아래 파일만 변경한다. 다른 작업자의 변경을 되돌리지 말고 최신 코드를 읽어 반영한다. 이 task는 제품 구현을 담당하며 계획 밖 기능을 추가하지 않는다.

- back/src/playback/savedVideoService.ts
- back/src/content/publicCatalogController.ts
- back/src/content/publicCatalogService.ts
- back/src/programming/publicCollectionController.ts
- back/src/programming/publicCollectionService.ts
- back/src/programming/programming.module.ts
- back/test/unit/playback/savedVideoService.spec.ts
- back/test/unit/content/publicCatalogService.spec.ts
- back/test/unit/programming/publicCollectionService.spec.ts
- back/test/api/public.postman_collection.json
- _docs/api/04-playback/saved-videos.md
- _docs/api/04-playback/episodes.md
- _docs/api/02-content/dramas.md
- _docs/api/03-programming/collections.md
- _docs/api/00-overview/authentication.md

### 의존성과 검증

- depends_on: []
- dev에서 수행하고 branch·worktree를 만들지 않는다. 수정은 apply_patch만 사용한다.

~~~text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
~~~

### 목표와 구현 지시

1. 기존 저장·해제 API의 입력·응답·권한·멱등성은 유지한다. SavedVideoService.list의 항목에 아래 계약을 추가한다. 기존 videoUuid/contentType/savedAt, page/hasNext를 보존한다.
2. 카드마다 작품 상세를 HTTP로 재조회하지 않도록 목록에서 표시·이동 정보를 완성한다. 목록에 서명 재생 URL을 넣지 않는다. 이동한 기존 재생 화면이 공개·구매 권한을 다시 평가한다.
3. 영상 정보를 반환하는 아래 API에 저장 여부를 추가한다. 저장 행은 video_id와 JWT 사용자의 내부 user_id를 함께 비교한다. 익명은 조인되지 않아 false이며 타인 저장은 true가 되지 않아야 한다.
   - GET /dramas: previewVideos[].isSaved.
   - GET /dramas/:dramaId: previewVideos[].isSaved와 episodes[].videoUuid, episodes[].isSaved.
   - GET /collections/:code: dramas[].previewVideos[].isSaved.
   - GET /episodes/:episodeId/playback: videoUuid와 isSaved.
   - GET /dramas/:dramaId/previews/:videoId/playback: videoUuid와 isSaved.
4. 작품 목록·컬렉션·프리뷰 재생에 기존 OptionalJwtAuthGuard와 AllExceptionFilter를 적용하고 검증된 request.user?.uuid만 서비스로 전달한다. 작품 상세와 본편 재생의 선택 인증도 유지한다. ProgrammingModule은 IdentityModule을 import해 기존 인증 provider를 재사용한다. 쿼리의 userUuid로 사용자를 고르게 하지 않는다.
5. DB 접근은 QueryBuilder를 사용한다. 기존 영상 일괄 조회에 LEFT JOIN을 적용하고 raw 결과의 isSaved는 Number(value) === 1로 boolean 변환한다. 영상별·작품별 반복 조회를 추가하지 않는다. 기존 함수의 now 인자 위치와 단위 테스트의 시간 제어를 보존하는 방향으로 선택 userUuid 인자를 추가한다.
6. 본편은 기존 최저 displayOrder의 FULL 영상만 대표로 선택한다. 작품 상세에서 대표 FULL이 없는 공개 회차도 기존처럼 유지하며 videoUuid: null, isSaved: false를 반환한다. 단순 FULL JOIN으로 회차 중복·개수 변화를 만들지 않는다. 회차 번호 정렬·시청기록·구매 권한 JOIN을 유지한다.
7. 목록은 공개 조건과 JWT 사용자 조건을 적용하고 saved_at DESC, video_id DESC로 31개를 읽어 앞 30개를 반환한다. 이미지 다중 행 JOIN으로 페이지를 늘리지 않는다. 아래 예시처럼 scalar subquery 또는 페이지 대상 일괄 이미지 조회로 한 영상당 한 항목을 유지한다.
8. 이미지 우선순위는 본편의 EPISODE_COVER → 작품 POSTER_LANDSCAPE → POSTER다. 프리뷰는 작품 POSTER_LANDSCAPE → POSTER다. 같은 종류에서는 최저 displayOrder를 고른다. 기존 createDramaImageUrls로 공개 URL을 만들고 이미지가 없으면 null로 반환한다.
9. API 정의서 5개를 실제 응답·선택 인증과 일치시킨다. episodes.md에 남아 있는 프리뷰의 공개 인증 설명, authentication.md의 공개 API 목록도 수정한다. 공통 오류 형식이나 conventions 자체는 변경하지 않는다.

### 응답 계약

프리뷰와 본편은 contentType으로 구분한다. 공개 UUID와 표시 필드만 노출하며 내부 숫자 ID·storageKey·재생 URL을 저장 목록에 새로 노출하지 않는다.

~~~ts
type SavedVideoBase = {
  videoUuid: string;
  savedAt: string;
  dramaUuid: string;
  dramaTitle: string;
  imageUrl: string | null;
  durationMs: number;
};
type SavedVideoItem = SavedVideoBase & (
  | { contentType: 'PREVIEW'; episodeUuid: null; episodeNumber: null; episodeTitle: null }
  | { contentType: 'EPISODE'; episodeUuid: string; episodeNumber: number; episodeTitle: string | null }
);
type SavedVideoPage = { items: SavedVideoItem[]; page: number; hasNext: boolean };
~~~

목록의 모든 항목은 본인 저장으로 이미 확인되므로 isSaved를 중복 필드로 추가할 필요가 없다. 개별 영상 조회와 작품·컬렉션 영상 배열에는 필수 boolean isSaved를 추가한다. 이 저장 목록 타입과 필드명은 task-2가 그대로 사용한다.

### 주요 로직 코드 또는 변경 예시

다음은 기존 publicVideos()를 사용하는 목록의 핵심 흐름이다. Row 타입은 아래 선택 필드와 일치시켜 같은 서비스 파일에 선언한다. 기존 save/remove는 이 조회 변경 때문에 재작성하지 않는다.

~~~ts
const rows = await this.publicVideos()
  .innerJoin(UserSavedVideo, 'saved', 'saved.videoId = video.id')
  .innerJoin(User, 'appUser',
    'appUser.id = saved.userId AND appUser.uuid = :userUuid', { userUuid })
  .andWhere("((saved.contentType = 'EPISODE' AND video.contentType = 'EPISODE' AND video.kind = 'FULL') OR " +
    "(saved.contentType = 'PREVIEW' AND video.contentType = 'DRAMA' AND video.kind = 'PREVIEW'))")
  .select('video.uuid', 'videoUuid')
  .addSelect('video.durationMs', 'durationMs')
  .addSelect('saved.contentType', 'contentType')
  .addSelect('saved.savedAt', 'savedAt')
  .addSelect('drama.uuid', 'dramaUuid')
  .addSelect('drama.title', 'dramaTitle')
  .addSelect('episode.uuid', 'episodeUuid')
  .addSelect('episode.episodeNumber', 'episodeNumber')
  .addSelect('episode.title', 'episodeTitle')
  .addSelect(sub => sub.select('image.storageKey').from(ContentImage, 'image')
    .where("(image.contentType = 'EPISODE' AND image.contentId = episode.id AND image.kind = 'EPISODE_COVER') OR " +
      "(image.contentType = 'DRAMA' AND image.contentId = drama.id AND image.kind IN ('POSTER_LANDSCAPE', 'POSTER'))")
    .orderBy("CASE image.kind WHEN 'EPISODE_COVER' THEN 0 WHEN 'POSTER_LANDSCAPE' THEN 1 ELSE 2 END", 'ASC')
    .addOrderBy('image.displayOrder', 'ASC')
    .limit(1), 'imageKey')
  .orderBy('saved.savedAt', 'DESC')
  .addOrderBy('saved.videoId', 'DESC')
  .offset((page - 1) * 30)
  .limit(31)
  .getRawMany<Row>();

const items: SavedVideoItem[] = rows.slice(0, 30).map(row => {
  const base: SavedVideoBase = {
    videoUuid: row.videoUuid,
    savedAt: row.savedAt.toISOString(),
    dramaUuid: row.dramaUuid,
    dramaTitle: row.dramaTitle,
    durationMs: Number(row.durationMs),
    imageUrl: createDramaImageUrls({
      poster: row.imageKey, posterLandscape: null, homeHero: null,
      detailCover: null, campaigns: [],
    }).poster,
  };
  return row.contentType === 'PREVIEW'
    ? { ...base, contentType: 'PREVIEW', episodeUuid: null, episodeNumber: null, episodeTitle: null }
    : { ...base, contentType: 'EPISODE', episodeUuid: row.episodeUuid!,
        episodeNumber: Number(row.episodeNumber), episodeTitle: row.episodeTitle };
});
return { items, page, hasNext: rows.length > 30 };
~~~

프리뷰 일괄 조회의 저장 여부 조인 예시다. 목록과 상세·컬렉션의 기존 preview 정렬·storageKey·durationMs 필드는 유지한다. 각 서비스에 필요한 작은 로직만 추가하고 저장 서비스에 의존하는 순환 모듈은 만들지 않는다.

~~~ts
const videos = await this.contentVideoRepository.createQueryBuilder('video')
  .leftJoin(User, 'viewer', 'viewer.uuid = :userUuid', { userUuid: userUuid ?? null })
  .leftJoin(UserSavedVideo, 'saved',
    "saved.videoId = video.id AND saved.userId = viewer.id AND saved.contentType = 'PREVIEW'")
  .select('video.uuid', 'uuid')
  .addSelect('video.contentId', 'contentId')
  .addSelect('video.storageKey', 'storageKey')
  .addSelect('video.durationMs', 'durationMs')
  .addSelect('video.displayOrder', 'displayOrder')
  .addSelect('CASE WHEN saved.videoId IS NULL THEN 0 ELSE 1 END', 'isSaved')
  .where("video.contentType = 'DRAMA' AND video.kind = 'PREVIEW'")
  .andWhere('video.contentId IN (:...dramaIds)', { dramaIds })
  .orderBy('video.displayOrder', 'ASC')
  .getRawMany<{
    uuid: string; contentId: number; storageKey: string;
    durationMs: number; displayOrder: number; isSaved: number | string;
  }>();
const mapped = videos.map(video => ({ ...video, isSaved: Number(video.isSaved) === 1 }));
~~~

본편의 기존 getEpisodeVideo QueryBuilder에는 다음 필드를 더하고, 서명 URL 응답까지 전달한다. entitlement 확인을 우회하거나 저장 여부로 권한을 판단하지 않는다.

~~~ts
.leftJoin(UserSavedVideo, 'saved',
  "saved.videoId = video.id AND saved.userId = playbackUser.id AND saved.contentType = 'EPISODE'")
.addSelect('video.uuid', 'videoUuid')
.addSelect('CASE WHEN saved.videoId IS NULL THEN 0 ELSE 1 END', 'isSaved')
~~~

기존 프리뷰 재생은 videoId와 부모 dramaId를 함께 확인하는 QueryBuilder로 바꾸고 동일한 사용자·저장 JOIN을 적용한다. 성공 응답은 url, durationMs, videoUuid, isSaved다. 본편 성공 응답은 기존 필드에 videoUuid, isSaved만 더한다.

### 테스트와 완료 조건

- Postman은 기존 runner의 저장 fixture·토큰을 재사용한다. runner·시드·DB 스키마를 변경하지 않는다. 저장 목록의 정확한 키 집합을 검사하는 기존 assertion도 확장 계약에 맞춘다.
- 실제 PUT 후 동일 JWT의 작품 목록·상세·컬렉션·해당 재생 API에서 isSaved: true, DELETE 후 false를 검사한다. 컬렉션에 존재하는 기존 작품과 fixture가 일치하는지 응답에서 선택한다. 유료 본편은 저장이 가능하지만 미구매 재생은 기존 403이므로 권한 있는 본편 또는 무료 본편으로 성공 응답도 검증한다.
- 익명·다른 JWT에서 false, userUuid query 위조 무시, 선택 인증 API의 잘못된/만료 Access·Refresh 제출 거부를 검증한다. 다른 사용자의 전체 저장 목록 보존 검증도 유지한다.
- 프리뷰·본편 목록 항목의 작품/영상/회차 식별자와 카드 정보, 기존 0·30·31개 페이지와 동률 정렬·비공개 제외·멱등 삭제 검증을 유지한다.
- 기존 단위 테스트 3개는 응답 확장·QueryBuilder mock·선택 인증 metadata 변화에 맞춰 최소 수정한다. 새로운 HTTP 동작을 단위 테스트로 대체하지 않는다. UTC 직렬화, publication/environment 경계, DB 장애 전파를 보존한다.
- API 검증 전에 기존 http://localhost:3000에 HTTP 요청하고 현재 코드 반영을 확인한다. 서버가 없으면 실패로 보고 npm --prefix back run start:dev를 안내한다. 서버 자동 실행·다른 포트 우회·연결 실패를 통과 처리하지 않는다. 코드 반영을 확인할 수 없으면 사용자에게 확인한다.
- checks 3개가 모두 통과하고, 조회 결과에 타인 저장이 섞이지 않으며, 기존 권한·정렬·페이지 결과가 보존되고 문서가 일치하면 완료다.
