# task-7-class-named-entity-files

## 작업

모든 Entity 구현 파일을 해당 export class 이름의 PascalCase로 바꾼다. `.entity.ts` 접미사는 유지한다.

- 예: `user-preference.entity.ts` → `UserPreference.entity.ts`
- 예: `audited.entity.ts` → `AuditedEntity.entity.ts`

`AuditedEntity`를 import하는 파일과 각 도메인 `index.ts` barrel의 NodeNext ESM 상대 경로도 새 파일명 및 `.js` 확장자에 맞춘다. Entity class, decorator, 컬럼, 제약조건, registry export 대상은 변경하지 않는다.

## 검증 및 완료 조건

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`
- `back/src`에 kebab-case Entity 구현 파일이 남지 않고, 모든 Entity 구현 파일의 basename이 export class 이름과 일치해야 한다.
