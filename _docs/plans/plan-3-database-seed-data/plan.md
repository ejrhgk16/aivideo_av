# database-seed-data

## 목표

개발·데모 환경에서 명시적으로 실행하는 `db:seed` 명령으로 예시 데이터를 MySQL에 입력한다. 시드는 고정 UUID와 upsert를 사용해 재실행해도 중복 행 없이 같은 상태를 유지한다.

## 범위

- 제작사 3개, 장르 6개, 작품 5개와 작품-장르 연결 10개를 입력한다.
- 작품별 포스터·히어로·썸네일 이미지를 포함해 `drama_images` 15개를 입력한다.
- 작품별 4화씩 총 20개 회차를 입력한다. 1화는 무료, 2~4화는 유료로 설정한다.
- 회차마다 `FULL`과 `PREVIEW` 영상을 넣어 `episode_videos` 40개와 한국어 자막 20개를 입력한다.
- 홈, 편집 랭킹, 추천 피드 컬렉션 3개와 편성 연결 13개를 입력한다.
- 포인트 상품 3개와 광고 보상 상품 2개를 입력한다.
- 이미지·영상·자막 파일은 생성하거나 업로드하지 않는다. 각 테이블의 `storage_key`에는 예시 객체 스토리지 키만 저장한다.

## 비목표

- 서버 시작, 빌드, 마이그레이션, 운영 배포에서 시드를 자동 실행하지 않는다.
- 사용자, 지갑, 시청 기록, 포인트 원장, 구매 주문, 광고 보상 청구, 회차 권한은 생성하지 않는다.
- 실제 미디어 파일, 정적 파일 제공, CDN 또는 객체 스토리지 연동을 구현하지 않는다.
- 테이블 구조와 마이그레이션을 변경하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | seed-data-definition | `back/src/common/database/seed/initialData.ts`, `back/test/unit/database/initialData.spec.ts` | 고정 UUID 예시 데이터와 데이터 관계 검증을 만든다. |
| 2 | seed-command-and-documentation | `back/src/common/database/seed.ts`, `back/package.json`, `back/README.md`, `_docs/ARCHITECTURE.md` | TypeORM 시드 명령, 실행 스크립트와 문서를 만든다. |

## 실행 순서 및 병렬 작업

- `task-1`은 선행 작업이 없다. 시드 데이터 정의와 단위 테스트만 다루므로 즉시 실행할 수 있다.
- `task-2`는 `task-1` 완료 후 실행한다. 시드 CLI가 `task-1`의 데이터 모듈을 import하기 때문이다.
- 두 task는 변경 파일이 겹치지 않지만 위 의존성 때문에 병렬 실행하지 않는다.

## 검증 결과

- 플랜 생성 시점: 미실행. 각 task의 `checks`를 Harness 실행 중 확인한다.
