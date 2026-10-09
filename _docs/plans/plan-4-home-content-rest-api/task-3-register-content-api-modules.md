# task-3-register-content-api-modules

## 읽어야 할 파일

- `AGENTS.md`
- `back/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `back/src/app.module.ts`
- `back/src/content/content.module.ts`
- `back/src/programming/programming.module.ts`

## 작업

`AppModule`의 `imports`에 Task 1의 `ContentModule`과 Task 2의 `ProgrammingModule`을 등록한다. 기존 `ConfigModule`과 `TypeOrmModule` 설정은 변경하지 않는다.

이 task는 모듈 조립만 담당한다. route prefix, CORS, 전역 middleware, 컨트롤러·서비스 로직 또는 테스트 파일을 추가하지 않는다.

완료 조건: 애플리케이션이 두 모듈을 import하고 아래 명령이 모두 통과한다.

```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
```
