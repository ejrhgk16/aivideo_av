import Feather from '@expo/vector-icons/Feather';
import { Image, type ImageProps } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
  type StyleProp, type TextProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Drama } from '@/features/drama/catalog';
import { colors, typography } from '@/theme/tokens';

export function AppText({ weight = 'regular', style, ...props }: TextProps & { weight?: keyof typeof typography }) {
  return <Text {...props} style={[styles.text, { fontFamily: typography[weight] }, style]} />;
}

export type IconName = ComponentProps<typeof Feather>['name'];
export function Icon({ name, size = 22, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}

export function Button({ label, onPress, variant = 'primary', disabled, icon, style }: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean; icon?: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, styles[variant], disabled && styles.disabled, pressed && styles.pressed, style]}>
      {icon}
      <AppText weight="semibold" style={{ color: variant === 'primary' ? colors.background : colors.text }}>{label}</AppText>
    </Pressable>
  );
}

export function Page({ children, scroll = true, style, contentStyle }: {
  children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.page, style]}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, contentStyle]}>{children}</ScrollView>
        : <View style={[styles.content, { flex: 1 }, contentStyle]}>{children}</View>}
    </SafeAreaView>
  );
}

const artwork = {
  signal: require('../../assets/images/signal.jpg'),
  season: require('../../assets/images/season.jpg'),
  moon: require('../../assets/images/moon.jpg'),
};

export function DramaImage({ drama, style, ...props }: Omit<ImageProps, 'source'> & { drama: Drama }) {
  return <Image source={artwork[drama.id]} accessibilityLabel={`${drama.title} 표지`} contentFit="cover" transition={180} {...props} style={style} />;
}

export function Poster({ drama, width = 148, onPress }: { drama: Drama; width?: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${drama.title} 작품 소개`} style={{ width, gap: 10 }}>
      <View style={[styles.poster, { height: width * 1.48 }]}>
        <DramaImage drama={drama} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['transparent', '#000000CC']} style={StyleSheet.absoluteFill} />
        <View style={styles.badge}><AppText weight="medium" style={styles.badgeText}>{drama.badge}</AppText></View>
        <View style={styles.posterTitle}><AppText style={styles.english}>{drama.english}</AppText><AppText weight="bold" style={styles.title}>{drama.title}</AppText></View>
      </View>
      <AppText weight="semibold" numberOfLines={1}>{drama.title}</AppText>
      <AppText style={styles.meta}>{drama.tag} · {drama.free}화 무료</AppText>
    </Pressable>
  );
}

export function SectionTitle({ title, eyebrow, action, onAction }: {
  title: string; eyebrow?: string; action?: string; onAction?: () => void;
}) {
  return <View style={styles.heading}><View style={{ flex: 1, gap: 7 }}>
    {eyebrow ? <AppText weight="medium" style={styles.eyebrow}>{eyebrow}</AppText> : null}
    <AppText weight="bold" style={styles.headingTitle}>{title}</AppText>
  </View>{action ? <Pressable onPress={onAction} accessibilityRole="button" style={styles.textAction}><AppText style={styles.meta}>{action}</AppText><Icon name="chevron-right" size={16} color={colors.muted} /></Pressable> : null}</View>;
}

export function EmptyState({ title, description, action, onAction }: {
  title: string; description: string; action?: string; onAction?: () => void;
}) {
  return <View style={styles.empty}><Icon name="film" size={30} color={colors.muted} /><AppText weight="semibold" style={styles.emptyTitle}>{title}</AppText><AppText style={styles.emptyCopy}>{description}</AppText>{action && onAction ? <Button label={action} onPress={onAction} /> : null}</View>;
}

const styles = StyleSheet.create({
  text: { color: colors.text, fontSize: 16, lineHeight: 24, letterSpacing: -0.35 },
  page: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: 22, paddingBottom: 36, gap: 24 },
  button: { minHeight: 50, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.38 }, pressed: { opacity: 0.72 },
  poster: { overflow: 'hidden', borderRadius: 14, borderCurve: 'continuous', backgroundColor: colors.surface },
  badge: { position: 'absolute', top: 10, left: 10, backgroundColor: '#0B0C0FC0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  badgeText: { fontSize: 11, lineHeight: 17 },
  posterTitle: { position: 'absolute', bottom: 16, left: 12, right: 10, gap: 4 },
  english: { fontSize: 8, lineHeight: 12, letterSpacing: 1.2, color: '#E8E5DA' },
  title: { fontSize: 22, lineHeight: 29, letterSpacing: -0.9 },
  meta: { fontSize: 13, lineHeight: 19, color: colors.muted },
  heading: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  headingTitle: { fontSize: 23, lineHeight: 31, letterSpacing: -0.7 },
  eyebrow: { color: colors.muted, fontSize: 10, lineHeight: 15, letterSpacing: 1.8 },
  textAction: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 18 },
  emptyTitle: { fontSize: 20, lineHeight: 28, textAlign: 'center' },
  emptyCopy: { color: colors.muted, textAlign: 'center' },
});
