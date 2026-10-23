# task-1-development-s3-auth-docs

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `back/README.md`
- `back/src/app.module.ts`
- `back/src/content/s3VideoUrlService.ts`
- `back/src/content/publicCatalogService.ts`
- `.gitignore`

## 작업

대상 파일은 정확히 `back/README.md`, `_docs/ARCHITECTURE.md` 두 개다.

1. `back/README.md`의 영상 재생 설정을 개발용 `AWS_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` 환경 변수에 맞춘다. 실제 키 값은 Git에서 제외된 `back/.env.development`에만 두며 문서에 쓰지 않는다. 기존 `AWS_PROFILE` 로그인 지시는 제거한다.
2. `_docs/ARCHITECTURE.md`의 미디어 저장소 설명을 개발용 환경 변수 자격 증명을 사용하는 현재 설정과 일치시킨다. SDK의 기본 자격 증명 체인 설명과 개발 환경에서만 서명 URL을 발급하는 제한을 정확히 유지한다.
3. 운영 IAM 역할 설정, 운영 재생 API 개방, 백엔드·프론트엔드 코드 및 API 문서 수정은 하지 않는다.

검증 명령:

- `npm --prefix back run test`
- `npm --prefix back run build`

완료 조건: 두 문서가 실제 개발 설정 및 현행 운영 제한과 일치하고, 비밀 키를 추적 파일에 기록하지 않았으며, 검증 명령이 모두 통과한다.
