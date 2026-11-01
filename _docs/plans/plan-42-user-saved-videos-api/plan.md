# plan-42-user-saved-videos-api

## 목표

기존 `user_saved_videos`에 로그인 사용자의 영상 저장·저장 해제·페이지당 최대 30개 조회 API를 추가한다. 모든 API는 Access JWT를 검증하고 본인의 저장 데이터만 처리한다.

## 승인된 범위와 결정

- 범위와 단일 task 구성을 사용자에게 각각 승인받았다.
- 최초 요청의 `user_saved_contents`는 현재 모델 `user_saved_videos`를 사용한다. 테이블명·스키마는 변경하지 않는다.
- `PUT /me/saved-videos/:videoUuid`, JSON body `{ contentType: 'EPISODE' | 'PREVIEW' }`, 성공 204.
- 종류는 클라이언트가 전달한다. 서버는 자동 판별·보정하지 않고 전달된 종류와 영상의 일치 여부만 검증한다.
- 동일 사용자·영상의 중복·동시 저장은 한 행과 최초 UTC 저장 시각을 유지한다.
- `GET /me/saved-videos?page=1`: 생략 시 1, 크기 30 고정. 현재 공개 조건을 먼저 적용한 뒤 `saved_at DESC, video_id DESC`로 정렬한다.
- 응답은 `{ items: [{ videoUuid, contentType, savedAt }], page, hasNext }`. 내부 숫자 ID는 노출하지 않고 시각은 ISO 8601 UTC다. 31개를 조회해 다음 페이지 존재 여부를 판단한다.
- 두 API는 검증된 `request.user.uuid`로만 사용자를 결정한다. body/query의 `userUuid`로 다른 사용자를 선택할 수 없다.
- 공개된 작품 및 해당 회차의 영상만 저장·조회한다. 공개 예정·비공개·삭제된 대상은 목록에서 제외하되 저장 행은 삭제하지 않는다.
- 미구매 유료 본편도 저장할 수 있다. 저장은 재생 권한을 부여하지 않으며 재생 시 기존 구매 권한 검사를 유지한다.
- 페이지 사이에 새 저장·공개 상태 변경이 있으면 항목 위치가 달라질 수 있다. 스냅샷·커서는 추가하지 않는다.
- 사용자 추가 요청에 따라 저장 해제를 `task-2`로 추가한다. `DELETE /me/saved-videos/:videoUuid`, body 불필요, 성공 204로 정의한다.
- 저장 해제는 JWT 사용자와 영상 UUID에 해당하는 저장 행만 삭제한다. 이미 해제됐거나 없는 영상도 204를 반환한다. 잘못된 UUID는 400, 인증 실패는 기존 401이다.
- 저장 해제에는 공개·구매·영상 종류 조건을 적용하지 않는다. 저장 후 비공개로 바뀐 영상도 해제할 수 있으며 콘텐츠 자체·다른 사용자의 저장은 삭제하지 않는다.
- 사용자 요청으로 리뷰 지적 1·2·3을 `task-3`에 추가한다. 상대 사용자 전체 페이지 조회·삭제 격리 테스트를 보완하고, 저장 upsert를 QueryBuilder로 전환한다. API 계약은 변경하지 않는다.

## 비목표

- 프론트 연결, 보관함 화면, 콘텐츠 원본 삭제 API.
- DB 스키마·마이그레이션·시드 변경이나 기존 데이터 초기화.
- JWT 발급·갱신·구매·재생 API 변경.
- 목록 응답의 재생 URL·이미지·작품 상세 확장.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | saved-videos-api | `back/src/playback/savedVideoController.ts`, `back/src/playback/savedVideoService.ts`, `back/src/playback/playback.module.ts`, `back/test/api/public.postman_collection.json`, `back/test/api/run.mjs`, `back/test/api/README.md`, `back/test/unit/playback/savedVideoService.spec.ts`, `_docs/api/04-playback/saved-videos.md`, `_docs/api/04-playback/README.md`, `_docs/api/00-overview/authentication.md`, `_docs/ARCHITECTURE.md` | 두 API, 본인 권한·중복·페이지 처리, 실제 HTTP 검증과 문서 |
| 2 | delete-saved-video-api | `back/src/playback/savedVideoController.ts`, `back/src/playback/savedVideoService.ts`, `back/test/api/public.postman_collection.json`, `back/test/api/run.mjs`, `back/test/api/README.md`, `back/test/unit/playback/savedVideoService.spec.ts`, `_docs/api/04-playback/saved-videos.md`, `_docs/api/04-playback/README.md`, `_docs/api/00-overview/authentication.md`, `_docs/ARCHITECTURE.md` | 본인 영상 저장 해제, 반복 삭제·사용자 격리·비공개 대상 HTTP 검증과 문서 |
| 3 | saved-video-review-fixes | `back/src/playback/savedVideoService.ts`, `back/test/unit/playback/savedVideoService.spec.ts`, `back/test/api/public.postman_collection.json`, `back/test/api/run.mjs`, `back/test/api/README.md` | 리뷰 1·2·3: 상대 사용자 전체 페이지·삭제 격리 회귀 검증, QueryBuilder 저장 upsert |

## 실행 순서 및 병렬 작업

- `task-1`은 선행 의존성이 없다(`depends_on: []`).
- `task-2`는 `task-1`에 의존한다(`depends_on: ["task-1"]`). 기존 저장·목록 API와 같은 컨트롤러·서비스·컬렉션·문서를 수정하므로 순차 실행한다. 병렬 실행 대상은 없다.
- `task-3`은 `task-2`에 의존한다(`depends_on: ["task-2"]`). 서비스·단위 테스트·Postman·runner·README를 공유하므로 앞선 작업 완료 후 순차 실행한다.
- 두 API가 같은 모듈·서비스·Postman 컬렉션을 공유하므로 구현·문서·검증을 묶는다.
- task 안에서는 계약 확인, 구현·문서·테스트 반영, 전체 검증 순으로 진행한다.

## 검증

```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
```

- 현재 코드를 반영한 기존 `http://localhost:3000`과 실제 개발 MySQL을 사용한다.
- 서버가 없으면 검증 실패로 보고하고 `npm --prefix back run start:dev`를 안내한다. 서버를 자동 실행하거나 다른 포트로 우회하지 않는다.
- Postman이 실제 PUT·GET으로 종류별 저장, 중복·동시 요청, 사용자 격리, 토큰 거부, 공개 조건, 0·30·31개 페이지 경계를 검증한다.
- `task-2`는 실제 DELETE와 후속 GET으로 두 종류 저장 해제·반복/동시 해제·사용자 위조·토큰 오류를 검증한다. runner는 이번 실행 소유의 비공개 저장 행도 실제로 삭제됐는지 확인한다.
- `task-3`은 상대 사용자의 임시 저장을 30개 넘게 준비해 tie 항목이 첫 페이지 밖에 있는 상황을 재현한다. 전체 페이지를 통한 기준 목록 보존과 두 사용자가 동시에 저장한 영상의 삭제 격리를 확인한다. QueryBuilder 전환 후에도 중복·동시 저장의 최초 시각·종류 보존 및 DB 장애 전파를 유지한다.
- 이번 쓰기 API 검증에 필요한 임시 fixture만 준비하고 이번 실행이 만든 데이터만 정리한다. 기존 저장 행을 삭제하거나 DB를 초기화하지 않는다.
- 단위 테스트는 DB 장애 전파·시간대 경계처럼 HTTP로 재현하기 어려운 내부 조건에 한정한다.
- 계획 생성 시 제품 코드와 제품 검증 명령은 실행하지 않는다. task 문서 재검토 후 `node tools/harness/cli.mjs validate --plan plan-42-user-saved-videos-api`로 계획을 검증한다.

## 현재 상태

- `task-1` 완료: lint·전체 test·build 통과. 단위 테스트 109개, Postman 요청 215개·assertion 319개 통과.
- `task-2` 완료: lint·전체 test·build 통과. 단위 테스트 110개, Postman 요청 246개·assertion 337개 통과.
- 사용자 요청으로 리뷰 수정용 `task-3`를 추가했으며 상태는 `pending`이다. 이번 추가 작업에서는 계획 문서와 상태 정의만 수정한다.
- 실행 상태의 단일 기준은 이 폴더의 `index.json`이다.
