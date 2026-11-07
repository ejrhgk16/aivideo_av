# 관리자 시안 — 빌드본

`front/`의 웹 전용 관리자 시안(`/admin`)을 `expo export --platform web`으로 만든 정적 파일이다. 설치·빌드 없이 바로 열어 볼 수 있다. 직접 고치지 않고 `front/`에서 다시 만든다.

## 보는 방법

저장소 루트에서:

```powershell
npx.cmd serve -s admin-prototype -l 4173
```

브라우저에서 <http://localhost:4173/admin>을 연다. macOS·Linux는 `npx`로 실행한다.

- 로그인은 시안용이다. 이메일 형식과 8자 이상 비밀번호면 들어간다(예: `operator@example.com` / `pass1234`). 서버로 보내지 않는다.
- 모든 수치는 샘플 데이터이고 API·업로드는 연결되지 않았다.
- 루트 `/`는 시청 앱 화면이라 API 없이 비어 보일 수 있다.

## 화면

| 주소 | 화면 |
| --- | --- |
| `/admin/login` | 관리자 로그인 |
| `/admin` | 프로젝트(작품) 목록 |
| `/admin/projects/:projectId` | 프로젝트 상세·캠페인(회차) 목록 |
| `/admin/campaigns/:campaignId` | 캠페인 대시보드 |
| `/admin/upload` | 업로드 |

지표 정의와 실데이터 전환에 필요한 서버 작업은 [08_관리자_솔루션_시안](../_docs/spec/08_관리자_솔루션_시안.md)에 있다.

## 다시 만들기

소스는 `front/src/app/admin/`, `front/src/screens/Admin*`, `front/src/components/adminUi.tsx`, `front/src/features/admin/`이다.

```powershell
cd front
npx.cmd expo export --platform web --output-dir ../admin-prototype
cd ..
git checkout -- admin-prototype/README.md
```

export가 폴더를 비우므로 이 안내는 마지막 줄로 되살린다.
