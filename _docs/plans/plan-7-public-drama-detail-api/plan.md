# 공개 작품 상세 REST API

## 목표

드라마 ID로 공개된 작품의 상세 정보와 공개 회차 목록을 반환하는 REST API를 구현한다. 회차에는 이후 사용자별 해제 권한을 판정할 때 사용할 `pricePoints`를 포함한다.

## 범위

- `GET /dramas/:dramaId` 공개 상세 API를 추가한다.
- 공개 작품과 공개 시각이 지난 회차만 노출한다.
- 작품 상세, 제작사, 장르, 대표 이미지, 회차 목록을 반환한다.
- 회차를 번호 오름차순으로 반환하고 `pricePoints`를 포함한다.
- 구현과 일치하도록 Content API 문서를 갱신한다.

## 비목표

- 인증과 사용자 식별을 구현하지 않는다.
- `episode_entitlements` 조회 또는 회차별 `FREE`/`LOCKED`/`ENTITLED` 상태를 반환하지 않는다.
- 회차 구매, 재생 권한 검증, 영상·자막 URL 발급을 구현하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 공개 작품 상세 구현 및 테스트 | `back/src/content/public-catalog.controller.ts`, `back/src/content/public-catalog.service.ts`, `back/test/unit/content/public-catalog.service.spec.ts` | 공개 작품 상세와 번호순 공개 회차를 반환하고, 비공개·미존재 작품은 404로 처리한다. |
| 2 | 공개 작품 상세 API 계약 문서화 | `_docs/api/02-content/dramas.md` | 구현된 endpoint의 요청, 응답, 공개 조건, 오류 응답과 권한 범위를 문서화한다. |

## 실행 순서 및 병렬 작업

- `task-1`은 선행 작업이 없다.
- `task-2`는 `task-1` 완료 후 실행한다. 구현된 경로, 응답 필드, 공개·404 규칙과 API 문서를 정확히 일치시켜야 한다.
- 두 task는 대상 파일이 겹치지 않지만, 위 계약 정합성 때문에 병렬 실행하지 않는다.

## 검증

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`
