# episode-playback-single-query

## 목표

회차 재생 정보 조회에서 episodes, dramas, content_videos를 한 SQL 조회로 결합한다. 공개 조건과 본편 영상 선택을 유지하면서 순차 DB 조회 3회를 1회로 줄인다.

## 범위와 가정

- episodes.drama_id = dramas.id로 작품을 연결한다.
- content_videos.content_type = EPISODE, content_videos.content_id = episodes.id, content_videos.kind = FULL로 본편 영상을 연결한다. 다형성 참조에는 외래 키나 TypeORM 관계가 없어 명시적 조인 조건을 사용한다.
- 작품과 회차는 모두 PUBLISHED 상태이고 published_at이 현재 시각 이하이어야 한다.
- 조건을 충족하는 영상이 여러 개면 display_order가 가장 낮은 한 행을 선택한다. URL, 회차명, 회차 번호, 선택된 영상의 재생 시간은 기존 응답과 같다.
- 재생 URL 발급과 개발용 영상 제공 경로는 같은 조회 로직을 사용한다.

## 비목표

- REST 경로와 응답 필드, 인증, 개발 환경 제한, 404 조건을 변경하지 않는다.
- DB 스키마, 외래 키, 미디어 파일 제공 방식, 프론트 화면을 변경하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | episode-playback-single-query | back/src/content/public-catalog.service.ts, back/test/unit/content/public-catalog.service.spec.ts, _docs/api/04-playback/episodes.md, _docs/AI_DRAMA_data_model/02-content/content_videos.md | 명시적 3테이블 조인, 공개 조건과 영상 선택 검증, 조회 기준 문서화 |

## 실행 순서 및 병렬 작업

- task-1 하나만 수행한다. 선행 의존성이 없고 병렬 task가 없다. 서비스 변경과 그 검증 및 문서는 같은 계약을 다루므로 한 task에 묶는다.

## 검증

- npm --prefix back run lint
- npm --prefix back run test
- npm --prefix back run build
- 성공 응답 값과 첫 FULL 영상 선택, 비공개·없는 작품 또는 회차, 본편 영상 없음의 404, 개발 환경 제한이 유지되는지 확인한다.

## 승인 및 실행 상태

- 범위 승인: 사용자가 세 테이블을 한 조회로 합치도록 요청하고 진행을 승인했다.
- task 구성 승인: 사용자가 문서 수정을 추가 조건으로 요청해 서비스·테스트·API·데이터 모델 문서를 단일 task에 포함했다.
- 상태: draft. 제품 코드는 $harness 실행 전까지 변경하지 않는다.
