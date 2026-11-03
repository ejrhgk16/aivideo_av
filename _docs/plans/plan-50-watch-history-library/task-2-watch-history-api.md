# task-2-watch-history-api

## 읽어야 할 파일

- AGENTS.md, _docs/ARCHITECTURE.md의 백엔드·Harness 책임과 검증 규칙
- 이 폴더의 plan.md, index.json의 task-2 항목, task-1의 완료 요약
- back/src/playback/watchProgressController.ts, watchProgressService.ts, entities/userWatchProgress.entity.ts
- back/src/playback/savedVideoController.ts, savedVideoService.ts, savedVideoResponses.ts, playback.module.ts의 조회·등록 패턴
- back/src/common/pagination/pagination.ts, paginationResponses.ts
- back/src/content/entities/contentVideo.entity.ts, contentImage.entity.ts, drama.entity.ts, episode.entity.ts의 조회 키·공개 조건
- back/src/content/mediaUrl.ts, back/src/identity/jwtAuthGuard.ts
- _docs/api/04-playback/watch-progress.md, saved-videos.md, README.md
- _docs/api/00-overview/conventions.md, authentication.md, error-code.md
- back/test/api/README.md의 실행 전제·suite 선택·fixture 소유권·lock 규칙
- 구현 시 적용되는 .agents/skills/nestjs-best-practices/SKILL.md 및 api-and-interface-design/SKILL.md

## 실패 시 참고할 파일

- back/test/api/watch-history.postman_collection.json, watchHistoryFixtures.mjs
- back/test/api/run.mjs, suites.mjs, fixtureContext.mjs, contentLock.mjs의 실패 관련 분기
- back/test/unit/api/suiteSelection.spec.ts, fixtureIsolation.spec.ts, watchHistoryFixtures.spec.ts

## 작업

depends_on은 task-1이다. 테스트 작성 완료 후 현재 공개된 영상에 대한 로그인 사용자 본인의 시청기록 조회 endpoint를 구현한다. task-4와 수정 파일·출력·fixture가 독립적이므로 병렬 실행할 수 있다. 이 task는 소스 구현 및 테스트 실행 역할이다. 선행 테스트 task의 파일은 읽기 전용이며, 테스트를 임의 수정하거나 assertion을 약화해 통과시키지 않는다. 테스트 결함은 근거와 함께 별도 수정 범위로 보고한다. 담당 제품 코드를 구현한 뒤 아래 checks를 모두 실행·통과해야 완료한다. 테스트 내부는 실패 분석에 필요한 부분만 읽고, 실행만을 위해 전체를 읽지 않는다. 다른 작업자가 함께 작업하므로 타인의 변경을 되돌리지 않고 아래 파일만 apply_patch로 수정한다.

### 정확한 수정 허용 파일

~~~text
back/src/playback/watchHistoryController.ts
back/src/playback/watchHistoryService.ts
back/src/playback/watchHistoryResponses.ts
back/src/playback/playback.module.ts
_docs/api/04-playback/watch-history.md
_docs/api/04-playback/README.md
_docs/ARCHITECTURE.md
~~~


### API·응답 계약

1. WatchHistoryController는 me/watch-history의 GET을 제공하고 JwtAuthGuard로 보호한다. 사용자 UUID는 request.user.uuid에서만 가져오며 query userUuid를 신뢰하지 않는다.
2. page는 기존 parsePage(rawPage, 30)를 사용한다. 생략 시 1, 양의 정수 문자열·안전한 offset/lookahead만 허용하고 중복 값·공백·선행 0·0·음수·소수·지수·안전 정수 초과는 HTTP_BAD_REQUEST 400이다. limit 선택 기능을 추가하지 않는다.
3. 응답은 items/page/hasNext다. item의 정확한 키는 videoUuid, contentType, lastPlayedAt, dramaUuid, dramaTitle, imageUrl, durationMs, episodeUuid, episodeNumber, episodeTitle이다. EPISODE는 회차 UUID/번호와 nullable 제목을, PREVIEW는 회차 세 필드 모두 null을 반환한다.
4. lastPlayedAt은 기존 DB Date를 toISOString()으로 UTC Z 문자열로 반환한다. savedAt, 내부 숫자 ID, 재생 URL, positionMs, isCompleted를 목록 응답에 추가하지 않는다.
5. user_watch_progress를 실제 video.id와 JOIN하고 JWT 사용자 조건을 DB에 적용한다. isCompleted/positionMs 조건은 넣지 않는다. 복합 키로 한 영상은 한 항목이며 FULL/PREVIEW·서로 다른 FULL 영상은 각각 독립 항목이다.
6. 허용 조합은 EPISODE/FULL과 DRAMA/PREVIEW다. 작품과 본편 회차는 PUBLISHED이고 publishedAt <= UTC_TIMESTAMP(3)여야 한다. 프리뷰는 회차가 필요 없다. 현재 비공개인 항목은 목록에서만 제외하며 저장 기록을 삭제하지 않는다. 필터 적용 후 정렬·offset·limit을 수행한다.
7. 정렬은 progress.lastPlayedAt DESC, progress.videoId DESC다. 이미지·회차 JOIN으로 행이 늘어나지 않도록 이미지는 단일 scalar subquery로 선택한다. 기존 저장 목록과 같은 POSTER_LANDSCAPE 우선/POSTER 대체 및 createDramaImageUrls를 사용한다.
8. 조회는 entitlement/지갑을 변경하거나 재생 URL을 생성하지 않는다. 목록 자체에서는 현재 구매 권한으로 기록을 제외하지 않는다. 무료/유료 재생 권한은 기존 재생 endpoint가 검사한다.
9. playback.module.ts에 새 controller와 service만 등록한다. 기존 저장·기록 쓰기 서비스와 공통 페이징/인증 코드를 리팩토링하지 않는다.


### 제품 문서

- _docs/api/04-playback/watch-history.md에 경로·인증·입력·정확한 성공/오류 응답·정렬·공개 조건·본인 격리·빈 페이지·동시 시청에 따른 offset 이동을 작성한다. 도메인 README에 링크를 추가한다.
- ARCHITECTURE.md의 playback 책임에 시청기록 조회를 추가하고 최종 프론트의 화면별 기록 전송·보관함 조회 흐름, 전체 9개 API suite와 전용 fixture 책임을 반영한다. 기존 Harness 정책과 무관한 설명은 변경하지 않는다.
- task-1이 작성한 컬렉션·fixture·실행기·내부 테스트는 수정하지 않는다.

### 주요 로직 코드 또는 변경 예시

새 service의 핵심 조회 흐름이다. import와 응답 타입은 위 파일에 정의하고 아래 조회·매핑을 실구현한다. 공통 QueryBuilder 추상화나 새 raw SQL 조회는 만들지 않는다.

~~~ts
export const WATCH_HISTORY_PAGE_SIZE = 30;

type HistoryRow = {
  videoUuid: string;
  videoContentType: 'DRAMA' | 'EPISODE';
  lastPlayedAt: Date;
  dramaUuid: string;
  dramaTitle: string;
  imageKey: string | null;
  durationMs: number | string;
  episodeUuid: string | null;
  episodeNumber: number | string | null;
  episodeTitle: string | null;
};

@Injectable()
export class WatchHistoryService {
  constructor(private readonly dataSource: DataSource) {}

  async list(userUuid: string, page: number): Promise<WatchHistoryPageResponse> {
    const { offset, limit } = getPageWindow(page, WATCH_HISTORY_PAGE_SIZE);
    const rows = await this.dataSource.createQueryBuilder()
      .from(UserWatchProgress, 'progress')
      .innerJoin(User, 'appUser',
        'appUser.id = progress.userId AND appUser.uuid = :userUuid', { userUuid })
      .innerJoin(ContentVideo, 'video', 'video.id = progress.videoId')
      .leftJoin(Episode, 'episode',
        "video.contentType = 'EPISODE' AND video.kind = 'FULL' AND episode.id = video.contentId")
      .innerJoin(Drama, 'drama',
        "((video.contentType = 'EPISODE' AND video.kind = 'FULL' AND drama.id = episode.dramaId) OR " +
        "(video.contentType = 'DRAMA' AND video.kind = 'PREVIEW' AND drama.id = video.contentId))")
      .where("drama.status = 'PUBLISHED' AND drama.publishedAt <= UTC_TIMESTAMP(3)")
      .andWhere("((video.contentType = 'DRAMA' AND video.kind = 'PREVIEW') OR " +
        "(video.contentType = 'EPISODE' AND video.kind = 'FULL' AND " +
        "episode.status = 'PUBLISHED' AND episode.publishedAt <= UTC_TIMESTAMP(3)))")
      .select('video.uuid', 'videoUuid')
      .addSelect('video.contentType', 'videoContentType')
      .addSelect('progress.lastPlayedAt', 'lastPlayedAt')
      .addSelect('video.durationMs', 'durationMs')
      .addSelect('drama.uuid', 'dramaUuid')
      .addSelect('drama.title', 'dramaTitle')
      .addSelect('episode.uuid', 'episodeUuid')
      .addSelect('episode.episodeNumber', 'episodeNumber')
      .addSelect('episode.title', 'episodeTitle')
      .addSelect(sub => sub.select('image.storageKey').from(ContentImage, 'image')
        .where("image.contentType = 'DRAMA' AND image.contentId = drama.id")
        .andWhere("image.kind IN ('POSTER_LANDSCAPE', 'POSTER')")
        .orderBy("CASE image.kind WHEN 'POSTER_LANDSCAPE' THEN 0 ELSE 1 END", 'ASC')
        .addOrderBy('image.displayOrder', 'ASC')
        .limit(1), 'imageKey')
      .orderBy('progress.lastPlayedAt', 'DESC')
      .addOrderBy('progress.videoId', 'DESC')
      .offset(offset)
      .limit(limit)
      .getRawMany<HistoryRow>();
    const result = createPageResponse(rows, page, WATCH_HISTORY_PAGE_SIZE);
    return {
      ...result,
      items: result.items.map<WatchHistoryItemResponse>(row => {
        const base = {
          videoUuid: row.videoUuid,
          lastPlayedAt: row.lastPlayedAt.toISOString(),
          dramaUuid: row.dramaUuid,
          dramaTitle: row.dramaTitle,
          imageUrl: createDramaImageUrls({
            poster: row.imageKey, posterLandscape: null, homeHero: null,
            detailCover: null, campaigns: [],
          }).poster,
          durationMs: Number(row.durationMs),
        };
        return row.videoContentType === 'DRAMA'
          ? { ...base, contentType: 'PREVIEW', episodeUuid: null,
              episodeNumber: null, episodeTitle: null }
          : { ...base, contentType: 'EPISODE', episodeUuid: row.episodeUuid!,
              episodeNumber: Number(row.episodeNumber), episodeTitle: row.episodeTitle };
      }),
    };
  }
}
~~~

위 service 호출 지점은 다음과 같다. 새 응답 타입은 PageResponse<WatchHistoryItemResponse>와 EPISODE/PREVIEW 판별 유니온으로 선언하며 Entity 타입을 외부 응답으로 사용하지 않는다.

~~~ts
@Controller('me/watch-history')
@UseGuards(JwtAuthGuard)
export class WatchHistoryController {
  constructor(private readonly history: WatchHistoryService) {}

  @Get()
  list(
    @Req() request: Request & { user: { uuid: string } },
    @Query('page') rawPage: unknown,
  ): Promise<WatchHistoryPageResponse> {
    return this.history.list(
      request.user.uuid,
      parsePage(rawPage, WATCH_HISTORY_PAGE_SIZE),
    );
  }
}
~~~


### 검증 명령

~~~text
npm --prefix back run test:unit -- test/unit/api/suiteSelection.spec.ts test/unit/api/fixtureIsolation.spec.ts test/unit/api/watchHistoryFixtures.spec.ts
npm --prefix back run test:api -- --suite watch-history --suite watch-progress --suite saved-videos
npm --prefix back run test:api
~~~


새 GET의 실제 계약은 watch-history, 같은 모듈의 기록 쓰기와 저장 목록 회귀는 watch-progress/saved-videos가 검사한다. task-1의 실행기 분기와 기본 suite 등록 변경까지 책임지고 단위 테스트·선택 API 실행·무인자 전체 API 실행을 수행한다. 기존 8개에서 전체 9개 suite가 되므로 전체 실행이 필요하며, 동일 검사를 변경 없이 반복하지 않는다.

### 완료 조건과 실행 전제

- API·응답 타입·module 등록·도메인 문서가 일치하고 미완료·완료·본편·미리보기·별도 FULL 기록을 정확히 조회한다.
- 0/30/31개와 빈 다음 페이지, 동률/최근 재시청 정렬, 본인 격리·query spoofing·공개 조건·입력/인증 오류를 실제 HTTP에서 검증한다. GET이 기존 데이터나 권한을 변경하지 않는다.
- suite 선택/전체 실행과 fixture 실패 정리 검사가 모두 통과하고 run 소유 콘텐츠/사용자/진행 기록이 남지 않는다. 준비 실패·cleanup 실패를 통과로 처리하지 않는다.
- HTTP로 기존 http://localhost:3000의 연결과 새 endpoint의 현재 코드 반영을 먼저 확인한다. 필수 JWT가 없는 새 GET의 401과 실제 인증된 GET 응답으로 반영 여부를 검사한다. 확인할 수 없으면 사용자에게 확인한다.
- 서버가 없으면 검증 실패와 npm --prefix back run start:dev 실행 안내를 남긴다. 자동 실행·임의 포트·DB reset/seed·실데이터 상태 변경·미디어 다운로드를 하지 않는다.


### 반복 작업 위임

불가. JWT 조회·공개 조건·응답 매핑과 통합 검증은 별도 설계 판단이 필요하다. 담당 worker가 소스 통합·모든 checks·fixture 정리 결과 확인과 최종 보고를 맡으며 하위 슬롯은 0개다.
