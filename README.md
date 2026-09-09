# AI 영상 앱

## 화면 체험

[AI DRAMA 웹앱 열기](https://ai-drama-screen.qwerqerqwere.chatgpt.site/)

현재 앱 개발 소스는 [`front/`](front/)입니다. 공개 웹 시안의 화면과 체험 기능을 Expo / React Native로 옮겨 iOS·Android·Web에서 실행할 수 있도록 구성했습니다. 실행 방법은 [front 안내](front/README.md)를 참고하세요.

위 공개 링크는 기존 웹 시안입니다. `front` 변경이 이 링크에 자동 배포되지는 않습니다. 영상·광고·결제는 체험용이며 실제 청구가 발생하지 않습니다. NestJS 서버는 아직 연결하지 않았습니다.

## 기획서

[구글 슬라이드 기획서 (비공개, 소유자 또는 공유받은 계정으로 열기)](https://docs.google.com/presentation/d/1pYl-LSJrTFtbY1M7yuBmiHh7ZE8YLb08c1OFUkHuxMM/edit?usp=drivesdk)

[AI DRAMA 기획서·구현 안내 다운로드 (PowerPoint, 18장)](_docs/AI_DRAMA_기획서_구현안내_20260909.pptx)

서비스 범위, 공통 디자인, 주요 화면과 이용 흐름, 무료 회차·포인트 체험, 출시 전 연결할 기능을 정리했습니다. 기획서에도 [현재 구현된 웹앱](https://ai-drama-screen.qwerqerqwere.chatgpt.site/) 링크가 포함되어 있습니다.

## 저장소 구성

| 폴더 | 용도 |
| --- | --- |
| `front/` | AI DRAMA 화면·체험 기능을 통합한 Expo iOS·Android·Web 앱 |
| `back/` | NestJS API 서버 |
| `web-prototype/` | 기존 공개 웹 시안 원본 보관. `front` 실행에 사용하지 않음 |
| `_docs/` | 구조, 작업 계획, 앱 기획서 |

프론트엔드와 백엔드는 각 폴더의 독립적인 npm lockfile로 관리합니다.
