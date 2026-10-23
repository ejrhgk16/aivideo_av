# 개발용 S3 access key 설정 문서화

## 목표

- 개발 백엔드의 S3 서명 URL 발급에 사용하는 `AWS_ACCESS_KEY_ID`와 `AWS_SECRET_ACCESS_KEY` 설정 방법을 실제 구현과 일치시키고, 만료된 `AWS_PROFILE` 로그인 설정 안내를 제거한다.
- 개발용 전용 IAM 사용자와 로컬 `.env.development`의 키 설정은 이미 완료했다. 실제 키 값은 이 계획과 추적 파일에 기록하지 않는다.
- 운영 IAM 역할 연결과 운영 재생 API 활성화는 범위에서 제외한다. 프론트엔드, 백엔드 코드, API 계약은 변경하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 개발 S3 인증 문서 정합화 | `back/README.md`, `_docs/ARCHITECTURE.md` | 개발 환경 변수와 AWS SDK 기본 자격 증명 체인의 사용을 설명하고, 운영 재생 제한을 유지한 상태로 문서를 맞춘다. |

## 실행 순서 및 병렬 작업

- `task-1`만 실행한다. 선행 작업과 병렬 작업은 없다.

## 검증

- `npm --prefix back run test`
- `npm --prefix back run build`
- 문서의 환경 변수와 재생 환경 제한이 `back/src/content/s3VideoUrlService.ts` 및 `back/src/content/publicCatalogService.ts`의 현재 동작과 일치하는지 확인한다.
