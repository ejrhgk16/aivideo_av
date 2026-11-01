# task-3-saved-video-review-fixes

## 읽어야 할 파일

- `AGENTS.md` (특히 DB 접근 방식)
- `_docs/ARCHITECTURE.md`
- `_docs/plans/plan-42-user-saved-videos-api/plan.md`
- `_docs/plans/plan-42-user-saved-videos-api/index.json`
- `.agents/skills/nestjs-best-practices/SKILL.md`
- `back/src/playback/savedVideoService.ts`
- `back/src/playback/entities/userSavedVideo.entity.ts`
- `back/test/unit/playback/savedVideoService.spec.ts`
- `back/test/api/public.postman_collection.json`
- `back/test/api/run.mjs`
- `back/test/api/README.md`
- `_docs/api/04-playback/saved-videos.md`

변경 경로에 적용되는 추가 하위 AGENTS.md를 확인한다. `web-prototype/`은 대상이 아니다.

## 작업

사용자가 선택한 리뷰 지적 1·2·3을 해결한다. `task-2` 완료 후 실행하며 기존 API 계약과 공개 조건, 최초 저장 시각·종류 보존을 유지한다. 현재 삭제 SQL은 사용자 조건을 포함하므로 지적 2의 수정 대상은 테스트다. 이번 작업은 아래 다섯 파일만 수정한다. 다른 작업자와 사용자의 변경을 되돌리지 말고 현재 코드에 맞추며, 수정은 `apply_patch`로만 수행한다.

### 정확한 파일 범위

- `back/src/playback/savedVideoService.ts`
- `back/test/unit/playback/savedVideoService.spec.ts`
- `back/test/api/public.postman_collection.json`
- `back/test/api/run.mjs`
- `back/test/api/README.md`

### 1. 상대 사용자 저장 전체 페이지 검사

- 현재 entitled fixture 사용자에게 기존 저장이 있는 것은 허용된다. 첫 페이지만 보고 tie 항목의 존재·순서, 상대 저장 보존, 삭제 전후 기준 목록을 판단하지 않는다.
- 저장 시나리오 내부에 작은 전체 조회 함수를 두고 `page=1`부터 `hasNext=false`까지 조회한다. 각 응답의 HTTP 200, 페이지 번호와 응답 형태를 확인하고 실패는 테스트 실패로 전파한다. 페이지 수를 2로 고정하지 않는다.
- 상대 사용자에 대한 tie 검사·사용자 격리·삭제 전후 기준 목록 등 모든 전체 목록 비교에 이 함수를 사용한다. 기존 page 크기·0/30/31 경계 검사는 그대로 유지한다.
- 기준 목록은 최소 `{ videoUuid, contentType, savedAt }`를 보존하고 UUID 기준으로 정렬해 비교한다. 상대의 기존 저장 개수나 UUID를 고정하지 않는다.

주요 흐름 예시는 다음과 같다. 기존 send/url 변수를 재사용하고 Postman JSON에는 실제 줄 단위로 읽기 쉽게 넣는다.

```js
const readAllSaved = async bearer => {
  const items = [];
  let page = 1;
  while (true) {
    const response = await send('GET', url + '?page=' + page, bearer);
    pm.expect(response.code).to.equal(200);
    const body = response.json();
    pm.expect(body.page).to.equal(page);
    pm.expect(body.items).to.be.an('array');
    pm.expect(body.hasNext).to.be.a('boolean');
    items.push(...body.items);
    if (!body.hasNext) return items;
    page += 1;
  }
};
const snapshot = items => items.map(item => ({
  videoUuid: item.videoUuid,
  contentType: item.contentType,
  savedAt: item.savedAt,
})).sort((left, right) => left.videoUuid.localeCompare(right.videoUuid));
```

### 1의 회귀 조건을 실제 데이터로 재현

- 기본 runner는 entitled 사용자에게 이번 실행 소유의 임시 PREVIEW 영상과 저장을 31개 추가한다. 기존 공개 작품을 참조하되 기존 영상은 수정하지 않고 `display_order`는 기존 및 이번 생성 영상 뒤에서 충돌 없이 배정한다.
- 준비 로그인으로 실제 PUT을 수행해 저장한다. 기존 tie pair는 같은 과거 UTC 시각을 유지해 31개 임시 저장보다 뒤로 밀리게 한다. unentitled 사용자에는 이 31개를 저장하지 않아 기존 0/30/31 경계를 유지한다.
- UUID 배열은 임시 환경의 `savedOtherUserBaselineVideoUuids`에 JSON 문자열로 전달한다. 컬렉션은 배열 길이 31, 전체 상대 목록에 해당 UUID가 모두 존재함, tie pair가 첫 페이지 밖에 있음과 전체 페이지에서는 둘 다 같은 시각·ID 내림차순으로 나타남을 확인한다.
- 이는 원래 허용된 기존 저장이 많은 조건을 안전하게 재현하는 임시 fixture다. 상대 사용자의 실제 기존 저장을 삭제·덮어쓰기하거나 상대 목록이 비었다고 요구하지 않는다.
- 생성 성공 즉시 콘텐츠 소유권과 삭제 가능한 정확한 사용자/영상 쌍을 기록한다. 기존 정리 경로에 통합하고 부분 실패에도 이번 실행 데이터만 정리한다. 준비 HTTP·정리 실패는 전체 실패다.
- `API_TEST_ENVIRONMENT_FILE` 모드는 자동 DB 준비/정리를 추가하지 않는다. README에 31개 상대 사용자 저장 fixture와 새 환경 변수, tie가 첫 페이지 밖에 있어야 하는 전제를 기록한다. 외부 환경의 누락 조건도 skip하지 않는다.

### 2. 두 사용자의 저장이 모두 있는 상태에서 삭제 격리 검증

- 기존 `otherPreview`를 두 사용자가 실제 PUT한 후 양쪽 전체 목록에서 존재함을 확인하고 상대 사용자 전체 기준 목록을 캡처한다.
- 상대 사용자 행을 먼저 지우지 않는다. caller JWT로 body/query의 `userUuid`를 상대 UUID로 위조한 DELETE를 먼저 실행한다. 204 및 caller 전체 목록에서 대상이 사라짐, 상대 전체 목록은 기준 목록과 정확히 동일하고 대상이 남음을 확인한다.
- 같은 영상에 caller가 다시 PUT한 뒤 UUID body 위조와 query 위조를 각각 검증할 수 있다. 각각 삭제 직전 두 저장이 존재함을 확인한다. 이미 삭제된 상대 행을 기준으로 격리를 주장하지 않는다.
- caller에게만 없는 상태에서도 caller DELETE가 상대 행에 영향을 주지 않는지 확인한다. 마지막에 상대가 자기 JWT로 DELETE한 뒤 상대 목록이 기존 기준 목록에서 그 UUID만 제외한 상태임을 확인한다.
- 같은 영상에 대한 모든 사용자의 저장을 삭제하는 버그가 있으면 반드시 상대 대상 존재/기준 목록 보존 assertion이 실패해야 한다. 제품 코드에 그런 버그를 넣거나 커밋할 필요는 없다. 순서를 검토해 이 성질을 확인한다.

핵심 호출과 비교 흐름 예시다. caller는 `token`, 상대는 `otherToken`이다.

```js
pm.expect((await readAllSaved(token)).some(item => item.videoUuid === otherPreview)).to.equal(true);
const counterpartBefore = snapshot(await readAllSaved(otherToken));
pm.expect(counterpartBefore.some(item => item.videoUuid === otherPreview)).to.equal(true);
const removed = await send(
  'DELETE',
  url + '/' + otherPreview + '?userUuid=' + encodeURIComponent(pm.collectionVariables.get('entitledUserUuid')),
  token,
  { userUuid: pm.collectionVariables.get('entitledUserUuid') },
);
pm.expect(removed.code).to.equal(204);
pm.expect((await readAllSaved(token)).some(item => item.videoUuid === otherPreview)).to.equal(false);
pm.expect(snapshot(await readAllSaved(otherToken))).to.eql(counterpartBefore);
```

### 3. 저장 upsert를 QueryBuilder로 전환

- `SavedVideoService.save()`의 raw INSERT만 TypeORM InsertQueryBuilder로 전환한다. 공개 영상·사용자 조회는 유지한다.
- 신규 `savedAt`은 `() => 'UTC_TIMESTAMP(3)'`으로 지정한다. 충돌 시 복합 PK 일부인 `video_id`만 같은 입력값으로 갱신해 최초 `savedAt`·`contentType`을 보존한다. 사전 존재 검사 후 INSERT나 삭제 후 재생성은 하지 않는다.
- `orIgnore()`로 DB 제약/입력 오류까지 숨기지 않는다. 지원되는 `orUpdate`로 PK 충돌을 처리하고 원래 DB 오류는 전파한다.
- 아래 코드를 현재 설치된 TypeORM API·메타데이터와 대조한다. `orUpdate` 컬럼명은 실제 DB 컬럼명을 사용한다. 새 패키지·스키마·엔티티 변경은 없다.

```ts
await this.dataSource.createQueryBuilder()
  .insert()
  .into(UserSavedVideo)
  .values({
    userId: row.userId,
    videoId: row.videoId,
    contentType,
    savedAt: () => 'UTC_TIMESTAMP(3)',
  })
  .orUpdate(['video_id'])
  .execute();
```

- 저장 오류 단위 테스트는 INSERT builder의 `execute()`가 원래 DB 오류를 거부하도록 수정한다. 읽기/쓰기/삭제 장애 전파와 UTC 직렬화 검증을 유지하고 SQL·호출 횟수만 복제하는 테스트는 추가하지 않는다.
- 기존 Postman의 반복·동시 PUT 이후 한 항목, 최초 UTC 저장 시각·종류 유지 검증을 유지한다. 신규 저장·중복 저장이 실제 MySQL에서 모두 통과해야 한다.
- 이번 요청은 리뷰 세 항목으로 한정한다. 삭제 SQL 변경, 다른 서비스의 raw SQL 정비, API 계약·프론트·DB 스키마 변경은 포함하지 않는다.

### 문서와 기존 검증 유지

- README에 전체 페이지 검사·상대 기준 목록 보존·동시 소유 삭제 격리 순서·추가 31개 fixture와 외부 환경 전제를 실제 구현과 맞게 갱신한다.
- API 메서드·경로·인증·입출력·공개 정책과 파일 책임은 바뀌지 않으므로 API 정의서와 ARCHITECTURE는 수정하지 않는다.
- 기존 인증·권한·공개 경계·0/30/31 페이지·동일 시각 정렬·비공개 저장 해제 DB 확인·지갑/entitlement 불변·정리 검증을 제거하거나 약화하지 않는다.

### 검증 명령과 실행 전제

```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
```

- 현재 변경 코드가 반영된 기존 `http://localhost:3000` 및 실제 개발 MySQL을 사용한다. API 검증 전에 HTTP 연결과 코드 반영을 확인한다.
- 서버가 없으면 검증 실패와 `npm --prefix back run start:dev` 안내를 출력한다. 서버를 자동 실행·종료하거나 다른 포트로 우회하지 않는다. 반영 여부를 확인할 수 없으면 사용자에게 확인한다.
- 전체 test는 단위 및 Postman 실제 HTTP를 포함한다. 데이터 부족·연결/준비/정리 실패를 통과로 처리하지 않는다. 비밀 값과 토큰은 임시 환경에서만 취급하고 로그·컬렉션에 저장하지 않는다.

### 완료 조건

- 31개 상대 사용자 저장 때문에 tie pair가 첫 페이지 밖에 있어도 전체 조회 및 삭제 기준 목록 검증이 통과한다. 상대의 실제 기존 데이터는 유지된다.
- 두 소유자의 저장이 실제로 남은 상태에서 caller가 삭제하고 상대 행·전체 기준 목록이 보존됨을 검증한다. 상대를 먼저 삭제하는 순서상의 허점이 없다.
- 저장 upsert는 QueryBuilder를 사용하고 신규 UTC 시각·원자적 중복 처리·최초 메타데이터 보존·DB 장애 전파를 유지한다.
- README와 fixture 준비/정리가 일치하고 필수 세 checks가 모두 통과한다. 범위 밖 변경이 없다.
