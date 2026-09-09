# AI 영상 앱

## 화면 체험

[AI DRAMA 웹앱 열기](https://ai-drama-screen.qwerqerqwere.chatgpt.site/)

현재 공개된 디자인 체험 소스는 [`web-prototype/`](web-prototype/)에 있습니다. 홈, 추천 숏폼 피드, 작품별 회차 보기, 포인트 체험을 모바일과 데스크톱에서 확인할 수 있습니다.

영상·광고·결제는 체험용이며 실제 청구가 발생하지 않습니다. 이 웹앱은 기존 Expo 앱과 NestJS 서버에 아직 연결되지 않았습니다.

## 기획서

[AI DRAMA 기획서·구현 안내 다운로드 (PowerPoint, 18장)](_docs/AI_DRAMA_기획서_구현안내_20260909.pptx)

서비스 범위, 공통 디자인, 주요 화면과 이용 흐름, 무료 회차·포인트 체험, 출시 전 연결할 기능을 정리했습니다. 기획서에도 [현재 구현된 웹앱](https://ai-drama-screen.qwerqerqwere.chatgpt.site/) 링크가 포함되어 있습니다.

## 저장소 구성

| 폴더 | 용도 |
| --- | --- |
| `front/` | Expo 기반 iOS·Android 앱 |
| `back/` | NestJS API 서버 |
| `web-prototype/` | 공개 웹앱의 화면·이용 흐름 체험 소스 |
| `_docs/` | 구조, 작업 계획, 앱 기획서 |

각 앱은 해당 폴더에서 별도로 설치하고 실행합니다. 웹앱 실행 방법과 기능 범위는 [`web-prototype/README.md`](web-prototype/README.md)를 참고하세요.
