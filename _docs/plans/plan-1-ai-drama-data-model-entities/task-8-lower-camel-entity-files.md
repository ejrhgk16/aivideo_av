# task-8-lower-camel-entity-files

## 작업

Entity class는 PascalCase를 유지하고, 파일명은 첫 글자만 소문자로 바꾼 lower camel case를 사용한다. `.entity.ts` 접미사는 유지한다.

- `User.entity.ts` → `user.entity.ts`
- `UserPreference.entity.ts` → `userPreference.entity.ts`
- `AuditedEntity.entity.ts` → `auditedEntity.entity.ts`

각 도메인 `index.ts` barrel과 `AuditedEntity` import의 NodeNext ESM 상대 경로도 새 파일명 및 `.js` 확장자에 맞춘다. Entity class, decorator, 컬럼, 제약조건, registry export 대상은 변경하지 않는다.

## 검증 및 완료 조건

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`
- Entity 구현 파일명은 첫 글자 소문자 lower camel case이며, class 이름은 기존 PascalCase를 유지해야 한다.
