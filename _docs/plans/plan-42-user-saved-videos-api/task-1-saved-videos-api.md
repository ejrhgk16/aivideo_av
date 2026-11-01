# task-1-saved-videos-api

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/plan-42-user-saved-videos-api/plan.md`
- `_docs/plans/plan-42-user-saved-videos-api/index.json`
- `.agents/skills/api-and-interface-design/SKILL.md`
- `.agents/skills/nestjs-best-practices/SKILL.md`
- `back/src/playback/playback.module.ts`
- `back/src/playback/watchProgressController.ts`
- `back/src/playback/watchProgressService.ts`
- `back/src/playback/entities/userSavedVideo.entity.ts`
- `back/src/content/entities/contentVideo.entity.ts`
- `back/src/content/entities/drama.entity.ts`
- `back/src/content/entities/episode.entity.ts`
- `back/src/identity/jwtAuthGuard.ts`
- `back/src/identity/jwtStrategy.ts`
- `back/src/common/error/error.filter.ts`
- `back/src/common/database/databaseConfig.ts`
- `back/test/api/run.mjs`
- `back/test/api/public.postman_collection.json`
- `back/test/api/README.md`
- `_docs/api/00-overview/authentication.md`
- `_docs/api/04-playback/README.md`
- `_docs/AI_DRAMA_data_model/04-playback/user_saved_videos.md`

변경 경로에 적용되는 추가 하위 AGENTS.md는 없다. 프론트는 작업 범위가 아니다.

## 작업

영상 저장·30개 단위 조회 API를 구현하고 같은 task에서 문서·실제 HTTP 검증을 완성한다. 아래 11개 파일을 책임진다. 다른 작업자와 사용자가 같은 저장소를 사용할 수 있으므로 다른 변경을 되돌리지 말고 현재 코드에 맞추어 작업한다. 수정은 `apply_patch`로만 수행한다.

### 정확한 파일 범위

- 추가: `back/src/playback/savedVideoController.ts`
- 추가: `back/src/playback/savedVideoService.ts`
- 수정: `back/src/playback/playback.module.ts`
- 수정: `back/test/api/public.postman_collection.json`
- 수정: `back/test/api/run.mjs`
- 수정: `back/test/api/README.md`
- 추가: `back/test/unit/playback/savedVideoService.spec.ts`
- 추가: `_docs/api/04-playback/saved-videos.md`
- 수정: `_docs/api/04-playback/README.md`
- 수정: `_docs/api/00-overview/authentication.md`
- 수정: `_docs/ARCHITECTURE.md`

### 계약·권한·공개 조건

- `PUT /me/saved-videos/:videoUuid`: body `{ "contentType": "EPISODE" }` 또는 `{ "contentType": "PREVIEW" }`, 성공 204. 종류의 기본값·자동 판별·대소문자 보정을 하지 않는다.
- `GET /me/saved-videos?page=1`: `{ "items": [{ "videoUuid": "<uuid>", "contentType": "PREVIEW", "savedAt": "2026-11-01T00:00:00.000Z" }], "page": 1, "hasNext": false }`.
- 페이지 크기는 30 고정. 생략 시 1, 0·음수·소수·빈 값·배열·숫자 이외·안전하게 offset을 계산할 수 없는 큰 값은 400. 요청 limit으로 크기를 바꾸지 않는다.
- 양쪽 endpoint에 기존 `JwtAuthGuard`와 `AllExceptionFilter`를 적용한다. 서명·만료·용도·활성 사용자 검사는 기존 Strategy에 맡긴다. 별도 토큰 파서를 만들지 않는다.
- 인증 실패는 `AUTH_INVALID_TOKEN`(401). body·UUID·page 입력 오류는 기존 NestJS 400, 없는 영상·비공개·종류 불일치는 기존 NestJS 404. DB 장애를 401·404로 숨기지 않는다.
- 사용자 선택은 오직 `request.user.uuid`다. body/query의 `userUuid`는 선택에 사용하지 않는다.
- `EPISODE`: `content_videos.content_type='EPISODE' AND kind='FULL'`. `PREVIEW`: `content_type='DRAMA' AND kind='PREVIEW'`. 입력 종류와 이 조건의 일치 여부를 검증한다.
- 작품은 `PUBLISHED` 및 `published_at <= UTC_TIMESTAMP(3)`여야 한다. 본편은 해당 회차도 같은 공개 조건을 충족해야 한다. null 공개 시각은 제외한다.
- 조회에서도 종류 일치·현재 공개 조건·본인 조건을 DB에서 적용한 뒤 정렬·offset·limit한다. 제외 항목 때문에 페이지가 일찍 잘리지 않게 한다. 조회로 저장 행을 삭제하지 않는다.
- entitlement·지갑을 검사하거나 변경하지 않는다. 미구매 유료 본편도 저장 가능하며 기존 재생 시 권한 검사는 유지한다. 목록에서 재생 URL을 발급하지 않는다.
- `(user_id, video_id)` PK로 동시 중복 저장을 처리하고 최초 `saved_at`·`content_type`을 유지한다. 신규 저장은 `UTC_TIMESTAMP(3)`을 명시한다. MySQL 세션 시간대에 의존하는 기존 기본값은 변경하지 않는다.

### 주요 로직 코드 또는 변경 예시

컨트롤러의 입력→인증 사용자 전달 흐름은 다음과 같다. import·포맷은 기존 프로젝트 스타일에 맞춘다. 별도 DTO 라이브러리·repository 계층을 추가하지 않는다.

```ts
import {
  BadRequestException, Body, Controller, Get, HttpCode, Param, Put,
  Query, Req, UseFilters, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AllExceptionFilter } from '../common/error/error.filter.js';
import { JwtAuthGuard } from '../identity/jwtAuthGuard.js';
import { SavedVideoService } from './savedVideoService.js';

type AuthenticatedRequest = Request & { user: { uuid: string } };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('me/saved-videos')
@UseGuards(JwtAuthGuard)
@UseFilters(AllExceptionFilter)
export class SavedVideoController {
  constructor(private readonly savedVideos: SavedVideoService) {}

  @Put(':videoUuid')
  @HttpCode(204)
  async save(
    @Req() request: AuthenticatedRequest,
    @Param('videoUuid') videoUuid: string,
    @Body() body: unknown,
  ): Promise<void> {
    if (!uuidPattern.test(videoUuid) || !body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Invalid saved video');
    }
    const { contentType } = body as Record<string, unknown>;
    if (contentType !== 'EPISODE' && contentType !== 'PREVIEW') {
      throw new BadRequestException('Invalid contentType');
    }
    await this.savedVideos.save(request.user.uuid, videoUuid, contentType);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query('page') rawPage: unknown) {
    const page = rawPage === undefined ? 1
      : typeof rawPage === 'string' && /^[1-9][0-9]*$/.test(rawPage) ? Number(rawPage) : NaN;
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger((page - 1) * 30 + 31)) {
      throw new BadRequestException('Invalid page');
    }
    return this.savedVideos.list(request.user.uuid, page);
  }
}
```

서비스의 공개 영상 조회·쓰기·페이지 처리 예시다. 같은 클래스의 query builder 재사용으로 저장·조회 공개 조건을 일치시킨다. 특히 OR 전체를 괄호로 묶어 뒤의 사용자·UUID 조건이 모든 분기에 적용되게 한다.

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ContentVideo, Drama, Episode } from '../content/entities/index.js';
import { User } from '../identity/entities/index.js';
import { UserSavedVideo } from './entities/index.js';

export type SavedContentType = 'EPISODE' | 'PREVIEW';
type SavedRow = { videoUuid: string; contentType: SavedContentType; savedAt: Date };
export type SavedVideoPage = {
  items: Array<{ videoUuid: string; contentType: SavedContentType; savedAt: string }>;
  page: number;
  hasNext: boolean;
};

@Injectable()
export class SavedVideoService {
  constructor(private readonly dataSource: DataSource) {}

  private publicVideos() {
    return this.dataSource.createQueryBuilder()
      .from(ContentVideo, 'video')
      .leftJoin(Episode, 'episode',
        "video.contentType = 'EPISODE' AND video.kind = 'FULL' AND episode.id = video.contentId")
      .innerJoin(Drama, 'drama',
        "((video.contentType = 'EPISODE' AND video.kind = 'FULL' AND drama.id = episode.dramaId) OR " +
        "(video.contentType = 'DRAMA' AND video.kind = 'PREVIEW' AND drama.id = video.contentId))")
      .where("drama.status = 'PUBLISHED' AND drama.publishedAt <= UTC_TIMESTAMP(3)")
      .andWhere("((video.contentType = 'DRAMA' AND video.kind = 'PREVIEW') OR " +
        "(video.contentType = 'EPISODE' AND video.kind = 'FULL' AND " +
        "episode.status = 'PUBLISHED' AND episode.publishedAt <= UTC_TIMESTAMP(3)))");
  }

  async save(userUuid: string, videoUuid: string, contentType: SavedContentType): Promise<void> {
    const row = await this.publicVideos()
      .innerJoin(User, 'appUser', 'appUser.uuid = :userUuid', { userUuid })
      .select('appUser.id', 'userId')
      .addSelect('video.id', 'videoId')
      .andWhere('video.uuid = :videoUuid', { videoUuid })
      .andWhere(contentType === 'EPISODE'
        ? "video.contentType = 'EPISODE' AND video.kind = 'FULL'"
        : "video.contentType = 'DRAMA' AND video.kind = 'PREVIEW'")
      .getRawOne<{ userId: number; videoId: number }>();
    if (!row) throw new NotFoundException('Saved video target was not found');
    await this.dataSource.query(
      `INSERT INTO user_saved_videos (user_id, video_id, content_type, saved_at)
       VALUES (?, ?, ?, UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE video_id = video_id`,
      [row.userId, row.videoId, contentType],
    );
  }

  async list(userUuid: string, page: number): Promise<SavedVideoPage> {
    const rows = await this.publicVideos()
      .innerJoin(UserSavedVideo, 'saved', 'saved.videoId = video.id')
      .innerJoin(User, 'appUser', 'appUser.id = saved.userId AND appUser.uuid = :userUuid', { userUuid })
      .andWhere("((saved.contentType = 'EPISODE' AND video.contentType = 'EPISODE' AND video.kind = 'FULL') OR " +
        "(saved.contentType = 'PREVIEW' AND video.contentType = 'DRAMA' AND video.kind = 'PREVIEW'))")
      .select('video.uuid', 'videoUuid')
      .addSelect('saved.contentType', 'contentType')
      .addSelect('saved.savedAt', 'savedAt')
      .orderBy('saved.savedAt', 'DESC')
      .addOrderBy('saved.videoId', 'DESC')
      .offset((page - 1) * 30)
      .limit(31)
      .getRawMany<SavedRow>();
    return {
      items: rows.slice(0, 30).map(row => ({
        videoUuid: row.videoUuid,
        contentType: row.contentType,
        savedAt: row.savedAt.toISOString(),
      })),
      page,
      hasNext: rows.length > 30,
    };
  }
}
```

`playback.module.ts`의 controllers에 `SavedVideoController`, providers에 `SavedVideoService`를 추가한다. 기존 IdentityModule·WatchProgress 등록은 유지한다. DataSource만 주입하면 불필요한 repository 등록은 추가하지 않는다.

### 실제 HTTP 테스트와 임시 데이터

- 기존 컬렉션의 인증 fixture 로그인 후, 구매 변경 전 새 시나리오를 실행한다. 테스트 세션은 기존 흐름대로 logout한다.
- `run.mjs`의 HTTP 사전 확인·로그인 전달·진행 기록 정리는 유지하고 저장 시나리오용 fixture 준비·정리만 보완한다.
- 기본 개발 모드는 먼저 unentitled fixture 사용자의 기존 저장 행이 비어 있는지 SELECT한다. 기존 저장이 있으면 삭제하지 말고 fixture 충돌로 실패한다. 0·정확히 30·31개 경계를 실제 HTTP로 증명하기 위한 전제다.
- 이번 실행의 UUID를 갖는 임시 영상 31개(미리보기 30개, 미구매 유료 본편 FULL 1개)를 생성한다. 기존 공개 작품·미구매 공개 유료 회차를 참조하고 기존 영상은 수정하지 않는다. display_order는 충돌 없이 기존보다 뒤로 지정해 기존 첫 재생 영상을 유지한다. 실제 S3 객체는 만들지 않는다.
- UUID·종류·기대 정렬 정보를 기존 임시 Postman 환경으로 전달한다. 비밀 값·JWT·DB 연결 정보는 컬렉션·로그에 남기지 않는다.
- 첫 GET 빈 목록 → 처음 30개 실제 PUT → 첫 페이지 30개 및 hasNext=false → 31번째 PUT → 첫 페이지 30개 및 hasNext=true → 두 번째 페이지 1개 및 hasNext=false → 세 번째 페이지 빈 배열을 검증한다. 기본 page, 잘못된 page, limit으로 크기를 바꿀 수 없는 점도 확인한다.
- 전체 31개 UUID가 중복·누락 없이 조회되고 UTC 시각 내림차순인지 확인한다. 동일 시각의 기대 순서는 runner가 아는 영상 ID 순서로 확인하되 API에 내부 ID를 노출하지 않는다.
- 반복·동시 PUT 뒤 한 행과 최초 savedAt 유지, 두 종류 성공, 종류 불일치 404, 잘못된 body·UUID 400, 없는 대상 404를 검증한다.
- 상대 사용자에게만 저장한 임시 영상이 본인 목록에 나오지 않는지 두 사용자로 확인한다. body/query의 userUuid 위조가 저장·조회 사용자를 바꾸지 못하는지도 양쪽 분기로 검증한다. 최초 사용자 목록 비교는 기존 저장을 고려한 baseline을 보존한다.
- 양 endpoint에서 각각 헤더 없음·변조·만료 Access·Refresh 제출의 401을 확인한다. 만료 토큰은 runner에서 기존 키로 과거 exp를 설정해 메모리상 생성하고 임시 환경으로만 전달한다. 서명 키는 Postman에 넘기지 않는다.
- 공개 상태용 임시 작품·회차·영상은 따로 준비해 기존 콘텐츠의 상태를 변경하지 않는다. DRAFT·SCHEDULED·미래·null 공개 시각과 잘못된 영상 종류에 대해 Postman PUT이 404인지 확인한다. 본편 부모 작품 및 회차 조건을 각각 다룬다.
- 저장 후 비공개 전환은 runner 준비 단계에서 임시 부모가 공개일 때 실제 HTTP PUT을 성공시킨 뒤 그 임시 부모만 HIDDEN으로 바꾼다. 이후 컬렉션은 대상 UUID가 목록에서 제외되고 PUT이 404인지 확인한다. 준비 단계의 HTTP 실패도 전체 실패로 전파한다. 이 숨겨진 행은 처음 빈 공개 목록 검증을 방해하지 않아야 한다.
- 준비용 HTTP 로그인은 fixture 자격 증명으로 수행하고 로그아웃한다. JWT·인증 이력은 기존 정책을 지키며 임시 콘텐츠 정리 목적으로 삭제하지 않는다.
- finally에서 이번 생성 영상 ID와 두 fixture 사용자 ID에 대응하는 저장 행, 임시 영상, 이번 생성 회차·작품을 역순으로 정리한다. 생성 소유권을 기록하지 않은 행은 삭제하지 않는다. 부분 준비·테스트 실패에도 정리하고 정리 실패도 실패로 보고한다.
- 이는 쓰기 API 검증을 위한 임시 fixture다. 읽기 API 검증을 위해 DB를 초기화하거나 시드를 재실행하지 않는다. 기존 저장·entitlement·지갑·콘텐츠는 준비 목적으로 삭제·변경하지 않는다.
- `API_TEST_ENVIRONMENT_FILE` 모드는 기존처럼 자동 DB 준비·정리하지 않는다. 외부 환경에는 새 영상 배열·종류·공개 상태 fixture·만료 토큰 등 필요한 값을 준비하도록 README에 명시한다. 누락 조건을 skip 또는 통과로 처리하지 않는다.

### 단위 테스트

`back/test/unit/playback/savedVideoService.spec.ts`는 HTTP로 재현하기 어려운 내부 실패·환경 경계만 최소한으로 검증한다. DS 조회/쓰기 장애가 원래 오류로 전파되고 인증 오류나 성공으로 치환되지 않는지, 서버 시간대가 UTC가 아니어도 DB Date가 동일 ISO UTC로 직렬화되는지 확인한다. 변경한 환경은 afterEach에서 복원한다. 호출 횟수·SQL 문자열을 그대로 복제하는 테스트를 늘리지 않는다. 종류·페이지·권한 동작은 Postman으로 검증한다.

### 문서 변경

- `_docs/api/04-playback/saved-videos.md`: 두 경로·메서드·필수 Access·body·page·응답 필드·400/401/404 형식·중복·UTC·공개 규칙·구매 불필요·30개 고정·페이지 사이 변경 한계를 예시와 함께 명시한다. 내부 ID·재생 URL은 반환하지 않는다.
- playback README: 소개의 저장 작품을 저장 영상으로 맞추고 새 정의서 링크를 추가한다.
- authentication.md: 필수 Access 사용자 귀속 API에 두 endpoint를 추가한다. 기존 세션 정책은 변경하지 않는다.
- ARCHITECTURE.md: PlaybackModule 책임에 영상 저장·목록을 추가하고 backend verification의 fixture 준비·정리 범위를 실제 runner와 일치시킨다. 관련 없는 frontend 설명은 수정하지 않는다.
- 테스트 README: 31개 HTTP 저장 순서, 기존 저장 없음 전제, 공개 상태 fixture 준비, 외부 환경 변수·준비·정리, 실패 조건을 실제 구현과 맞춘다.
- 공통 API 규칙·스키마는 바꾸지 않으므로 conventions.md·엔티티·마이그레이션은 변경하지 않는다.

### 검증 명령과 실행 전제

```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
```

- 기존 `http://localhost:3000`에 HTTP 요청해 연결과 코드 반영 여부를 확인한다. 포트/프로세스 조회가 빈 결과라는 이유만으로 서버 없음으로 판단하지 않는다.
- 서버가 없으면 검증 실패와 `npm --prefix back run start:dev` 실행 안내를 출력한다. 서버를 자동 실행·종료하거나 다른 포트로 우회하지 않는다. 반영 여부를 확인할 수 없으면 사용자에게 확인한다.
- 전체 test는 단위 테스트 및 실제 MySQL에 연결된 API의 Postman 검증을 모두 포함한다. 서버·DB·필수 데이터·fixture 충돌·준비 HTTP·정리 실패를 통과로 처리하지 않는다.
- 필요한 DB·미디어 서명 설정은 기존 Git-ignored 환경 파일에서 읽는다. 테스트는 미디어 객체를 다운로드하지 않는다.
- 테스트용 제품 endpoint·스키마·의존 패키지·설정 파일은 추가하지 않는다. 기존 read-only 컬렉션 fixture와 검증을 유지한다.

### 완료 조건

- 두 API가 승인된 요청·응답·필수 Access 계약과 일치한다.
- 종류는 클라이언트 값을 사용하고 대상 영상과 일치하는지 검증한다. JWT 사용자 외에는 저장·조회할 수 없다.
- 중복·동시 저장이 한 행과 최초 UTC 시각을 유지하고 미구매 유료 본편 저장이 entitlement·지갑을 변경하지 않는다.
- 현재 공개 조건에 맞는 본인 항목을 DB에서 필터링해 최대 30개 반환한다. hasNext·빈 페이지·동일 시각 정렬이 검증된다.
- 실제 PUT/GET·31개 경계·사용자 위조·토큰 오류·공개 상태의 HTTP 검증이 통과한다.
- 임시 fixture는 기존 데이터 보존·실패 전파·소유 데이터만 정리 원칙을 지킨다. 외부 환경의 새 전제가 문서화된다.
- API·인증·아키텍처·테스트 문서가 구현과 일치하고 필수 세 checks가 모두 통과한다. 범위 밖 변경이 없다.
