# task-6-esm-import-paths

## 읽어야 할 파일

- `AGENTS.md`
- `back/tsconfig.json`
- `back/src/identity/entities/index.ts`
- `back/src/content/entities/index.ts`
- `back/src/programming/entities/collection-drama.entity.ts`
- `back/src/programming/entities/content-collection.entity.ts`
- `back/src/programming/entities/index.ts`
- `back/src/playback/entities/index.ts`
- `back/src/playback/entities/user-watch-progress.entity.ts`

## 작업

`back/tsconfig.json`은 `module`과 `moduleResolution`에 `nodenext`를 사용한다. NodeNext ESM 상대 import는 TypeScript 소스 파일에서도 출력 파일 기준의 `.js` 확장자를 명시해야 한다.

다음 다섯 파일의 기존 상대 import/export 경로에만 `.js` 확장자를 추가한다.

- `back/src/programming/entities/collection-drama.entity.ts`
- `back/src/programming/entities/content-collection.entity.ts`
- `back/src/programming/entities/index.ts`
- `back/src/playback/entities/index.ts`
- `back/src/playback/entities/user-watch-progress.entity.ts`

다른 Entity의 컬럼, decorator, 제약조건, export 대상은 변경하지 않는다. `identity`와 `content` barrel의 `.js` 표기를 동일한 기준으로 삼는다.

## 검증 및 완료 조건

- `npm --prefix back run lint`
- `npm --prefix back run build`
- 기존 TS2307 8건이 없어져야 한다.
