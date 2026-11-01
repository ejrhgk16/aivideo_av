# task-2-delete-saved-video-api

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/plan-42-user-saved-videos-api/plan.md`
- `_docs/plans/plan-42-user-saved-videos-api/index.json`
- `.agents/skills/api-and-interface-design/SKILL.md`
- `.agents/skills/nestjs-best-practices/SKILL.md`
- `back/src/playback/savedVideoController.ts`
- `back/src/playback/savedVideoService.ts`
- `back/src/playback/entities/userSavedVideo.entity.ts`
- `back/src/content/entities/contentVideo.entity.ts`
- `back/src/identity/jwtAuthGuard.ts`
- `back/src/common/error/error.filter.ts`
- `back/test/api/public.postman_collection.json`
- `back/test/api/run.mjs`
- `back/test/api/README.md`
- `back/test/unit/playback/savedVideoService.spec.ts`
- `_docs/api/04-playback/saved-videos.md`
- `_docs/api/04-playback/README.md`
- `_docs/api/00-overview/authentication.md`

변경 경로에 적용되는 추가 하위 AGENTS.md가 있는지 확인한다. `web-prototype/`은 읽거나 수정하지 않는다.

## 작업

사용자가 요청한 영상 저장 해제 API를 추가한다. `task-1` 완료 후 순차 실행한다. 기존 저장·목록 API 동작과 검증을 유지한다. 다른 작업자와 사용자가 같은 저장소를 사용할 수 있으므로 다른 변경을 되돌리지 말고 현재 코드에 맞추어 작업한다. 수정은 `apply_patch`로만 수행한다.

### 정확한 파일 범위

- `back/src/playback/savedVideoController.ts`
- `back/src/playback/savedVideoService.ts`
- `back/test/api/public.postman_collection.json`
- `back/test/api/run.mjs`
- `back/test/api/README.md`
- `back/test/unit/playback/savedVideoService.spec.ts`
- `_docs/api/04-playback/saved-videos.md`
- `_docs/api/04-playback/README.md`
- `_docs/api/00-overview/authentication.md`
- `_docs/ARCHITECTURE.md`

### 계약과 권한

- `DELETE /me/saved-videos/:videoUuid`, 필수 Access JWT, body 불필요, 성공 `204 No Content`이며 응답 body 없음.
- 기존 컨트롤러의 `JwtAuthGuard`와 `AllExceptionFilter`를 사용한다. 별도 토큰 파서나 인증 로직을 만들지 않는다.
- 영상 UUID 형식은 기존 PUT과 같은 규칙으로 검증한다. 잘못된 UUID는 기존 NestJS 400, 인증 실패는 `AUTH_INVALID_TOKEN` 401이다.
- 사용자 선택은 오직 `request.user.uuid`다. body/query의 `userUuid`, `contentType`은 대상 선택에 사용하지 않는다.
- JWT 사용자와 영상 UUID에 일치하는 `user_saved_videos` 행만 삭제한다. 콘텐츠 영상·작품·회차·다른 사용자의 저장·시청기록·지갑·구매 권한은 변경하지 않는다.
- 이미 해제된 저장, 본인이 저장하지 않은 영상, 존재하지 않는 유효한 UUID 모두 204다. 존재 여부를 판별하려는 사전 조회나 404 처리는 추가하지 않는다.
- EPISODE/PREVIEW 둘 다 동일 경로로 해제한다. 현재 공개 조건·영상 종류·구매 권한은 검사하지 않는다. 저장 후 비공개가 된 대상도 해제할 수 있어야 한다.
- 반복·동시 DELETE는 204로 처리한다. PUT과 DELETE의 동시 실행 순서까지 보장하는 잠금·이력 기능은 추가하지 않는다.
- DB 오류를 성공이나 인증 오류로 숨기지 않는다. 기존 예외 필터의 서버 오류 처리를 따른다.

### 주요 로직 코드 또는 변경 예시

기존 import에 `Delete`를 추가하고 같은 컨트롤러에 아래 흐름을 구현한다. UUID 검증과 스타일은 기존 코드를 따른다.

```ts
@Delete(':videoUuid')
@HttpCode(204)
async remove(
  @Req() request: AuthenticatedRequest,
  @Param('videoUuid') videoUuid: string,
): Promise<void> {
  if (!uuidPattern.test(videoUuid)) {
    throw new BadRequestException('Invalid saved video');
  }
  await this.savedVideos.remove(request.user.uuid, videoUuid);
}
```

서비스는 공개 조회용 `publicVideos()`를 재사용하지 않는다. 사용자·영상에 해당하는 저장 행만 한 번의 파라미터 바인딩 DELETE로 지운다. 추가 repository·DTO·스키마 변경은 필요 없다.

```ts
async remove(userUuid: string, videoUuid: string): Promise<void> {
  await this.dataSource.query(
    `DELETE saved FROM user_saved_videos saved
     INNER JOIN users app_user ON app_user.id = saved.user_id
     INNER JOIN content_videos video ON video.id = saved.video_id
     WHERE app_user.uuid = ? AND video.uuid = ?`,
    [userUuid, videoUuid],
  );
}
```

### 실제 HTTP 테스트

- 기존 저장 시나리오의 0·30·31개 경계와 타임스탬프·정렬·권한 검증이 모두 끝난 뒤 DELETE 검증을 추가한다. 기존 assertion을 제거하거나 통과 조건을 완화하지 않는다.
- 실제 저장한 임시 PREVIEW 한 개를 DELETE하고 GET에서 제외됐는지 확인한다. 31개에서 30개로 줄어든 첫 페이지와 `hasNext=false`, 두 번째 빈 페이지를 확인한다.
- 같은 UUID에 반복·동시 DELETE를 실행해 모두 204임을 확인한다. 유효하지만 존재하지 않는 UUID와 다른 사용자에게만 저장된 영상도 204임을 확인한다.
- 미구매 유료 EPISODE 임시 영상도 DELETE하고 GET에서 제외되는지 확인한다. 콘텐츠 원본은 남아 있어야 한다. 필요하면 같은 영상에 PUT 후 GET으로 재저장이 가능한지 검증한다.
- 두 fixture 사용자에게 동일한 이번 실행 소유 임시 영상을 저장한 다음, 한 사용자의 DELETE가 상대 저장을 지우지 않는지 두 JWT의 GET으로 확인한다. 타인에게만 저장된 영상을 자기 JWT로 삭제해도 타인 데이터가 유지되는지 확인한다.
- body/query의 `userUuid`를 상대 UUID로 위조한 DELETE도 JWT 사용자 데이터만 삭제하고 상대 항목을 보존해야 한다. 기존 상대 사용자 baseline은 유지하고 이번 실행의 임시 영상만 추가·삭제한다.
- 이미 runner가 실제 PUT 후 HIDDEN으로 바꾼 임시 영상에 DELETE가 204임을 확인한다. 공개 목록에서 원래 안 보이므로 GET만으로 삭제를 증명하지 말고 runner의 Postman 종료 후 DB 조회로 해당 소유 저장 행이 실제 없어졌는지 확인한다. 정리 DELETE 이전에 확인하고 남아 있으면 실패한다.
- 헤더 누락·변조·만료 Access·Refresh JWT의 DELETE가 각각 401 `AUTH_INVALID_TOKEN`인지 확인한다. 유효한 영상 UUID로 인증을 검증하고 잘못된 UUID는 정상 JWT로 400을 확인한다. 거부된 DELETE가 저장을 바꾸지 않는지도 후속 GET으로 확인한다.
- 삭제 외의 기존 저장 시나리오와 지갑·entitlement 불변 검사를 유지한다. API 서버는 현재 변경 코드가 반영된 기존 `http://localhost:3000`을 사용한다.

### runner·정리·단위 테스트

- `run.mjs`는 기존 임시 영상과 두 fixture 사용자를 재사용한다. 추가 데이터는 필요한 경우 이번 실행 소유를 즉시 기록한다. 기존 데이터 삭제·DB 초기화·시드 재실행은 하지 않는다.
- Postman 성공 뒤 hidden 저장 행 삭제 확인은 정리 전 수행한다. Postman 실패·DB 검증 실패·부분 준비 실패에도 기존 finally 정리를 수행하고 실패 상태를 전파한다. 정리 실패를 성공으로 처리하지 않는다.
- `API_TEST_ENVIRONMENT_FILE` 모드는 기존처럼 자동 DB 준비·검증·정리하지 않는다. 외부 환경에서 비공개 저장 행 삭제의 DB 확인을 별도로 수행할 필요와 필요한 임시 데이터 조건을 README에 명시한다. 해당 삭제 HTTP 요청을 skip하지 않는다.
- `savedVideoService.spec.ts`에는 remove의 DB 장애가 원래 오류로 전파되는 최소 사례만 추가한다. SQL 문자열·호출 횟수를 그대로 복제하는 테스트는 추가하지 않는다. 사용자 격리·반복 삭제·입력·인증은 Postman으로 검증한다.

### 문서 변경

- `saved-videos.md`: DELETE 경로·필수 Access·body 불필요·204·400·401·미저장/없는 UUID의 204·반복 요청·사용자 격리·비공개 영상 해제·원본 보존을 명시한다. 기존 PUT의 404는 DELETE에 적용하지 않도록 메서드별 오류 조건을 구분한다.
- playback README와 authentication 문서에 저장 해제 경로를 반영한다.
- ARCHITECTURE의 Playback 책임과 backend verification 설명을 실제 구현에 맞춰 저장 해제·비공개 행 삭제 검증까지 갱신한다. 관련 없는 설명은 수정하지 않는다.
- 테스트 README에 DELETE 순서, 비공개 행 DB 확인, 두 사용자 격리와 외부 환경 전제를 기록한다.

### 검증 명령과 실행 전제

```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
```

- API 검증 전에 HTTP로 기존 개발 서버와 코드 반영을 확인한다. 포트/프로세스 조회만으로 서버가 없다고 판단하지 않는다.
- 서버가 없으면 검증 실패와 `npm --prefix back run start:dev` 안내를 출력한다. 서버를 자동 시작·종료하거나 다른 포트로 우회하지 않는다. 코드 반영 확인이 불가능하면 사용자에게 확인한다.
- 전체 test는 단위 및 실제 MySQL에 연결된 Postman HTTP 검증을 포함한다. 서버·DB·데이터·정리 실패를 통과로 처리하지 않는다. 비밀 값은 기존 Git-ignored 환경 파일과 임시 환경으로만 전달한다.

### 완료 조건

- DELETE가 본인 저장만 해제하고 반복·동시·없는 항목 요청은 204다. 비공개 영상도 해제되며 콘텐츠 원본과 상대 저장은 보존된다.
- 입력·인증·위조 방어와 두 종류 실제 DELETE/GET 검증이 통과한다. 숨겨진 저장 행 삭제가 기본 runner의 DB 확인으로 증명된다.
- 기존 PUT/GET 검증을 유지하고 임시 데이터만 정리한다. 문서가 실제 동작과 일치한다.
- 선언된 세 checks가 모두 통과하고 범위 밖 변경이 없다.
