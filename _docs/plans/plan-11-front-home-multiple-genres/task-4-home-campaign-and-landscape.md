# task-4-home-campaign-and-landscape

## 읽어야 할 파일
- `AGENTS.md`
- `front/AGENTS.md` (코드 수정 전 Expo 57 문서 확인 지침 포함)
- `_docs/ARCHITECTURE.md`
- `front/src/screens/HomeScreen.tsx`
- `front/src/features/home/homeContent.ts`
- `front/src/features/drama/dramaContent.ts`
- `task-3-landscape-poster-api.md`

## 작업
변경 파일은 plan index의 `task-4.files`에 선언된 파일만 허용한다.

- 프론트 컬렉션·작품 API 타입에 `posterLandscape: string | null`을 반영한다.
- 홈 추천 탭에서 `getHomeCollection('HOME_CAMPAIGN')`을 기존 세 컬렉션과 별도로 요청한다. 첫 작품의 첫 번째 `imageUrls.campaigns`를 중간 배너 이미지로 사용한다.
- 삭제 전 배너를 추천 포스터 목록과 TOP 3 사이에 복원한다. `오늘은, 설레도 괜찮아.`, `퇴근길을 채울 로맨스 한 편`, `로맨스 만나기` 문구와 로맨스 검색 이동을 유지한다. 배너 이미지는 API URL로 표시한다.
- 캠페인 컬렉션 요청 실패, 빈 컬렉션, 캠페인 이미지 없음은 배너를 숨긴다. 고정 이미지로 대체하지 않는다.
- TOP 3는 `imageUrls.posterLandscape ?? imageUrls.poster`를 사용한다. 이미지 영역을 가로형 비율로 바꾸고 작은 모바일 화면에서 순위·제목·장르·회차·무료 정보가 읽히도록 간격을 조정한다. 이미지 왜곡 없이 `cover`를 유지한다.
- 일일 추천 포스터는 세로 `poster`를 계속 사용한다. 히어로 스와이프, TOP 3 순서·상세 이동, 기타 홈 영역은 유지한다.
- 완료 조건: 로맨스 캠페인 이미지와 기존 문구가 중간 영역에 표시되고, TOP 3는 별도 가로 포스터를 사용하며, 가로 포스터가 없을 때 세로 포스터로 대체된다.
- 검증 명령: `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`.
