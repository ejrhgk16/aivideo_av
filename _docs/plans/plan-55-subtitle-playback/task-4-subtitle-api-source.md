# task-4-subtitle-api-source

## 기본 입력
- 이 task 문서와 index.json의 task-4 항목.
- 컨텍스트로 전달된 적용 지침과 필요한 선행 task 완료 요약: task-1, task-2, task-3.
- 다른 작업자가 같은 저장소에서 작업한다. 다른 작업자의 변경을 되돌리지 말고 담당 파일 안에서 선행 변경에 맞춰 작업한다.

## 읽어야 할 파일
- back/src/content/publicCatalogService.ts: getEpisodeVideo/getEpisodePlaybackUrl, episodeRepository·S3 서비스 사용
- back/src/content/contentResponses.ts: EpisodePlaybackResponse
- back/src/content/entities/episodeSubtitle.entity.ts: 숫자 FK·format·언어
- back/src/content/s3VideoUrlService.ts: 기존 서명 함수만
- _docs/api/04-playback/episodes.md: 응답 및 인증
- back/README.md: 미디어 정책·suite·fixture/외부 환경 표

## 필요 시 참고할 문서
- 적용 지침이 누락/변경된 경우에만 루트 AGENTS.md.
- 구조/파일 책임 판단이 필요한 경우에만 _docs/ARCHITECTURE.md의 Backend 및 Documentation and tooling 섹션.
- 계약 누락/충돌이 발견되면 plan.md의 C1, C5 및 C6만 참조하고 affected task를 보류해 메인에게 보고한다. 승인 계약을 추측/변경하지 않는다.
- 테스트 코드 작성 시 프론트는 해당 RNTL/Jest 스킬의 필요한 버전/경계 문서, 백엔드는 back/README.md 검증의 fixture·lock·실패 판정 부분을 따른다.

## 실패 시 참고할 파일
- back/test/api/subtitles.postman_collection.json, subtitleFixtures.mjs 및 실패한 기존 collection의 해당 assertion. run.mjs의 준비/정리 분기는 인프라 실패일 때만.

## 작업

### 역할과 완료 조건
소스 구현·검증. C1 응답과 조회를 구현하고 문서를 맞춘다. 새로운 endpoint/DB migration/운영 서명 정책 변경은 없다. back README에는 subtitles suite·필수 환경 키·lock·객체 다운로드를 하지 않는다는 검증 범위를 추가한다. 수정 중 선택 HTTP로 확인하고 최종 변경에서 전체 test:api를 한 번 실행한다. 전체 검사는 T1 runner의 선택/무인자 경로와 T3 8개 소비 검사 영향 때문에 필요하다. 서버 코드 반영을 확인하고 미실행·실패를 통과로 처리하지 않는다.

정확한 수정 허용 파일:
- `back/src/content/publicCatalogService.ts`
- `back/src/content/contentResponses.ts`
- `_docs/api/04-playback/episodes.md`
- `back/README.md`

checks (저장소 루트):
- `npm --prefix back run lint`
- `npm --prefix back run build`
- `npm --prefix back run test:api -- --suite subtitles --suite playback`
- `npm --prefix back run test:api`

실패 시에만 task-2/3 collection과 task-1 fixture/runner를 읽어 원인을 구분한다. 테스트 수정 권한은 없으며 결함은 메인에게 보고한다.

완료 전 imports/실제 export·fixture·mock 전제조건·비동기 이벤트 순서·assertion을 적용 계약 및 설치 도구와 대조한다. 테스트 작성 task는 계약 ID별 검증 파일/테스트 이름과 즉시 실행 결과·유예 대상 소스 task를 보고한다. 소스 task는 선언 checks 전체 통과와 계약별 동작/기존 소비 회귀 결과를 보고한다. 검증만을 위해 테스트 파일 전체를 미리 읽을 필요는 없다. 범위 밖 테스트 결함은 메인에게 근거와 함께 보고하며 assertion을 약화하지 않는다. 실패·미실행은 통과가 아니다. 제품 코드 변경 task가 아니면 제품 코드를 수정하지 않는다.

### 적용 계약
### C1: 다국어 본편 재생 응답
정의 담당 task-4: `back/src/content/contentResponses.ts` named export. 프론트 대응 정의 담당 task-8: `front/src/features/playback/playbackResponses.ts` named export. 소비: PublicCatalogService.getEpisodePlaybackUrl, PlaybackScreenEpisode, task-2/3/7/9 테스트.
```ts
export type PlaybackSubtitle = {
  languageCode: string;
  format: 'VTT' | 'SRT';
  url: string;
};
// back EpisodePlaybackResponse의 기존 필드는 유지:
subtitles: PlaybackSubtitle[];
// front EpisodePlayback의 기존 필드는 유지:
subtitles?: PlaybackSubtitle[];
```
GET /episodes/:episodeId/playback은 회차에 등록된 모든 언어 자막을 languageCode ASC로 반환한다. 자막 없음은 []; 프론트는 이전 서버의 필드 누락도 []로 처리한다. languageCode는 DB BCP-47 값을 그대로 사용한다. 각 항목의 키는 languageCode/format/url만 허용한다. UUID·내부 숫자 ID·storageKey는 노출하지 않는다. 프리뷰 응답은 변경하지 않는다.
기존 getEpisodeVideo의 공개 작품·회차·영상 및 무료/유료 권한 검사를 먼저 완료한다. 이후 EpisodeSubtitle과 Episode의 숫자 관계를 TypeORM QueryBuilder로 조회한다. 기존 episodeRepository의 QueryBuilder에서 EpisodeSubtitle을 조인해 추가 repository 주입 없이 구현할 수 있다. 자막 서명은 기존 S3VideoUrlService.createSignedGetUrl(storageKey)를 그대로 사용한다. 개발 환경 한정·3600초 만료를 유지한다. 권한 거부에는 자막 URL도 없다. S3 객체 존재 확인/다운로드는 API에서 추가하지 않는다.
검증: task-2의 언어/형식/없음/인증/공개 조건과 task-3 기존 exact-key 소비 검사, task-4 선택 및 전체 HTTP 실행.

### C5: API fixture·수명과 Postman 환경
task-1 소유 `back/test/api/subtitleFixtures.mjs` named export. task-1 run.mjs가 호출하고 task-2 collection이 반환 환경을 소비한다.
```ts
// .mjs named export의 계약 표기. DB/fixtureContext는 기존 runner 객체다.
createSubtitleFixtures({ db, runId }): {
  prepare({ fixtureContext, entitled, unentitled }): Promise<Record<string, string>>;
  cleanup(): Promise<void>;
}
```
prepare는 아래 string 값의 평면 환경 객체를 반환한다:
subtitleFreeEpisodeUuid, subtitlePaidEpisodeUuid, subtitleEmptyEpisodeUuid,
subtitleEnglishOnlyEpisodeUuid, subtitleHiddenEpisodeUuid, subtitleFutureEpisodeUuid,
subtitleHiddenDramaEpisodeUuid, subtitleFutureDramaEpisodeUuid.
무료/유료 회차 모두 en(SRT)와 ko(VTT)를 갖고 응답 순서는 en,ko. EnglishOnly는 en만, Empty는 자막 행 없음. hidden/future 네 경우에도 자막·FULL을 만들어 실제 공개 검증에 도달하게 한다. 무료/유료 모두 EPISODE/FULL과 정상 공개 부모를 갖는다. 유료 회차는 entitled만 권한을 갖는다.
기존 fixtureContext.createUser/grantEpisode와 기존 entitled/unentitled 사용자·로그인 환경 키를 재사용한다. 기존 공개 작품의 제작사 ID만 읽어 실행 UUID의 부모 작품/회차/영상/자막을 만든다. 신규 자막/영상 객체는 다운로드하지 않으므로 실제 S3 업로드가 필요 없다. UUID를 쓰기 전에 기록한다. cleanup은 부분 준비 실패에도 소유 행만 제거하고 멱등·잔여 행 검증을 제공한다. 권한/사용자 종속 정리 후 자막/영상/회차/작품을 정리하도록 runner finally 순서를 맞춘다. 기존 fixture 정리는 보존한다.
새 suite id='subtitles', collection='subtitles.postman_collection.json', contentMode='exclusive'; 기존 suite 순서 뒤에 추가한다. run.mjs의 사용자 생성 후 전용 분기를 넣어 기존 복잡한 saved-video 준비로 진입하지 않게 한다. 실패·cleanup·lock·timeout은 기존 실패 정책을 유지한다. 외부 환경 모드는 DB 준비를 하지 않고 위 키와 기존 로그인 키를 사용한다.
독립 fixture 검사는 Vitest 4.1.11에서 fake DB 경계로 준비/소유 기록/부분 실패 정리/타인 행 보존을 확인한다. HTTP는 task-4 구현 후에만 실행한다.

### 반복 작업 위임
불가. 메인 외 최대 worker 3명, 자식 예약 0명. 독립적인 fixture/계약/상태 로직으로 단순 반복 위임 대상이 아니다.

### 주요 로직 코드 또는 변경 예시
아래는 승인된 경계와 핵심 흐름을 나타내는 예시다. 담당 구현은 모든 완료 조건을 충족하도록 완성한다.
```tsx
const video = await this.getEpisodeVideo(episodeId, userUuid, now);
const rows = await this.episodeRepository.createQueryBuilder('episode')
  .innerJoin(EpisodeSubtitle, 'subtitle', 'subtitle.episodeId = episode.id')
  .select('subtitle.languageCode', 'languageCode')
  .addSelect('subtitle.format', 'format')
  .addSelect('subtitle.storageKey', 'storageKey')
  .where('episode.uuid = :episodeId', { episodeId })
  .orderBy('subtitle.languageCode', 'ASC')
  .getRawMany<{ languageCode: string; format: 'VTT' | 'SRT'; storageKey: string }>();
const subtitles = await Promise.all(rows.map(async row => ({
  languageCode: row.languageCode, format: row.format,
  url: await this.s3VideoUrlService.createSignedGetUrl(row.storageKey),
})));
const url = await this.s3VideoUrlService.createSignedGetUrl(video.storageKey);
return { url, videoUuid: video.videoUuid, isSaved: Number(video.isSaved) === 1,
  title: video.title, episodeNumber: video.episodeNumber, durationMs: video.durationMs, subtitles };
```

