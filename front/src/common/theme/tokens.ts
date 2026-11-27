// peeka 디자인 토큰. 값과 쓰임은 web-prototype/DESIGN.md와 app/globals.css를 따른다.
// 화면 코드는 색 값을 직접 적지 않고 theme.ts의 useColors·createThemedStyles로 지금 모드의 색을 받는다.

const light = {
  background: '#FBF4EC', // cream
  surface: '#FFFFFF',
  elevated: '#EDE2FF', // lavender-soft: 눌린 칸·연한 채움·보조 버튼
  text: '#2B1D47', // ink
  muted: '#6E6089',
  accent: '#6A3FD0', // violet: 선택·링크·진행 막대·탭 밑줄
  border: '#E8DDF3', // line
  borderStrong: '#8776AA', // 누를 수 있는 것의 테두리
  danger: '#C4314B',
  warn: '#FADADF', // 주의 띠 바탕
  rank: '#9B6FE8', // 순위 숫자
  strip: '#D0B3FB', // 병아리 띠
  lavender: '#D0B3FB', // 마스코트 그림 바탕
  onLavender: '#2B1D47',
  yolk: '#FFC93C', // 화면마다 주 버튼 하나에만
  onYolk: '#3D2400',
  // 영상 위·영상 주변. 라이트는 밤 라벤더, 다크는 거의 검정.
  night: '#1D1433',
  onMedia: '#FFFFFF',
  onMediaMuted: '#DDD3F0',
  mediaBack: '#1D1433B8', // 그림 위 글자 받침(night 72%)
  mediaFill: '#FFFFFF1F',
  mediaLine: '#FFFFFF1F',
  mediaLineStrong: '#FFFFFF3D',
  mediaTrack: '#FFFFFF52',
  mediaScrim: '#0000007A', // 재생 버튼 바탕 등 영상 위의 검정 막
  mediaShadow: '#000000',
  backdrop: '#1D1433B3', // 떠 있는 창 뒤 가림막
};

export type Palette = { [K in keyof typeof light]: string };

const dark: Palette = {
  background: '#121214', // ink-night
  surface: '#1A1A1D',
  elevated: '#242428',
  text: '#F2F1F4',
  muted: '#A8A7B0',
  accent: '#D0B3FB',
  border: '#2E2E33',
  borderStrong: '#7D7D88',
  danger: '#FF9FB0',
  warn: '#3A2028',
  rank: '#D0B3FB',
  strip: '#242428',
  lavender: '#D0B3FB',
  onLavender: '#2B1D47',
  yolk: '#FFC93C',
  onYolk: '#3D2400',
  night: '#0C0C0E',
  onMedia: '#FFFFFF',
  onMediaMuted: '#D6D5DB',
  mediaBack: '#0C0C0EB8',
  mediaFill: '#FFFFFF1F',
  mediaLine: '#FFFFFF1F',
  mediaLineStrong: '#FFFFFF3D',
  mediaTrack: '#FFFFFF52',
  mediaScrim: '#0000007A',
  mediaShadow: '#000000',
  backdrop: '#000000B3',
};

export const palettes: Record<'light' | 'dark', Palette> = { light, dark };

export const typography = {
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  semibold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
  // 로고 글자와 순위 숫자에만 쓴다.
  extrabold: 'Pretendard-ExtraBold',
} as const;

/** 글자 크기 일곱 단계(32·24·18·16·14·12·11)와 줄 높이. 자간은 AppText가 크기의 -0.02em으로 채운다. */
export const textSizes = {
  heading32: { fontSize: 32, lineHeight: 48 },
  heading24: { fontSize: 24, lineHeight: 36 },
  body18: { fontSize: 18, lineHeight: 27 },
  body16: { fontSize: 16, lineHeight: 24 },
  label14: { fontSize: 14, lineHeight: 21 },
  caption12: { fontSize: 12, lineHeight: 18 },
  badge11: { fontSize: 11, lineHeight: 15 },
} as const;

/** 간격은 8·12·16·24·40, 아이콘과 글자 사이 같은 작은 틈에만 4. */
export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 40 } as const;

/** 포스터·썸네일 sm, 카드·칸 md, 창 lg, 버튼·메뉴·검색칸 pill, 배지 xs. */
export const radius = { xs: 3, sm: 4, md: 8, lg: 16, pill: 9999 } as const;
