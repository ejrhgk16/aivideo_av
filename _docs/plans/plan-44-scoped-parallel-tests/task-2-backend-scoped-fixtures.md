# task-2-backend-scoped-fixtures

## 읽어야 할 파일

- AGENTS.md
- _docs/ARCHITECTURE.md
- _docs/plans/plan-44-scoped-parallel-tests/index.json
- _docs/plans/plan-45-saved-video-review-fixes/index.json
- back/package.json
- back/vitest.config.ts
- back/test/api/run.mjs
- back/test/api/public.postman_collection.json
- back/test/api/README.md
- back/src/identity/entities/user.entity.ts
- back/src/identity/entities/authSession.entity.ts
- back/src/identity/entities/refreshToken.entity.ts
- back/src/economy/entities/wallet.entity.ts
- back/src/economy/entities/pointTransaction.entity.ts
- back/src/economy/entities/episodeEntitlement.entity.ts
- back/src/playback/entities/userWatchProgress.entity.ts
- back/src/playback/entities/userSavedVideo.entity.ts
- back/src/content/entities/ 및 back/src/programming/entities/의 관련 엔티티
- back/src/common/database/migrations/의 현재 관련 테이블 정의

## 작업

기능별 API suite 선택, 실행별 준비·검증·정리, 공용 콘텐츠 잠금을 구현하고 기존 시나리오를 보존해 컬렉션을 이관한다. task-1과 파일·데이터 영역이 겹치지 않아 병렬 실행할 수 있다. 한 worker가 백엔드 테스트 실행기 전체를 소유한다. plan-45의 충돌 작업 완료 후 최신 내용을 읽고 그 수정도 보존한다. 다른 작업자의 변경을 되돌리지 않고 아래 파일만 apply_patch로 수정한다.

### 변경 허용 파일

~~~text
back/package.json
back/test/api/run.mjs
back/test/api/suites.mjs
back/test/api/fixtureContext.mjs
back/test/api/contentLock.mjs
back/test/api/verifyParallel.mjs
back/test/api/public.postman_collection.json
back/test/api/http.postman_collection.json
back/test/api/identity.postman_collection.json
back/test/api/content.postman_collection.json
back/test/api/programming.postman_collection.json
back/test/api/playback.postman_collection.json
back/test/api/economy.postman_collection.json
back/test/api/watch-progress.postman_collection.json
back/test/api/saved-videos.postman_collection.json
back/test/unit/api/suiteSelection.spec.ts
back/test/unit/api/fixtureIsolation.spec.ts
back/test/unit/api/contentLock.spec.ts
back/test/api/README.md
_docs/ARCHITECTURE.md
~~~

### 기능 선택과 실행 계약

- npm --prefix back run test:api -- --suite saved-videos 는 해당 기능의 검증과 필요한 준비·정리만 실행한다. 로그인·카탈로그 조회 같은 필수 준비는 허용하지만 다른 기능의 전체 검증을 선행시키지 않는다.
- --suite 반복으로 여러 기능을 선택하고 중복은 한 번 실행한다. 인자 없으면 아래 여덟 suite를 정해진 순서로 모두 순차 실행한다. 환경변수의 선택값이 전체 기본 실행을 축소하지 않게 한다.
- 알 수 없는 suite, 값 없는 --suite, 빈 선택은 HTTP·DB 변경 전에 실패한다. 기본 모드의 임의 Postman 옵션은 기존처럼 거부한다. API_TEST_ENVIRONMENT_FILE 모드의 기존 환경·CLI 전달은 보존하되 suite 선택을 따로 처리한다.
- Windows Postman JS 진입점 실행, 인자 배열 기반 spawn, 임시 환경의 비밀값 전달, timeout·실패 exit code 전파를 유지한다. 컬렉션·환경은 실행별 임시 디렉터리에 두고 정리한다. 비밀번호·JWT·환경 파일 본문을 출력하지 않는다.
- helper import로 실제 main이 실행되지 않게 진입점을 구분한다. 선택·fixture·잠금의 내부 테스트에 필요한 함수만 지정 helper에서 export한다.

| suite | 핵심 검증 | 콘텐츠 잠금 |
| --- | --- | --- |
| http | Root, CORS·preflight | shared |
| identity | native/web 로그인·갱신·logout, 재사용·동시 갱신 | shared |
| content | 장르·작품 목록·상세·권한·진행 기록 조회 | shared |
| programming | 네 홈 컬렉션·순서·카탈로그 일치 | shared |
| playback | 본편·프리뷰 URL·소유·구매 권한·익명 접근 | shared |
| economy | 포인트·실제 구매·반복·오류 | shared |
| watch-progress | 실제 PUT·완료 유지·UTC 시각 | shared |
| saved-videos | 저장·삭제·페이지·타 사용자·조회별 저장 플래그·공개 상태 경계 | exclusive |

### 컬렉션 이관

- 기존 컬렉션의 최상위 요청과 pm.sendRequest 내부 시나리오를 읽고 README에 기존 시나리오 → 새 suite 이관표를 기록한다. 공통 HTTP 계약 assertion도 보존한다. 요청 수만으로 동등성을 판정하지 않는다.
- 여덟 컬렉션이 검증 정의의 단일 원본이다. run.mjs가 선택한 컬렉션만 실행하며 이관 후 public.postman_collection.json을 삭제한다. 과거 completed plan의 파일 목록은 바꾸지 않는다.
- 다른 suite의 collectionVariables에 의존하지 않는다. 장르·카탈로그·회차·로그인 bootstrap을 해당 실행 안에서 준비하고 외부 환경과 실행 중 생성 변수의 우선순위를 명시한다. 기존 고정 UUID 기본값이 실행별 UUID를 가리지 않게 한다.
- 공통 assertion은 suites.mjs에서 임시 실행 컬렉션에 주입하는 작은 함수로 공유할 수 있다. 별도 플러그인·범용 템플릿 계층·중복된 전체 컬렉션을 만들지 않는다.
- 시나리오 보존 대상은 JWT·위조 query 무시, 구매·미구매 권한, Refresh 이력·재사용 폐기·동시 회전, web 쿠키·CSRF·익명 204, 포인트 중복 방지·잔액 부족, UTC·시청 완료 유지, 저장 0/30/31·동일 시각 순서·숨겨진 영상 삭제·타 사용자 보존을 포함한다.
- plan-45가 수정한 저장 상태 시나리오의 실제 episode 선택·cleanup 보장도 이관한다. 기존 검증을 약화해 테스트를 독립 실행시키지 않는다.

### 실행별 fixture

- fixtureContext는 실행마다 randomUUID runId와 사용자 UUID·로그인·비밀번호·중복 방지 키를 생성한다. 기존 admin/고정 unentitled 사용자의 상태를 수정하지 않는다. identity 테스트도 실행별 사용자를 쓴다.
- 사용자별 상태는 새 사용자에만 생성한다. suite별로 필요한 최소 사용자·wallet·권한·진행 기록을 준비한다. economy는 충분한 잔액·0 잔액 사용자와 별도 구매 대상, content/playback은 소유·미소유 회차를 구분한다. 읽기 entitlement와 실제 구매 대상은 겹치지 않게 한다.
- 공용 작품·회차·컬렉션은 기존 개발 데이터를 조회해 선택한다. 없으면 실패한다. API가 쓰는 DB와 fixture 연결의 일치를 생성 사용자 로그인 UUID와 조회 결과로 확인한다. reset·seed·공용 값 수정으로 통과시키지 않는다.
- saved-videos의 공개 상태·영상 수 경계는 이번 실행이 만든 콘텐츠와 필요한 연결만 사용한다. 기존 작품의 가격·공개 상태는 바꾸지 않는다. 임시 공개 콘텐츠가 전체 카탈로그에 보이는 동안 exclusive 잠금으로 다른 runner의 카탈로그 검증을 막는다.
- 생성 전 할당 UUID와 생성 결과 ID를 소유 목록에 기록해 부분 준비 실패도 정리한다. prefix/LIKE로 다른 실행 데이터를 삭제하지 않는다. 사용자 상태는 소유 user ID, 콘텐츠는 기록한 UUID/ID의 정확한 키로 삭제한다.
- 실제 FK를 확인해 정리한다. 권한·저장·시청·Refresh → 인증 세션·포인트 원장 → wallet·user, 그리고 전용 편성 연결·영상·회차·작품의 의존 순서를 지킨다. 테스트 사용자 인증 이력도 시나리오 검증 전에는 지우지 않는다.
- 실제 API 삭제가 성공했는지와 저장으로 wallet·권한이 바뀌지 않았는지 먼저 검증한다. cleanup이 assertion 실패를 숨기면 안 된다. 검증·cleanup 모두 실패하면 두 원인을 보고하며 DB 연결·임시 파일·잠금은 finally에서 정리한다.
- API_TEST_ENVIRONMENT_FILE은 자동 생성·정리하지 않는 계약을 유지한다. 외부 fixture의 실행별 격리를 가정하지 않고 실제 해석한 baseUrl에 exclusive 잠금을 적용한다. 환경·CLI baseUrl override도 잠금 대상과 같아야 한다.
- http처럼 DB fixture가 필요 없는 suite에 사용자·저장 영상 fixture나 S3 자격 증명까지 요구하지 않는다. 해당 suite가 필요한 준비만 검증한다.

### 주요 로직 코드 또는 변경 예시

선택은 fixture 생성보다 먼저 수행한다. 아래 helper 연결과 상태 흐름을 기준으로 구현하되 필요한 함수는 지정 파일 안에서 완결한다.

~~~js
// suites.mjs
const ids = ['http', 'identity', 'content', 'programming', 'playback',
  'economy', 'watch-progress', 'saved-videos'];
export const suites = ids.map(id => ({
  id,
  collection: new URL('./' + id + '.postman_collection.json', import.meta.url),
  contentMode: id === 'saved-videos' ? 'exclusive' : 'shared',
}));

export function selectSuites(args) {
  if (args.length === 0) return suites;
  const selected = new Set();
  for (let index = 0; index < args.length; index += 2) {
    if (args[index] !== '--suite' || !ids.includes(args[index + 1])) {
      throw new Error('Expected --suite followed by a known API suite');
    }
    selected.add(args[index + 1]);
  }
  return suites.filter(suite => selected.has(suite.id));
}

// run.mjs: managed mode, readiness and selected-suite environment checks precede this.
async function runManagedSuite(suite, baseUrl) {
  const release = await acquireContentLock(baseUrl, suite.contentMode);
  let context;
  let failure;
  try {
    context = createFixtureContext({ suite: suite.id, baseUrl });
    await context.prepare();
    process.send?.({ phase: 'ready', suite: suite.id, runId: context.runId,
      userUuids: context.userUuids, at: Date.now() });
    if (process.send) await waitForCoordinator('start');
    const exitCode = await runPostman(suite.collection, context.environmentFile);
    if (exitCode !== 0) throw new Error('Postman failed for suite ' + suite.id);
    await context.verify();
    process.send?.({ phase: 'verified', suite: suite.id, runId: context.runId,
      progressPairs: context.progressPairs, at: Date.now() });
    if (process.send) await waitForCoordinator('cleanup');
  } catch (error) {
    failure = error;
  } finally {
    try {
      await context?.cleanup();
    } catch (error) {
      failure = failure ? new AggregateError([failure, error], 'API and cleanup failed') : error;
    } finally {
      try {
        await release();
      } catch (error) {
        failure = failure ? new AggregateError([failure, error], 'API and unlock failed') : error;
      }
    }
    process.send?.({ phase: 'cleaned', suite: suite.id, runId: context?.runId });
  }
  if (failure) throw failure;
}
~~~

IPC의 start/cleanup 대기는 verifyParallel이 fork한 자식의 내부 조율 전용이다. 일반 CLI 실행은 기다리지 않는다. waitForCoordinator는 연결 종료·abort·유한 timeout을 실패로 처리하고 finally cleanup으로 이어져야 한다. 아직 시작되지 않은 메시지를 잃지 않도록 수신을 미리 등록한다.

fixtureContext는 테스트 데이터만 관리한다. 실행 전용 사용자 생성은 예를 들어 아래처럼 UUID를 생성 전에 기록한다. 기존 mysql2 fixture 연결을 사용하고 제품 서비스의 DB 접근은 바꾸지 않는다.

~~~js
const userUuid = randomUUID();
const loginId = 'api-test-' + runId + '-owner';
const password = randomUUID();
ownedUserUuids.push(userUuid);
const [created] = await db.execute(
  'INSERT INTO users (uuid, login_id, password, account_type, status, display_name) ' +
  'VALUES (?, ?, ?, ?, ?, ?)',
  [userUuid, loginId, password, 'MEMBER', 'ACTIVE', 'API test'],
);
const userId = created.insertId;
ownedUserIds.push(userId);
await db.execute('INSERT INTO wallets (user_id, available_points) VALUES (?, ?)', [userId, 0]);
~~~

### 공용 콘텐츠 잠금

- contentLock.mjs는 같은 API baseUrl에 프로세스 간 shared/exclusive 잠금을 구현한다. OS 임시 폴더의 전용 디렉터리와 정규화 baseUrl hash를 사용한다. runId를 잠금 루트에 넣어 서로 다른 잠금을 얻지 않는다.
- 짧게 잡는 gate 파일을 원자적으로 생성해 입장 검사를 직렬화한다. reader는 writer가 없을 때 자신만의 표식을, writer는 reader·writer가 없을 때 writer 표식을 만든다. 검사와 표식 생성은 같은 gate 안에서 수행한다. release도 gate 안에서 자기 표식만 지운다.
- fixture 준비 전에 획득하고 API·검증·cleanup 뒤 해제한다. gate를 잡고 긴 HTTP 요청을 기다리지 않는다. 비동기 대기와 유한 timeout을 사용하고 timeout은 실패로 보고한다. 다른 프로세스의 표식을 임의 삭제하지 않는다.
- 아래는 원자적 입장 판단이다. withGate·소유 표식 생성·확인·finally 해제도 같은 helper에서 구현한다. 검사용 임시 lock root만 주입 가능하게 하고 범용 잠금 설정 계층은 추가하지 않는다.

~~~js
const acquired = await withGate(root, () => {
  const writerPresent = existsSync(join(root, 'writer'));
  const readersPresent = readdirSync(root).some(name => name.startsWith('reader-'));
  if (mode === 'shared' && !writerPresent) {
    writeMarker(ownReaderMarker);
    return true;
  }
  if (mode === 'exclusive' && !writerPresent && !readersPresent) {
    writeMarker(join(root, 'writer'));
    return true;
  }
  return false;
});
~~~

### 실제 병렬 검증과 내부 테스트

- back/package.json에 test:api:parallel: node test/api/verifyParallel.mjs를 추가한다. 기존 test/test:unit/test:api 및 의존성을 유지한다.
- verifyParallel.mjs는 기존 서버에서 실제 run.mjs child process를 실행한다. Node 실행 경로·인자 배열과 IPC를 사용한다. 같은 watch-progress suite 두 실행을 동시에 시작해 서로 다른 runId·user UUID를 확인한다.
- ready에서 두 실행을 대기시킨 뒤 둘 다 start한다. 두 실행의 verified 이후 둘째는 cleanup 직전에 대기시키고 첫째만 cleanup한다. 둘째의 사용자·진행 기록이 여전히 보존됐는지 정확한 키로 DB 조회한 후 둘째 cleanup을 허용한다. 두 exit code와 실행 소유 데이터가 남지 않음도 검사한다.
- 메시지는 phase·suite·runId·user UUID·회차 UUID·시각 같은 비밀 아닌 값만 보낸다. 고정 sleep·단순 실행 시간·성공 exit 두 개만으로 병렬 격리를 통과시키지 않는다.
- content reader를 ready에서 유지한 채 saved-videos writer를 요청한다. writer가 잠금 대기 중임을 메시지로 확인하고 reader cleanup 뒤에만 writer가 준비·검증을 시작하는지 확인한다. 잠금 내부 테스트와 실제 API 실행 증거를 모두 남긴다.
- 조정 실패 시 자식에 abort/cleanup을 요청하고 종료를 기다린다. 종료 실패·남은 데이터·표식은 실패로 보고하며 다른 살아 있는 실행의 표식을 지우지 않는다.
- suiteSelection.spec.ts는 선택·중복·잘못된 인자·전체 suite 등록·단일 선택에 다른 컬렉션 미포함을 검증한다.
- fixtureIsolation.spec.ts는 필요한 fixture만 생성, 별도 실행 소유권, 부분 준비 실패·검증 실패 뒤 정확한 cleanup과 실패 전파를 검증한다.
- contentLock.spec.ts는 프로세스 간 shared 중첩·exclusive 배제·timeout·자기 표식 해제를 검증한다.
- 위 단위 테스트는 내부 runner 규칙용이다. 실제 HTTP 성공·오류·변경 메서드 검증은 Postman 컬렉션이 담당한다.

### 문서와 검증

- API README를 suite 명령·필수 준비·변경 범위·격리·잠금·외부 모드·이관표·실패 조건에 맞춰 갱신한다. 예전 고정 UUID·계정 준비와 광범위한 수동 cleanup 안내를 새 계약으로 교체한다.
- ARCHITECTURE의 test/api 책임과 Backend verification을 선택 실행·실행별 fixture·콘텐츠 잠금에 맞춘다. 제품 계층 설명은 변경하지 않는다.
- 기존 http://localhost:3000에 HTTP 요청을 보내 현재 제품 코드·DB를 확인한 뒤 검증한다. 서버가 없으면 npm --prefix back run start:dev 안내 후 실패한다. endpoint 외부 동작은 바꾸지 않으므로 도메인 API 정의서는 수정하지 않는다.

### 검증 명령

~~~text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
npm --prefix back run test:api:parallel
~~~

### 완료 조건

각 suite가 독립 실행 가능하고 무인자 전체 실행에서 기존 assertion이 보존된다. 같은 기능 두 실행의 상태·cleanup 격리와 shared/exclusive 조율이 실제 API에서 입증된다. 잘못된 선택·준비·정리·HTTP 실패는 비정상 종료다. 기존 개발 데이터는 초기화하지 않는다. 네 checks가 통과하며 worker 결과에 시나리오 이관·실제 병렬 증거·잔여 데이터 점검을 요약한다.
