# API 정의서

AI DRAMA 백엔드 REST API의 현재 계약을 도메인별로 기록한다. 각 리소스 문서는 실제 route, 요청 값, 성공 응답, 오류와 노출 규칙을 정의한다.

로그인부터 토큰 저장·갱신·폐기, API별 인증 전환 방향은 [전체 인증 방식](00-overview/authentication.md)에 모아서 관리한다. 전환 예정 정책은 현재 구현과 구분한다.

## 도메인

| 폴더 | 범위 |
| --- | --- |
| [00-overview](00-overview/README.md) | 공통 응답·시간·공개 콘텐츠 규칙 |
| [01-identity](01-identity/README.md) | 사용자와 인증 |
| [02-content](02-content/README.md) | 작품과 장르 카탈로그 |
| [03-programming](03-programming/README.md) | 홈·랭킹·추천 편성 |
| [04-playback](04-playback/README.md) | 저장·시청 진행·재생 |
| [05-economy](05-economy/README.md) | 포인트·결제·광고 보상 |

현재 identity 도메인은 로그인·갱신·로그아웃 API를, content와 programming 도메인은 공개 콘텐츠 조회 API를 제공한다. 아직 구현되지 않은 도메인 문서는 API를 추측해 정의하지 않는다.
