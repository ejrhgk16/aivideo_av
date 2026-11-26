# Admin

AI DRAMA 관리자 웹. Next.js(App Router)이며 백엔드와 같은 MySQL DB(`aivideodb`)를 직접 읽고 쓴다. 명령은 저장소 루트에서 실행한다. 테이블 정의는 [데이터 모델](../_docs/AI_DRAMA_data_model/README.md), API는 [API 문서](../_docs/api/README.md)를 따른다. 화면 구성은 `ai/admin-dashboard` 브랜치의 관리자 시안(`_docs/spec/08_관리자_솔루션_시안.md`)을 옮겼다. 지표 정의는 저장소 밖 공유 문서인 관리자 지표 정의서 초안 v0.1(`peeka-share/metrics-definition-draft.md`)을 따르며, 시안의 노출·조회·조회율 정의와 캠페인 KPI 구성은 이 정의서로 대체됐다.

## 화면

관리자 화면에서 프로젝트는 작품(drama), 캠페인은 회차(episode)다.

| 주소 | 화면 |
| --- | --- |
| `/login` | 운영자 로그인 |
| `/` | 프로젝트 목록. 전체 KPI와 프로젝트 표 |
| `/projects/[projectId]` | 프로젝트 상세와 캠페인 표. `projectId`는 작품 uuid |
| `/campaigns/[campaignId]` | 캠페인 대시보드. `campaignId`는 회차 uuid |
| `/upload` | 새 프로젝트 또는 기존 프로젝트에 캠페인 저장. `?projectId=`로 프로젝트를 고른다 |

- 작품·회차·장르·제작사는 DB 실데이터다. 노출수·조회수·비율·이탈 곡선은 수집 테이블이 없어 `src/lib/sampleMetrics.ts`가 회차 uuid와 날짜로 만든 예시 숫자이며, 화면에 `샘플 지표`로 표시한다. 샘플 조회율은 정의(빼꼼 노출 뒤 24시간 내 전환)와 달리 조회수 ÷ 노출수로 근사하고, 작품 노출수는 회차별 샘플 노출의 합이다.
- 노출수·조회율은 작품 단위라 목록과 프로젝트 KPI에만 둔다. 캠페인 화면과 프로젝트의 캠페인 표에는 없다.
- 기간은 `?range=7|28|90`(기본 28)이고 KST 날짜 기준이다.

## 로그인

- `users`에서 `account_type = 'OPERATOR'`, `status = 'ACTIVE'`인 계정만 들어온다. 링크로 열 수 있게 하려고 비밀번호가 12자 미만이면 거절한다. 개발 시드 `admin/admin`은 이 화면에 들어오지 못한다.
- 세션은 `ADMIN_SESSION_SECRET`으로 서명한 HttpOnly 쿠키이며 8시간 뒤 만료된다. 요청마다 계정 상태를 다시 확인한다.

## 업로드

- 새 프로젝트는 `dramas`·`drama_genres`, 캠페인은 `episodes`에 한 트랜잭션으로 저장한다. 상태는 `SCHEDULED`이고 `published_at`은 입력한 공개 예정 일시(KST)를 UTC로 바꾼 값이다. 앱 API는 `PUBLISHED`만 내보내므로 앱에는 보이지 않는다.
- 포스터·영상·표지 파일은 서버로 보내지 않고 저장하지도 않는다. 영상 길이만 브라우저에서 읽어 `duration_ms`로 저장한다.

## 환경·실행

```powershell
npm --prefix admin ci
npm --prefix admin run dev
```

개발 주소는 `http://127.0.0.1:3001`이다. 백엔드가 3000을 쓰고, 같은 네트워크의 다른 기기에서 열리지 않게 127.0.0.1에만 연다. `admin/.env.local`을 만들어 아래 키를 채운다. 이 파일은 Git에 올리지 않는다.

| 설정 | 기준 |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | 대상 MySQL 연결. 값은 `back/.env.development`와 같은 `root` 계정이다 |
| `ADMIN_SESSION_SECRET` | 로그인 쿠키 서명 키. 32자 이상 무작위 값 |

운영 빌드로 확인할 때:

```powershell
npm --prefix admin run build
npm --prefix admin run start
```

## 테스트

```powershell
npm --prefix admin run lint
npm --prefix admin run test
npm --prefix admin run build
```

단위 테스트는 `admin/tests/`에 둔다.

## DB 준비

DB는 MySQL `root`로 한 번 만든다.

```sql
CREATE DATABASE IF NOT EXISTS aivideodb CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

테이블은 admin에서 만들지 않는다. 백엔드 마이그레이션이 스키마의 기준이다. 예시 작품·회차가 필요하면 백엔드 시드를 넣는다.

```powershell
npm --prefix back run build
npm --prefix back run db:migration:run
npm --prefix back run db:seed
```
