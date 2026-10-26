# task-3-preview-playback-client

## 읽어야 할 파일

- AGENTS.md
- front/AGENTS.md
- _docs/ARCHITECTURE.md
- front/src/features/playback/episodePlayback.ts
- front/tests/unit/episodePlayback.test.ts
- _docs/api/02-content/dramas.md

## 작업

목표: 작품 UUID와 프리뷰 UUID로 기존 프리뷰 재생 API를 호출하는 프론트 클라이언트를 추가한다.

정확한 변경 파일:

- front/src/features/playback/previewPlayback.ts
- front/tests/unit/previewPlayback.test.ts

getPreviewPlayback(dramaId, videoId)는 GET /dramas/:dramaId/previews/:videoId/playback을 호출하고 url, durationMs를 반환한다. 두 UUID를 경로 세그먼트로 인코딩한다. 백엔드 계약에서 url은 절대 S3 서명 URL이므로 응답 값을 그대로 사용한다. API 기본 URL이 없거나 응답이 실패하면 오류를 반환한다. 테스트는 경로 인코딩, 정상 응답, 오류 응답, API 기본 URL 누락을 검증한다. 백엔드의 개발 환경 전용 정책은 변경하지 않는다.

검증 명령: npm --prefix front run typecheck, npm --prefix front run test

완료 조건: 프리뷰 UUID로 서명 URL을 가져오는 함수가 있고, 성공·오류 경로가 단위 테스트로 검증된다.

### 주요 로직 코드 또는 변경 예시

~~~ts
export interface PreviewPlayback {
  url: string;
  durationMs: number;
}

export async function getPreviewPlayback(dramaId: string, videoId: string): Promise<PreviewPlayback> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to fetch preview playback.');
  }

  const path = 'dramas/' + encodeURIComponent(dramaId)
    + '/previews/' + encodeURIComponent(videoId) + '/playback';
  const response = await fetch(baseUrl.replace(/\/+$/, '') + '/' + path);
  if (!response.ok) {
    throw new Error('Failed to fetch preview playback: ' + response.status);
  }

  return (await response.json()) as PreviewPlayback;
}
~~~
