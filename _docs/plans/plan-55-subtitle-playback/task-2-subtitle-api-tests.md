# task-2-subtitle-api-tests

## 기본 입력
- 이 task 문서와 index.json의 task-2 항목.
- 컨텍스트로 전달된 적용 지침과 필요한 선행 task 완료 요약: task-1.
- 다른 작업자가 같은 저장소에서 작업한다. 다른 작업자의 변경을 되돌리지 말고 담당 파일 안에서 선행 변경에 맞춰 작업한다.

## 읽어야 할 파일
- back/test/api/playback.postman_collection.json: 로그인·인증 실패·응답 exactKeys·서명 metadata 검사
- back/test/api/subtitleFixtures.mjs: prepare 반환 환경 키만
- _docs/api/04-playback/episodes.md: 기존 오류 코드

- back/test/unit/api/suiteSelection.spec.ts: 전체 suite 순서·Root/로그인 항목 이름 검사

## 필요 시 참고할 문서
- 적용 지침이 누락/변경된 경우에만 루트 AGENTS.md.
- 구조/파일 책임 판단이 필요한 경우에만 _docs/ARCHITECTURE.md의 Backend 및 Documentation and tooling 섹션.
- 계약 누락/충돌이 발견되면 plan.md의 C1, C5 및 C6만 참조하고 affected task를 보류해 메인에게 보고한다. 승인 계약을 추측/변경하지 않는다.
- 테스트 코드 작성 시 프론트는 해당 RNTL/Jest 스킬의 필요한 버전/경계 문서, 백엔드는 back/README.md 검증의 fixture·lock·실패 판정 부분을 따른다.

## 실패 시 참고할 파일
- 테스트/인프라 작성 task: 담당 테스트·직접 의존 경계에서 먼저 원인을 확인한다. 관련 없는 소스 전체를 읽지 않는다.

## 작업

### 역할과 완료 조건
미구현 기능의 HTTP 테스트 작성. 무료 익명/인증, 유료 구매/익명401/미구매403, ko+en/영어만/없음, 비공개·미래 회차/부모 404, 잘못된 JWT401을 검사한다. 거부 응답에는 URL/subtitles가 없어야 한다. 본편 기존 키와 subtitles, 항목의 정확한 키·형식·언어 정렬·HTTPS 서명 쿼리 X-Amz-Expires=3600을 검사한다. 서명 URL은 다운로드·출력·파일 저장하지 않는다. 스크립트 문법 검사는 즉시, 실제 HTTP는 task-4의 응답 구현 후 유예한다.

정확한 수정 허용 파일:
- `back/test/api/subtitles.postman_collection.json`
- `back/test/unit/api/suiteSelection.spec.ts`

checks (저장소 루트):
- `npm --prefix back run test:unit -- test/unit/api/suiteSelection.spec.ts`
- `node -e "const fs=require('node:fs'),vm=require('node:vm');const c=JSON.parse(fs.readFileSync('back/test/api/subtitles.postman_collection.json','utf8'));const visit=x=>{for(const e of x.event??[])new vm.Script((e.script?.exec??[]).join('\n'));for(const i of x.item??[])visit(i)};visit(c)"`

기존 suiteSelection.spec.ts의 전체 순서 기대값 끝에 subtitles를 추가하고 선택·중복 제거·exclusive lock을 검사한다. 현재 구현된 runner 검사는 즉시 실행한다. collection의 최상위 항목은 기존 공통 검사에 맞춰 'Root', 'Login as entitled fixture user', 'Login as unentitled fixture user'를 포함하고 이름을 중복하지 않는다.

로그인은 pm.sendRequest를 사용하면 응답을 직접 assert하고 완료 콜백 뒤 token을 사용하는 순서를 보장한다. 응답 본문에 token/URL을 출력하는 디버그 문장을 남기지 않는다.

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
```js
const body = pm.response.json();
pm.expect(Object.keys(body).sort()).to.eql(
  ['url','videoUuid','isSaved','title','episodeNumber','durationMs','subtitles'].sort()
);
pm.expect(body.subtitles.map(item => item.languageCode)).to.eql(['en', 'ko']);
body.subtitles.forEach(item => {
  pm.expect(Object.keys(item).sort()).to.eql(['format','languageCode','url']);
  pm.expect(item.format).to.equal(item.languageCode === 'ko' ? 'VTT' : 'SRT');
});
```

