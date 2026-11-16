# task-1-subtitle-api-fixtures

## 기본 입력
- 이 task 문서와 index.json의 task-1 항목.
- 컨텍스트로 전달된 적용 지침과 필요한 선행 task 완료 요약: 없음.
- 다른 작업자가 같은 저장소에서 작업한다. 다른 작업자의 변경을 되돌리지 말고 담당 파일 안에서 선행 변경에 맞춰 작업한다.

## 읽어야 할 파일
- back/test/api/run.mjs: 사용자 생성 직후 suite 전용 분기·환경 파일·finally 정리
- back/test/api/fixtureContext.mjs: createUser/grantEpisode/cleanup 반환 계약
- back/test/api/dramaPaginationFixtures.mjs: 실행 UUID 소유권·부분 실패 정리 패턴
- back/test/api/suites.mjs: 목록과 선택 검증
- back/src/content/entities/{drama,episode,contentVideo,episodeSubtitle}.entity.ts: 삽입 필수 필드
- back/package.json 및 lockfile: Vitest 설치 버전

## 필요 시 참고할 문서
- 적용 지침이 누락/변경된 경우에만 루트 AGENTS.md.
- 구조/파일 책임 판단이 필요한 경우에만 _docs/ARCHITECTURE.md의 Backend 및 Documentation and tooling 섹션.
- 계약 누락/충돌이 발견되면 plan.md의 C5 및 C6만 참조하고 affected task를 보류해 메인에게 보고한다. 승인 계약을 추측/변경하지 않는다.
- 테스트 코드 작성 시 프론트는 해당 RNTL/Jest 스킬의 필요한 버전/경계 문서, 백엔드는 back/README.md 검증의 fixture·lock·실패 판정 부분을 따른다.

## 실패 시 참고할 파일
- 테스트/인프라 작성 task: 담당 테스트·직접 의존 경계에서 먼저 원인을 확인한다. 관련 없는 소스 전체를 읽지 않는다.

## 작업

### 역할과 완료 조건
미구현 기능의 테스트 인프라 작성. C5 prepare/cleanup을 구현하고 전용 suite 분기를 연결한다. 독립 fake DB 단위 검사는 현재 제품 코드로 실행 가능하므로 즉시 통과해야 한다. 선택 HTTP subtitles와 무인자 test:api는 C1 구현 및 T2 collection이 필요하므로 task-4로 유예한다. 이 유예는 runner 전체 실행 검증까지 포함한다.

정확한 수정 허용 파일:
- `back/test/api/subtitleFixtures.mjs`
- `back/test/api/run.mjs`
- `back/test/api/suites.mjs`
- `back/test/unit/api/subtitleFixtures.spec.ts`

checks (저장소 루트):
- `node --check back/test/api/subtitleFixtures.mjs`
- `node --check back/test/api/run.mjs`
- `node --check back/test/api/suites.mjs`
- `npm --prefix back run test:unit -- test/unit/api/subtitleFixtures.spec.ts`

finally 예제의 순서대로 정리를 보장하되 첫 cleanup이 실패해도 두 번째를 실행하는 기존 오류 수집 패턴을 사용한다. fixture 단위 검사는 db.execute/query만 대체하고 준비 도중 insert 실패·정리 재호출·타인 UUID 보존을 확인한다. SQL fixture는 기존 테스트 패턴을 따르고 제품 쿼리는 작성하지 않는다.

완료 전 imports/실제 export·fixture·mock 전제조건·비동기 이벤트 순서·assertion을 적용 계약 및 설치 도구와 대조한다. 테스트 작성 task는 계약 ID별 검증 파일/테스트 이름과 즉시 실행 결과·유예 대상 소스 task를 보고한다. 소스 task는 선언 checks 전체 통과와 계약별 동작/기존 소비 회귀 결과를 보고한다. 검증만을 위해 테스트 파일 전체를 미리 읽을 필요는 없다. 범위 밖 테스트 결함은 메인에게 근거와 함께 보고하며 assertion을 약화하지 않는다. 실패·미실행은 통과가 아니다. 제품 코드 변경 task가 아니면 제품 코드를 수정하지 않는다.

### 적용 계약
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
const fixture = createSubtitleFixtures({ db, runId: fixtureContext.runId });
try {
  const values = await fixture.prepare({ fixtureContext, entitled, unentitled });
  const environmentValues = {
    baseUrl, ...values,
    entitledLoginId: entitled.loginId, entitledPassword: entitled.password,
    unentitledLoginId: unentitled.loginId, unentitledPassword: unentitled.password,
  };
  // runner의 기존 임시 환경 파일 생성/실행 경로에 environmentValues를 전달한다.
} finally {
  await fixtureContext.cleanup();
  await fixture.cleanup();
}

```

