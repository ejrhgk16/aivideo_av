import { Fragment, useState, type ReactNode } from 'react';
import { useLocalSearchParams, usePathname, useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppText, Icon } from '@/components/ui';
import { colors } from '@/common/theme/tokens';
import {
  ADMIN_METRICS, ADMIN_RANGES, formatCount, formatDate, formatKpi, formatRate, kpiDelta,
  type AdminDateRange, type AdminKpiKey, type AdminKpis, type AdminMetricKey, type AdminRangeDays,
} from '@/features/admin/adminMetrics';
import { useAdminSession } from '@/features/admin/adminSession';

const nav = [
  { href: '/admin', label: '프로젝트 목록', short: '목록', icon: 'grid' },
  { href: '/admin/upload', label: '새 업로드', short: '업로드', icon: 'upload' },
] as const;

export function AdminShell({ title, breadcrumb = [], actions, maxWidth = 1280, children }: {
  title: string; breadcrumb?: { label: string; href?: Href }[]; actions?: ReactNode; maxWidth?: number; children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { range } = useLocalSearchParams<{ range?: string }>();
  const compact = useWindowDimensions().width < 1024;
  const { email, signOut } = useAdminSession();
  return <View style={styles.shell}>
    <View style={[styles.sidebar, compact && styles.sidebarCompact]}>
      <AppText weight="bold" style={styles.brand}>{compact ? 'AD' : 'AI DRAMA 관리자'}</AppText>
      {nav.map((item) => {
        const active = (pathname === '/admin/upload') === (item.href === '/admin/upload');
        const href: Href = item.href === '/admin' && range ? { pathname: '/admin', params: { range } } : item.href;
        return <Pressable key={item.href} accessibilityRole="link" accessibilityLabel={item.label} accessibilityState={{ selected: active }}
          onPress={() => router.push(href)} style={[styles.navItem, compact && styles.navItemCompact, active && styles.navActive]}>
          <Icon name={item.icon} size={18} color={active ? colors.accent : colors.muted} />
          <AppText weight="medium" style={[{ color: active ? colors.text : colors.muted }, compact && styles.navShort]}>{compact ? item.short : item.label}</AppText>
        </Pressable>;
      })}
      <View style={styles.sidebarSpacer} />
      {compact ? null : <AppText numberOfLines={1} style={[styles.small, styles.account]}>{email}</AppText>}
      <Pressable accessibilityRole="button" accessibilityLabel={compact ? '나가기 (로그아웃)' : '로그아웃'} onPress={signOut} style={[styles.navItem, compact && styles.navItemCompact]}>
        <Icon name="log-out" size={18} color={colors.muted} />
        <AppText weight="medium" style={[{ color: colors.muted }, compact && styles.navShort]}>{compact ? '나가기' : '로그아웃'}</AppText>
      </Pressable>
    </View>
    <ScrollView style={styles.main} contentContainerStyle={[styles.mainContent, { maxWidth }]}>
      <View style={styles.top}>
        <View style={styles.topCopy}>
          {breadcrumb.length ? <View style={styles.row}>{breadcrumb.map((crumb, index) => <Fragment key={crumb.label}>
            {index ? <Icon name="chevron-right" size={14} color={colors.muted} /> : null}
            {crumb.href ? <Pressable accessibilityRole="link" onPress={() => router.push(crumb.href!)}>
              <AppText style={styles.crumbLink}>{crumb.label}</AppText>
            </Pressable> : <AppText style={styles.muted}>{crumb.label}</AppText>}
          </Fragment>)}</View> : null}
          <AppText weight="bold" accessibilityRole="header" style={styles.title}>{title}</AppText>
        </View>
        {actions}
      </View>
      <View style={styles.banner}>
        <View style={styles.badge}><AppText weight="semibold" style={styles.badgeText}>샘플 데이터</AppText></View>
        <AppText style={styles.bannerCopy}>수집·업로드 기능을 연결하기 전 시안이에요. 수치와 목록은 예시이고, 선택한 파일은 전송되지 않아요.</AppText>
      </View>
      {children}
    </ScrollView>
  </View>;
}

export function AdminPanel({ title, caption, children }: { title?: string; caption?: string; children: ReactNode }) {
  return <View style={styles.panel}>
    {title ? <View style={styles.panelHead}>
      <AppText weight="semibold" style={styles.panelTitle}>{title}</AppText>
      {caption ? <AppText style={styles.small}>{caption}</AppText> : null}
    </View> : null}
    {children}
  </View>;
}

export function AdminRangeTabs({ value, range, onChange }: {
  value: AdminRangeDays; range: AdminDateRange; onChange: (days: AdminRangeDays) => void;
}) {
  return <View style={[styles.row, styles.wrap]}>
    <View accessibilityRole="tablist" style={styles.tabs}>{ADMIN_RANGES.map((days) => {
      const selected = days === value;
      return <Pressable key={days} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(days)}
        style={[styles.tab, selected && styles.tabActive]}>
        <AppText weight={selected ? 'semibold' : 'regular'} style={[styles.tabLabel, selected && { color: colors.text }]}>{`최근 ${days}일`}</AppText>
      </Pressable>;
    })}</View>
    <AppText style={styles.small}>{`${formatDate(range.start)} – ${formatDate(range.end)} (KST) · 증감은 이전 ${value}일 대비`}</AppText>
  </View>;
}

export function AdminKpiGrid({ keys, current, previous, days }: {
  keys: AdminKpiKey[]; current: AdminKpis; previous: AdminKpis | null; days: number;
}) {
  return <View style={[styles.row, styles.wrap, styles.kpiGrid]}>{keys.map((key) => {
    const delta = previous && kpiDelta(key, current, previous);
    const text = !delta ? '비교 데이터 없음' : delta.tone === 'flat' ? delta.text : `${delta.text} ${delta.tone === 'good' ? '개선' : '악화'}`;
    return <View key={key} style={[styles.kpiCard, { flexBasis: keys.length > 5 ? 145 : 180 }]}>
      <AppText style={styles.muted}>{ADMIN_METRICS[key].label}</AppText>
      <AppText weight="bold" style={styles.kpiValue}>{formatKpi(key, current)}</AppText>
      <AppText accessibilityLabel={`이전 ${days}일 대비 ${text.replace('▲', '증가').replace('▼', '감소')}`}
        style={[styles.small, delta && delta.tone !== 'flat' && { color: delta.tone === 'good' ? colors.accent : colors.danger }]}>
        {text}
      </AppText>
    </View>;
  })}</View>;
}

export type AdminColumn<T> = {
  key: string; label: string; width: number; render: (row: T) => ReactNode; sortValue?: (row: T) => number | null;
  /** Takes the spare row width (title columns). */ flex?: boolean; align?: 'right';
};

/** rowLabel names the row; the screen-reader label adds every text cell and ends with rowAction. */
export function AdminTable<T>({ columns, rows, rowKey, rowLabel, rowAction, onRowPress }: {
  columns: AdminColumn<T>[]; rows: T[]; rowKey: (row: T) => string; rowLabel: (row: T) => string; rowAction: string; onRowPress: (row: T) => void;
}) {
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);
  const sortValue = columns.find((column) => column.key === sort?.key)?.sortValue;
  const sorted = sort && sortValue ? [...rows].sort((a, b) => {
    const left = sortValue(a), right = sortValue(b);
    if (left === null || right === null) return (left === null ? 1 : 0) - (right === null ? 1 : 0);
    return sort.desc ? right - left : left - right;
  }) : rows;
  const minWidth = columns.reduce((total, column) => total + column.width, 0);
  const cell = (column: AdminColumn<T>) => [styles.cell, column.flex ? { flex: 1, minWidth: column.width } : { width: column.width }];
  const label = (row: T) => [rowLabel(row), ...columns.flatMap((column) => {
    const value = column.render(row);
    return typeof value === 'string' ? [`${column.label} ${value}`] : [];
  }), rowAction].join(', ');
  return <ScrollView horizontal contentContainerStyle={styles.tableScroll}>
    <View style={{ flex: 1, minWidth }}>
      <View style={[styles.tableRow, styles.tableHead]}>{columns.map((column) => {
        const active = sort?.key === column.key;
        const headAlign = column.align === 'right' && styles.headRight;
        return column.sortValue
          ? <Pressable key={column.key} accessibilityRole="button" accessibilityState={{ selected: active }}
            accessibilityLabel={active ? `${column.label}, ${sort.desc ? '내림차순' : '오름차순'} 정렬됨` : `${column.label} 기준 정렬`}
            onPress={() => setSort({ key: column.key, desc: active ? !sort.desc : true })} style={[cell(column), styles.headCell, headAlign]}>
            <AppText weight="medium" style={[styles.small, active && { color: colors.text }]}>{column.label}</AppText>
            <Icon name={active && !sort.desc ? 'arrow-up' : 'arrow-down'} size={13} color={active ? colors.accent : colors.muted} />
          </Pressable>
          : <View key={column.key} style={[cell(column), styles.headCell, headAlign]}><AppText weight="medium" style={styles.small}>{column.label}</AppText></View>;
      })}</View>
      {sorted.map((row) => <Pressable key={rowKey(row)} accessibilityRole="button" accessibilityLabel={label(row)}
        onPress={() => onRowPress(row)} style={({ pressed }) => [styles.tableRow, pressed && { backgroundColor: colors.elevated }]}>
        {columns.map((column) => {
          const value = column.render(row);
          return <View key={column.key} style={cell(column)}>
            {typeof value === 'string' ? <AppText style={[styles.cellText, column.align === 'right' && styles.textRight]} numberOfLines={1}>{value}</AppText> : value}
          </View>;
        })}
      </Pressable>)}
    </View>
  </ScrollView>;
}

export function AdminBarChart({ bars }: { bars: { label: string; value: number; marker: number | null; summary: string }[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const active = bars[selected ?? bars.length - 1];
  const maxValue = Math.max(0, ...bars.map((bar) => bar.value));
  const rates = bars.flatMap((bar) => bar.marker === null ? [] : [bar.marker]);
  const maxMarker = Math.max(0, ...rates);
  const peak = bars.find((bar) => bar.value === maxValue);
  const total = bars.reduce((sum, bar) => sum + bar.value, 0);
  return <View style={styles.chart}>
    <AppText weight="medium" style={styles.small}>{active?.summary}</AppText>
    <View style={[styles.row, styles.between]}>
      <AppText style={styles.small}>{`조회수 축 0 – ${formatCount(maxValue)}`}</AppText>
      <AppText style={styles.small}>{`조회율 축 0 – ${rates.length ? formatRate(maxMarker) : '–'}`}</AppText>
    </View>
    <View accessible accessibilityRole="image" style={styles.bars}
      accessibilityLabel={`일별 조회수 그래프. 기간 합계 ${formatCount(total)}회${peak ? `, 최고 ${peak.label} ${formatCount(peak.value)}회` : ''}`}>
      {bars.map((bar, index) => <Pressable key={bar.label} tabIndex={-1} onPress={() => setSelected(index)}
        onHoverIn={() => setSelected(index)} onHoverOut={() => setSelected(null)} style={styles.barSlot}>
        <View style={[styles.bar, { height: `${maxValue ? (bar.value / maxValue) * 100 : 0}%` }, bar === active && { backgroundColor: colors.accent }]} />
        {bar.marker === null ? null : <View style={[styles.marker, { bottom: `${maxMarker ? (bar.marker / maxMarker) * 100 : 0}%` }]} />}
      </Pressable>)}
    </View>
    <View style={[styles.row, styles.between]}>
      {[bars[0], bars[Math.floor(bars.length / 2)], bars[bars.length - 1]].map((bar, index) => <AppText key={index} style={styles.small}>{bar?.label}</AppText>)}
    </View>
    <AppText style={styles.small}>막대 = 조회수(왼쪽 축) · 점 = 조회율(오른쪽 축, 기간 최대값이 맨 위)</AppText>
  </View>;
}

export function AdminRetentionChart({ points, highlight }: { points: number[]; highlight?: { from: number; to: number } }) {
  const label = [25, 50, 75, 100].map((point) => `${point}% 지점 ${formatRate(points[point / 5] ?? null)}`).join(', ');
  return <View style={styles.chart}>
    <View style={styles.plot}>
      <View style={styles.yAxis}>{['100%', '50%', '0%'].map((tick) => <AppText key={tick} style={styles.small}>{tick}</AppText>)}</View>
      <View accessible accessibilityRole="image" accessibilityLabel={`구간 이탈 곡선. ${label}`} style={[styles.bars, styles.plotArea]}>{points.map((value, index) => {
        const point = index * 5;
        const hot = highlight && (point === highlight.from || point === highlight.to);
        return <View key={point} style={styles.barSlot}>
          <View style={[styles.bar, { height: `${value * 100}%` }, hot && { backgroundColor: colors.danger }]} />
        </View>;
      })}</View>
    </View>
    <View style={[styles.row, styles.between, styles.xAxis]}>
      {['0%', '25%', '50%', '75%', '100%'].map((tick) => <AppText key={tick} style={styles.small}>{tick}</AppText>)}
    </View>
    <AppText style={[styles.small, styles.xAxis]}>가로 = 재생 위치(회차 길이 대비) · 세로 = 아직 시청 중인 조회 비율</AppText>
  </View>;
}

export function AdminMeter({ label, value }: { label: string; value: number | null }) {
  return <View style={styles.meter}>
    <AppText style={[styles.muted, styles.meterLabel]}>{label}</AppText>
    <View style={styles.meterTrack}><View style={[styles.meterFill, { width: `${(value ?? 0) * 100}%` }]} /></View>
    <AppText weight="semibold" style={styles.meterValue}>{formatRate(value)}</AppText>
  </View>;
}

export function AdminMetricDefinitions({ keys }: { keys: AdminMetricKey[] }) {
  return <AdminPanel title="지표 정의">{keys.map((key) => <View key={key} style={styles.definition}>
    <AppText weight="semibold" style={styles.definitionLabel}>{ADMIN_METRICS[key].label}</AppText>
    <AppText style={[styles.muted, { flex: 1 }]}>{ADMIN_METRICS[key].definition}</AppText>
  </View>)}</AdminPanel>;
}

export function AdminField({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: ReactNode;
}) {
  return <View style={styles.field}>
    <AppText weight="medium">{label}{required ? <AppText style={{ color: colors.danger }}> *</AppText> : null}</AppText>
    {children}
    {error ? <AppText accessibilityLiveRegion="polite" style={[styles.small, { color: colors.danger }]}>{error}</AppText>
      : hint ? <AppText style={styles.small}>{hint}</AppText> : null}
  </View>;
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  sidebar: { width: 220, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border, padding: 16, gap: 6 },
  sidebarCompact: { width: 72, alignItems: 'center' },
  brand: { fontSize: 15, paddingVertical: 14, color: colors.accent },
  navItem: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 10 },
  navItemCompact: { flexDirection: 'column', justifyContent: 'center', gap: 2, paddingHorizontal: 4, paddingVertical: 6 },
  navShort: { fontSize: 11, lineHeight: 14 },
  navActive: { backgroundColor: colors.elevated },
  sidebarSpacer: { flex: 1 },
  account: { paddingHorizontal: 12 },
  main: { flex: 1 },
  mainContent: { width: '100%', alignSelf: 'center', padding: 28, gap: 20 },
  top: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' },
  topCopy: { flex: 1, minWidth: 240, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexWrap: 'wrap' },
  between: { justifyContent: 'space-between' },
  crumbLink: { fontSize: 13, color: colors.muted, textDecorationLine: 'underline' },
  muted: { fontSize: 13, lineHeight: 20, color: colors.muted },
  small: { fontSize: 12, lineHeight: 18, color: colors.muted },
  title: { fontSize: 26, lineHeight: 34, letterSpacing: -0.7 },
  banner: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#CBF46A40', backgroundColor: '#1C2416' },
  badge: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, lineHeight: 18, color: colors.background },
  bannerCopy: { fontSize: 13, lineHeight: 20, color: '#C5D3A8', flexShrink: 1 },
  panel: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 14 },
  panelHead: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 },
  panelTitle: { fontSize: 17 },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4 },
  tab: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 9 },
  tabActive: { backgroundColor: colors.elevated },
  tabLabel: { fontSize: 13, color: colors.muted },
  kpiGrid: { alignItems: 'stretch', gap: 12 },
  kpiCard: { flexGrow: 1, flexBasis: 180, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 4 },
  kpiValue: { fontSize: 26, lineHeight: 34, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  tableScroll: { flexGrow: 1 },
  tableRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableHead: { minHeight: 40 },
  headCell: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headRight: { justifyContent: 'flex-end' },
  cell: { paddingHorizontal: 10 },
  cellText: { fontSize: 14, fontVariant: ['tabular-nums'] },
  textRight: { textAlign: 'right' },
  chart: { gap: 8 },
  plot: { flexDirection: 'row', gap: 8 },
  plotArea: { flex: 1 },
  yAxis: { width: 40, height: 180, justifyContent: 'space-between', alignItems: 'flex-end' },
  xAxis: { marginLeft: 48 },
  bars: { height: 180, flexDirection: 'row', alignItems: 'flex-end', gap: 2, borderBottomWidth: 1, borderBottomColor: colors.border },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { backgroundColor: '#5C6B45', borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 1 },
  marker: { position: 'absolute', alignSelf: 'center', width: 6, height: 6, marginBottom: -3, borderRadius: 3, backgroundColor: colors.text },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meterLabel: { width: 72 },
  meterTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.elevated, overflow: 'hidden' },
  meterFill: { height: '100%', backgroundColor: colors.accent },
  meterValue: { width: 60, textAlign: 'right', fontSize: 14 },
  definition: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  definitionLabel: { width: 120, fontSize: 14 },
  field: { gap: 8 },
});
