# task-4-delete-demo-assets-state

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/src/features/drama/catalog.ts`
- `front/src/features/drama/ExperienceProvider.tsx`
- `front/src/features/drama/experience.ts`
- `front/src/common/storage/experienceStorage.ts`
- `front/src/components/ui.tsx`
- `front/src/common/media.ts`
- `front/scripts/test-experience.cjs`
- `front/README.md`

## 작업

정확한 변경 파일 범위:

- `front/src/features/drama/catalog.ts` (삭제)
- `front/src/features/drama/ExperienceProvider.tsx` (삭제)
- `front/src/features/drama/experience.ts` (삭제)
- `front/src/common/storage/experienceStorage.ts` (삭제)
- `front/src/common/shareDrama.ts` (삭제)
- `front/src/components/ui.tsx`
- `front/src/common/media.ts`
- `front/tests/unit/experience.test.ts` (삭제)
- `front/tests/unit/media.test.ts`
- `front/scripts/test-experience.cjs` (삭제)
- `front/scripts/test-front.cjs` (신규)
- `front/package.json`
- `front/package-lock.json`
- `front/.env.example`
- `front/README.md`
- `front/media/images/signal.jpg` (삭제)
- `front/media/images/season.jpg` (삭제)
- `front/media/images/moon.jpg` (삭제)

화면에서 더 이상 참조하지 않는 정적 작품 카탈로그, 체험 상태·저장소, 샘플 공유 코드와 세 이미지 파일을 제거한다. 공용 UI의 `DramaImage`·`Poster`와 정적 미디어 base URL 해석만 정리하고 API 이미지 URL 해석 및 다른 공용 UI는 유지한다. 사용하지 않는 체험 전용 패키지를 `package.json`·lockfile에서 정리한다. 테스트 실행 스크립트는 실제 남은 테스트를 실행하도록 이름과 등록 목록을 갱신하고, 임시 작품 예시를 쓰는 미디어 테스트를 API URL 사례로 교체한다. `.env.example`과 README는 현재 API base URL 및 실제 사용 흐름에 맞춘다.

완료 조건: 제품 코드·테스트·설정에서 세 임시 ID 및 이미지 키, 정적 카탈로그·체험 상태 참조가 사라지고 `npm test`가 남은 API 테스트를 실행한다. API 이미지 URL 처리는 유지된다.

검증 명령:

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
