# task-3-playback-contract-tests

## 기본 입력
- 이 task 문서와 index.json의 task-3 항목.
- 컨텍스트로 전달된 적용 지침과 필요한 선행 task 완료 요약: 없음.
- 다른 작업자가 같은 저장소에서 작업한다. 다른 작업자의 변경을 되돌리지 말고 담당 파일 안에서 선행 변경에 맞춰 작업한다.

## 읽어야 할 파일
- back/test/api/content.postman_collection.json: checkResponseRoot의 본편 재생 exactKeys 분기와 관련 부정 검사만
- back/test/api/economy.postman_collection.json: checkResponseRoot의 본편 재생 exactKeys 분기와 관련 부정 검사만
- back/test/api/http.postman_collection.json: checkResponseRoot의 본편 재생 exactKeys 분기와 관련 부정 검사만
- back/test/api/identity.postman_collection.json: checkResponseRoot의 본편 재생 exactKeys 분기와 관련 부정 검사만
- back/test/api/playback.postman_collection.json: checkResponseRoot의 본편 재생 exactKeys 분기와 관련 부정 검사만
- back/test/api/programming.postman_collection.json: checkResponseRoot의 본편 재생 exactKeys 분기와 관련 부정 검사만
- back/test/api/saved-videos.postman_collection.json: checkResponseRoot의 본편 재생 exactKeys 분기와 관련 부정 검사만
- back/test/api/watch-progress.postman_collection.json: checkResponseRoot의 본편 재생 exactKeys 분기와 관련 부정 검사만

## 필요 시 참고할 문서
- 적용 지침이 누락/변경된 경우에만 루트 AGENTS.md.
- 구조/파일 책임 판단이 필요한 경우에만 _docs/ARCHITECTURE.md의 Backend 및 Documentation and tooling 섹션.
- 계약 누락/충돌이 발견되면 plan.md의 C1 및 C6만 참조하고 affected task를 보류해 메인에게 보고한다. 승인 계약을 추측/변경하지 않는다.
- 테스트 코드 작성 시 프론트는 해당 RNTL/Jest 스킬의 필요한 버전/경계 문서, 백엔드는 back/README.md 검증의 fixture·lock·실패 판정 부분을 따른다.

## 실패 시 참고할 파일
- 테스트/인프라 작성 task: 담당 테스트·직접 의존 경계에서 먼저 원인을 확인한다. 관련 없는 소스 전체를 읽지 않는다.

## 작업

### 역할과 완료 조건
미구현 응답 필드에 대한 기존 테스트 적응. 8개 컬렉션의 같은 본편 응답 검사에 subtitles 필수 키와 각 항목 languageCode/format/url 검사만 추가한다. 프리뷰는 기존 exactKeys를 유지한다. key 누락/추가를 허용하거나 기존 assertion을 약화하지 않는다. JSON/스크립트 문법은 즉시 검사하고 HTTP는 task-4의 새 응답 구현 후 실행한다.

정확한 수정 허용 파일:
- `back/test/api/content.postman_collection.json`
- `back/test/api/economy.postman_collection.json`
- `back/test/api/http.postman_collection.json`
- `back/test/api/identity.postman_collection.json`
- `back/test/api/playback.postman_collection.json`
- `back/test/api/programming.postman_collection.json`
- `back/test/api/saved-videos.postman_collection.json`
- `back/test/api/watch-progress.postman_collection.json`

checks (저장소 루트):
- `node -e "const fs=require('node:fs'),vm=require('node:vm');for(const n of ['content','economy','http','identity','playback','programming','saved-videos','watch-progress']){const c=JSON.parse(fs.readFileSync('back/test/api/'+n+'.postman_collection.json','utf8'));const visit=x=>{for(const e of x.event??[])new vm.Script((e.script?.exec??[]).join('\n'));for(const i of x.item??[])visit(i)};visit(c)}"`

동일 패턴 반복이며 새 helper/export/공유 collection 파일을 만들지 않는다.

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

### 반복 작업 위임
불가. 메인 외 최대 worker 3명, 자식 예약 0명. 확정 패턴 반복 파일도 이 worker가 직접 처리하고 통합 검증한다.

### 주요 로직 코드 또는 변경 예시
아래는 승인된 경계와 핵심 흐름을 나타내는 예시다. 담당 구현은 모든 완료 조건을 충족하도록 완성한다.
```js
// 본편 branch의 exactKeys
exactKeys(value, ['url','videoUuid','isSaved','title','episodeNumber','durationMs','subtitles']);
pm.expect(value.subtitles).to.be.an('array');
value.subtitles.forEach(item => {
  exactKeys(item, ['languageCode','format','url']);
  pm.expect(item.languageCode).to.be.a('string').and.not.empty;
  pm.expect(item.format).to.be.oneOf(['VTT','SRT']);
  pm.expect(item.url).to.match(/^https:\/\//);
});
```

