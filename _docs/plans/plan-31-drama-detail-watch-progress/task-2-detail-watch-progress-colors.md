# task-2-detail-watch-progress-colors

## 읽어야 할 파일
- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/02-content/dramas.md`
- `front/src/features/drama/dramaContent.ts`
- `front/src/screens/DramaDetailScreen.tsx`
- `front/src/common/theme/tokens.ts`
- `front/tests/unit/dramaContent.test.ts`
- `front/tests/unit/dramaDetailScreen.test.ts`
- `.agents/skills/vercel-react-native-skills/SKILL.md`
- `https://docs.expo.dev/versions/v57.0.0/` (front 지침에 따라 코드 작성 전 확인)

## 작업
task-1 완료 후 실행한다. 소유 파일 범위는 아래 네 파일이다. 다른 작업자가 함께 작업할 수 있으므로 타인의 변경을 되돌리지 말고 현재 코드에 맞춰 반영한다.
- `front/src/features/drama/dramaContent.ts`
- `front/src/screens/DramaDetailScreen.tsx`
- `front/tests/unit/dramaContent.test.ts`
- `front/tests/unit/dramaDetailScreen.test.ts`

DramaContent.episodes에 API와 일치하는 필수 nullable watchProgress를 추가한다. 기존 getDramaContent의 userUuid 전달을 재사용한다. 시청기록이 null이 아닌 회차 칸(Pressable)에만 colors.accent 배경을 추가한다. 무료·유료·구매 여부 또는 isCompleted/positionMs 값으로 배경을 판단하지 않는다. null 회차는 기존 colors.surface 배경을 유지한다. 무료 텍스트의 색은 항상 colors.muted로 고정하며 시청 여부에 따른 텍스트 색상 전환을 만들지 않는다. colors 토큰 자체는 바꾸지 않는다.

### 주요 로직 코드 또는 변경 예시
```tsx
// DramaContent.episodes 항목에 추가
watchProgress: {
  positionMs: number;
  isCompleted: boolean;
  lastPlayedAt: string;
} | null;

// 기존 episodes.map 내부 회차 Pressable의 style만 교체
style={[styles.episode, episode.watchProgress !== null && styles.watchedEpisode]}

// 기존 StyleSheet에 적용
watchedEpisode: { backgroundColor: colors.accent },
freeLabel: { color: colors.muted, fontSize: 9, lineHeight: 13 },
```

colors.accent는 현재 무료 글자색인 #CBF46A, colors.muted는 현재 포인트 글자색인 #9197A3다. 회차 번호색·포인트색·테두리·다른 화면·구매/재생 분기는 변경하지 않는다. 구매 후 로컬 isUnlocked 갱신은 기존 객체 spread로 watchProgress를 유지해야 한다. 저장 API나 로컬 가짜 시청기록, 이어보기는 추가하지 않는다.

기존 테스트 fixture를 새 필수 필드에 맞춘다. dramaContent 테스트에서 object/null이 보존됨을 확인한다. 상세 화면 테스트에서 무료·유료 회차의 기록 유무에 따른 실제 style을 확인하고 위치 0·미완주 object도 배경이 적용됨을 확인한다. 무료 글자색은 기록 유무 모두 포인트 글자색과 동일해야 한다. 기존 구매·재생 분기와 사용자 변경 시 이전 응답 무시 검증을 유지한다. 새로운 테스트 파일·추상화는 필요 없다.

검증 명령:
- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

완료 조건: API 응답 타입이 반영되고 기록 존재 조건으로만 회차 배경이 바뀌며 무료 텍스트는 항상 colors.muted다. 기존 미시청 배경·구매/재생 동작이 유지되고 세 검증 명령이 통과한다. 화면을 직접 확인할 경우 기존 localhost:8081 서버를 사용하며 없으면 자동 실행하지 않고 `npm --prefix front run start -- --port 8081`를 안내한다.
