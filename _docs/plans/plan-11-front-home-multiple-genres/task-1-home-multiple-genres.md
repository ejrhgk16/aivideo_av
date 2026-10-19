# task-1-home-multiple-genres

## 읽어야 할 파일
- `AGENTS.md`
- `front/AGENTS.md` (코드 수정 전 Expo 57 문서 확인 지침 포함)
- `_docs/ARCHITECTURE.md`
- `front/src/screens/HomeScreen.tsx`
- `front/src/features/home/homeContent.ts`
- `front/src/screens/ApiDramaDetailScreen.tsx` (기존 다중 장르 표시 방식 참고)

## 작업
변경 파일은 `front/src/screens/HomeScreen.tsx` 하나다.

- 추천 히어로, 추천 포스터, TOP 3에서 `genres[0]` 대신 `genres`의 모든 이름을 응답 순서대로 ` · `로 연결해 표시한다.
- 장르가 비어 있으면 기존 `장르 정보 없음` 문구를 유지한다.
- TOP 3 포스터를 현재 60×84보다 알아보기 쉬운 약 84×118 크기로 키우고, 작은 화면에서도 제목·장르·무료 회차 텍스트가 읽히도록 줄 배치를 조정한다.
- 상단 추천 히어로에 좌우 터치 스와이프를 추가한다. 실제 히어로 영역 너비에 맞춰 한 작품씩 이동하고, 스와이프와 기존 번호 버튼이 같은 선택 상태를 가리키게 한다. 자동 전환은 넣지 않는다.
- 상단 추천 히어로의 작품 소개 이동, 재생 준비 중 표시, 로딩·오류·빈 상태를 유지한다.
- 장르 뒤의 공개·무료 회차 정보와 그 외 화면 동작은 유지한다. 무료 회차 문구는 변경하지 않는다.
- 완료 조건: 세 위치에서 두 장르가 `로맨스 · 드라마`처럼 표시되고, 한 장르와 빈 장르 배열도 기존 의미대로 표시된다. TOP 3 포스터가 확대되어도 텍스트가 읽히고, 상단 히어로를 스와이프하거나 번호 버튼을 눌러 같은 작품으로 이동할 수 있다.
- 검증 명령: `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`.
