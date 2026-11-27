import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps, ReactNode, Ref } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
  type ImageStyle, type StyleProp, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, textSizes, typography } from '@/common/theme/tokens';
import { createThemedStyles, useColors } from '@/common/theme/theme';

export function AppText({ weight = 'regular', style, ...props }: TextProps & { weight?: keyof typeof typography }) {
  const styles = useStyles();
  const flat: TextStyle = StyleSheet.flatten([styles.text, style]);
  // 한글 자간은 제 글자 크기의 -0.02em. 로고·순위 숫자처럼 따로 정한 곳은 style의 값을 그대로 쓴다.
  const letterSpacing = flat.letterSpacing ?? -0.02 * (flat.fontSize ?? textSizes.body16.fontSize);
  return <Text {...props} style={[styles.text, { fontFamily: typography[weight], letterSpacing }, style]} />;
}

export type IconName = ComponentProps<typeof Feather>['name'];
export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const colors = useColors();
  return <Feather name={name} size={size} color={color ?? colors.text} />;
}

/** primary는 노른자 노랑 주 버튼이다. 화면마다 가장 중요한 행동 하나에만 쓴다. */
export function Button({ label, onPress, variant = 'primary', disabled, icon, style }: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean; icon?: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, styles[variant], disabled && styles.disabled, pressed && styles.pressed, style]}>
      {icon}
      <AppText weight={variant === 'primary' ? 'bold' : 'semibold'}
        style={variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel}>{label}</AppText>
    </Pressable>
  );
}

export function Page({ children, header, scroll = true, style, contentStyle, scrollRef }: {
  children: ReactNode; header?: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>;
  scrollRef?: Ref<ScrollView>;
}) {
  const styles = useStyles();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.page, style]}>
      {header}
      {scroll ? <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, contentStyle]}>{children}</ScrollView>
        : <View style={[styles.content, { flex: 1 }, contentStyle]}>{children}</View>}
    </SafeAreaView>
  );
}

/** 구역 제목(18·700). 제목 위에 영문 머리글을 얹지 않는다. */
export function SectionTitle({ title, action, onAction }: {
  title: string; action?: string; onAction?: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  return <View style={styles.heading}>
    <AppText weight="bold" accessibilityRole="header" style={styles.headingTitle}>{title}</AppText>
    {action ? <Pressable onPress={onAction} accessibilityRole="button" style={styles.textAction}><AppText weight="medium" style={styles.meta}>{action}</AppText><Icon name="chevron-right" size={16} color={colors.muted} /></Pressable> : null}
  </View>;
}

export function EmptyState({ title, description, action, onAction }: {
  title: string; description: string; action?: string; onAction?: () => void;
}) {
  const styles = useStyles();
  return <View style={styles.empty}><Peeka slot="empty" size={96} /><AppText weight="bold" style={styles.emptyTitle}>{title}</AppText><AppText style={styles.emptyCopy}>{description}</AppText>{action && onAction ? <Button label={action} onPress={onAction} /> : null}</View>;
}

// 자리마다 그림 파일을 따로 둔다. 그림을 바꾸려면 assets/images/peeka/의 같은 이름 파일만 교체한다.
const peekaImages = {
  logo: require('../../assets/images/peeka/logo.png'),
  strip: require('../../assets/images/peeka/strip.png'),
  loading: require('../../assets/images/peeka/loading.png'),
  loadingEgg: require('../../assets/images/peeka/loading-egg.png'),
  empty: require('../../assets/images/peeka/empty.png'),
  locked: require('../../assets/images/peeka/locked.png'),
};

/** peeka 마스코트(알에서 빼꼼 내다보는 병아리). 장식이라 스크린리더에서는 숨긴다. */
export function Peeka({ slot, size, style }: { slot: keyof typeof peekaImages; size: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={peekaImages[slot]} accessible={false} aria-hidden contentFit="contain" style={[{ width: size, height: size }, style]} />;
}

export function LoadingState({ compact = false }: { compact?: boolean }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={compact ? styles.loadingCompact : styles.loading}>
      <ActivityIndicator accessible accessibilityRole="progressbar"
        accessibilityLabel="로딩 중" accessibilityState={{ busy: true }}
        size={compact ? 'small' : 'large'} color={colors.accent} />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  text: { color: colors.text, ...textSizes.body16 },
  page: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  button: { minHeight: 48, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  primary: { backgroundColor: colors.yolk },
  secondary: { backgroundColor: colors.elevated, paddingHorizontal: spacing.md },
  ghost: { backgroundColor: 'transparent', paddingHorizontal: spacing.md },
  primaryLabel: { color: colors.onYolk, ...textSizes.body16 },
  secondaryLabel: { color: colors.text, ...textSizes.label14 },
  disabled: { opacity: 0.45 }, pressed: { opacity: 0.72 },
  meta: { ...textSizes.label14, color: colors.muted },
  heading: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  headingTitle: { flex: 1, ...textSizes.body18 },
  textAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, minHeight: 44 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyTitle: { ...textSizes.body18, textAlign: 'center' },
  emptyCopy: { ...textSizes.label14, color: colors.muted, textAlign: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingCompact: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },
}));
