# task-1-detail-watch-progress-api

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `back/src/content/publicCatalogService.ts`
- `back/src/playback/entities/userWatchProgress.entity.ts`
- `back/src/common/database/entities.ts`
- `back/test/unit/content/publicCatalogService.spec.ts`
- `back/test/api/README.md`
- `back/test/api/public.postman_collection.json`
- `_docs/api/02-content/dramas.md`
- `_docs/AI_DRAMA_data_model/04-playback/user_watch_progress.md`
- `.agents/skills/nestjs-best-practices/SKILL.md`

## 작업
소유 파일 범위는 아래 다섯 파일이다. 다른 작업자가 함께 작업할 수 있으므로 타인의 변경을 되돌리지 말고 현재 코드에 맞춰 반영한다.
- `back/src/content/publicCatalogService.ts`
- `back/test/unit/content/publicCatalogService.spec.ts`
- `back/test/api/public.postman_collection.json`
- `back/test/api/README.md`
- `_docs/api/02-content/dramas.md`

기존 getDrama의 episodeQuery에 UserWatchProgress 엔티티를 LEFT JOIN한다. userId는 기존 userUuid 조회 결과를 재사용하며 JOIN의 ON에 사용자와 회차 조건을 모두 둔다. WHERE로 시청기록을 필터링하지 않는다. 기존 권한 JOIN, 공개 조건과 episodeNumber 정렬을 보존한다. 엔티티는 공통 레지스트리에 이미 있으므로 새 repository 주입이나 모듈 변경은 필요 없다.

DramaDetail.episodes 항목에 필수 nullable watchProgress를 추가한다. 기록이 있으면 positionMs는 number, isCompleted는 boolean, lastPlayedAt은 ISO 날짜 문자열로 반환한다. RAW 결과의 숫자·boolean 변환을 명시한다. 기록 존재는 JOIN된 PK의 null 여부로 판별한다. positionMs=0, isCompleted=false도 유효한 기록이다. userUuid 생략 또는 해당 사용자의 기록 없음은 null이며 다른 사용자 기록을 노출하지 않는다. userUuid의 기존 400/404 처리는 유지한다.

### 주요 로직 코드 또는 변경 예시
아래 코드를 기존 episodeQuery와 반환 매핑에 연결한다. 기존 select와 매핑 필드는 그대로 유지한다.

```ts
import { UserWatchProgress } from '../playback/entities/userWatchProgress.entity.js';

// 기존 DetailEpisodeRow 교차 타입에 추가할 RAW 필드
type WatchProgressRow = {
  progressEpisodeId: number | null;
  positionMs: number | string | null;
  isCompleted: number | string | null;
  lastPlayedAt: Date | null;
};

// episodeQuery의 기존 권한 JOIN 다음에 연결
episodeQuery
  .leftJoin(UserWatchProgress, 'progress',
    'progress.episodeId = episode.id AND progress.userId = :userId', { userId })
  .addSelect('progress.episodeId', 'progressEpisodeId')
  .addSelect('progress.positionMs', 'positionMs')
  .addSelect('progress.isCompleted', 'isCompleted')
  .addSelect('progress.lastPlayedAt', 'lastPlayedAt');

// getRawMany<DetailEpisodeRow & WatchProgressRow>() 결과의 각 회차 매핑에 추가
const watchProgress = row.progressEpisodeId === null ? null : {
  positionMs: Number(row.positionMs),
  isCompleted: Number(row.isCompleted) === 1,
  lastPlayedAt: row.lastPlayedAt!.toISOString(),
};
```

MySQL 드라이버의 실제 RAW 날짜 반환형을 확인해 그에 맞게 타입과 ISO 변환을 확정한다. 불필요한 예외 경로를 추가하지 않는다. 기존 단위 테스트 RAW fixture에 JOIN 필드(미존재는 null)를 추가해 기존 공개 조건 테스트를 유지한다. HTTP 동작은 Postman으로 검증하고 같은 내용을 mock 단위 테스트로 중복하지 않는다.

API 문서에 필드 표·응답 예시·userUuid 설명·노출 규칙을 갱신한다. 기록 있음/없음, 사용자 생략, 다른 사용자 분리, 기록이 있어도 회차 수·정렬·isUnlocked가 유지됨을 Postman에서 확인한다. non-null 필드는 타입뿐 아니라 SELECT로 확인한 기존 기록의 값과 비교한다. 기존 기록 중 위치 0 또는 미완주가 있으면 해당 사례도 사용한다. UUID나 예상 값을 추측하지 않는다.

API README에 필요한 기존 시청기록 fixture, 환경 변수, SELECT로 확인하는 방법과 데이터 부족 시 실패 조건을 설명한다. 기존 서버와 DB만 사용하고 읽기 검증을 위해 데이터를 생성·수정·초기화하거나 seed를 실행하지 않는다. 테스트 스크립트는 기록 있음 사례를 조용히 건너뛰지 않는다.

검증 명령:
- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`

HTTP로 localhost:3000 연결과 현재 코드 반영 여부를 먼저 확인한다. 서버가 없으면 실패로 보고하고 `npm --prefix back run start:dev`를 안내한다. 자동으로 서버를 띄우지 않는다. 현재 코드 반영 여부가 불확실하면 사용자에게 확인한다.

완료 조건: 기존 상세 동작을 유지하면서 모든 회차에 올바른 nullable watchProgress가 반환되고, 사용자별 데이터 분리가 실제 HTTP로 검증되며 문서·컬렉션이 구현과 일치하고 세 검증 명령이 통과한다. 데이터 또는 서버 부족은 통과로 처리하지 않는다.
