import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { AppText, Button, Icon } from '@/components/ui';
import { AdminField, AdminPanel, AdminShell } from '@/components/adminUi';
import { AdminFilePicker, type AdminPickedFile } from '@/components/AdminFilePicker';
import { colors, typography } from '@/common/theme/tokens';
import type { AdminProject } from '@/features/admin/adminMetrics';
import { ADMIN_SAMPLE_PROJECTS, ADMIN_SAMPLE_TODAY, findAdminProject } from '@/features/admin/adminSampleData';

type Mode = 'new' | 'existing';
type FileKey = 'poster' | 'video' | 'cover';
type Form = {
  projectTitle: string; projectDescription: string; genre: string | null;
  episodeNumber: string | null; campaignTitle: string; price: string; releaseAt: string;
} & Record<FileKey, AdminPickedFile | null>;

const emptyForm: Form = {
  projectTitle: '', projectDescription: '', genre: null, poster: null,
  episodeNumber: null, campaignTitle: '', video: null, cover: null, price: '0', releaseAt: '',
};
const genres = ['로맨스', '스릴러', '미스터리', 'SF', '판타지'];
const fieldLabels: Record<keyof Form | 'project', string> = {
  projectTitle: '프로젝트 제목', projectDescription: '프로젝트 소개', genre: '장르', poster: '포스터 이미지', project: '프로젝트',
  episodeNumber: '회차 번호', campaignTitle: '캠페인 제목', video: '영상 파일', cover: '표지 이미지', price: '가격 포인트', releaseAt: '공개 예정 일시',
};
const HOUR_MS = 3_600_000;

function validate(mode: Mode, project: AdminProject | null, form: Form, episodeNumber: string) {
  const errors: Partial<Record<keyof Form | 'project', string>> = {};
  if (mode === 'new') {
    if (!form.projectTitle.trim()) errors.projectTitle = '프로젝트 제목을 입력해 주세요.';
    if (!form.genre) errors.genre = '장르를 선택해 주세요.';
    if (!form.poster) errors.poster = '포스터 이미지를 선택해 주세요.';
  } else if (!project) errors.project = '캠페인을 추가할 프로젝트를 선택해 주세요.';
  if (!/^[1-9]\d*$/.test(episodeNumber)) errors.episodeNumber = '회차 번호는 1 이상의 숫자로 입력해 주세요.';
  else if (project?.campaigns.some((item) => item.episodeNumber === Number(episodeNumber))) errors.episodeNumber = '이미 있는 회차 번호예요.';
  if (!form.campaignTitle.trim()) errors.campaignTitle = '캠페인 제목을 입력해 주세요.';
  if (!form.video) errors.video = '영상 파일을 선택해 주세요.';
  if (!/^\d+$/.test(form.price)) errors.price = '가격은 0 이상의 숫자로 입력해 주세요.';
  // Round-trip through KST so impossible dates such as 02-31 or 24:00 are rejected on every engine.
  const iso = form.releaseAt.replace(' ', 'T');
  const ms = Date.parse(`${iso}:00+09:00`);
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(form.releaseAt) || Number.isNaN(ms) || new Date(ms + 9 * HOUR_MS).toISOString().slice(0, 16) !== iso) {
    errors.releaseAt = '공개 예정 일시를 YYYY-MM-DD HH:mm 형식으로 입력해 주세요.';
  } else if (iso.slice(0, 10) < ADMIN_SAMPLE_TODAY) {
    errors.releaseAt = `공개 예정 일시는 기준일(${ADMIN_SAMPLE_TODAY}) 이후로 입력해 주세요.`;
  }
  return errors;
}

const formatFileSize = (size: number) => size >= 1_048_576 ? `${(size / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;

function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} {...props} style={styles.input} />;
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress}
    style={[styles.choice, selected && styles.choiceSelected]}>
    <AppText weight={selected ? 'semibold' : 'regular'} style={{ fontSize: 14, color: selected ? colors.background : colors.text }}>{label}</AppText>
  </Pressable>;
}

export function AdminUploadScreen({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const preset = findAdminProject(projectId);
  const [mode, setMode] = useState<Mode>(preset ? 'existing' : 'new');
  const [selectedId, setSelectedId] = useState(preset?.id);
  const [form, setForm] = useState(emptyForm);
  const [attempted, setAttempted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const project = mode === 'existing' ? findAdminProject(selectedId) : null;
  const episodeNumber = form.episodeNumber ?? String(project ? Math.max(...project.campaigns.map((item) => item.episodeNumber)) + 1 : 1);
  const errors = attempted ? validate(mode, project, form, episodeNumber) : {};
  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm((previous) => ({ ...previous, [key]: value }));
  const breadcrumb = [{ label: '프로젝트 목록', href: '/admin' as const }, { label: '업로드' }];

  const submit = () => {
    setAttempted(true);
    if (Object.keys(validate(mode, project, form, episodeNumber)).length === 0) setSubmitted(true);
  };

  if (submitted) return <AdminShell title="업로드" breadcrumb={breadcrumb} maxWidth={880}>
    <AdminPanel>
      <View style={styles.row}><Icon name="check-circle" color={colors.accent} />
        <AppText weight="bold" style={styles.successTitle}>입력 확인을 마쳤어요</AppText></View>
      <AppText>{`${project?.title ?? form.projectTitle.trim()} · ${episodeNumber}화 ${form.campaignTitle.trim()} · ${form.video?.name}`}</AppText>
      <AppText style={styles.muted}>프로토타입 화면이라 실제로 업로드되거나 저장된 내용은 없어요. 다른 화면으로 이동하면 입력값도 사라져요.</AppText>
      <View style={[styles.row, styles.wrap]}>
        <Button label="프로젝트 목록으로" onPress={() => router.push('/admin')} />
        {project ? <Button label="프로젝트로 돌아가기" variant="secondary"
          onPress={() => router.push({ pathname: '/admin/projects/[projectId]', params: { projectId: project.id } })} /> : null}
        <Button label="다시 입력하기" variant="ghost" onPress={() => { setForm(emptyForm); setAttempted(false); setSubmitted(false); }} />
      </View>
    </AdminPanel>
  </AdminShell>;

  const fileField = (key: FileKey, label: string, accept: string, required: boolean) => {
    const file = form[key];
    return <AdminField label={label} required={required} error={errors[key]}>
      <View style={[styles.row, styles.wrap]}>
        <AdminFilePicker label={`${label} 선택`} accept={accept} onPick={(picked) => update(key, picked)} />
        <AppText style={styles.muted}>{file ? `${file.name} · ${formatFileSize(file.size)}` : '선택한 파일 없음'}</AppText>
      </View>
    </AdminField>;
  };

  const errorKeys = Object.keys(errors) as (keyof typeof fieldLabels)[];
  return <AdminShell title="업로드" breadcrumb={breadcrumb} maxWidth={880}>
    <AppText style={styles.muted}>* 표시는 필수 항목이에요.</AppText>
    <View accessibilityRole="radiogroup" accessibilityLabel="업로드 유형" style={[styles.row, styles.wrap]}>
      <Choice label="새 프로젝트" selected={mode === 'new'} onPress={() => setMode('new')} />
      <Choice label="기존 프로젝트에 캠페인 추가" selected={mode === 'existing'} onPress={() => setMode('existing')} />
    </View>
    <AdminPanel title="프로젝트">
      {mode === 'new' ? <>
        <AdminField label="제목" required error={errors.projectTitle}>
          <Input accessibilityLabel="프로젝트 제목" value={form.projectTitle} onChangeText={(value) => update('projectTitle', value)} placeholder="예: 마지막 신호" />
        </AdminField>
        <AdminField label="소개">
          <Input accessibilityLabel="프로젝트 소개" value={form.projectDescription} onChangeText={(value) => update('projectDescription', value)} multiline />
        </AdminField>
        <AdminField label="장르" required error={errors.genre}>
          <View accessibilityRole="radiogroup" accessibilityLabel="장르" style={[styles.row, styles.wrap]}>
            {genres.map((genre) => <Choice key={genre} label={genre} selected={form.genre === genre} onPress={() => update('genre', genre)} />)}
          </View>
        </AdminField>
        {fileField('poster', '포스터 이미지', 'image/*', true)}
      </> : <AdminField label="프로젝트" required error={errors.project}>
        <View accessibilityRole="radiogroup" accessibilityLabel="프로젝트" style={[styles.row, styles.wrap]}>
          {ADMIN_SAMPLE_PROJECTS.map((item) => <Choice key={item.id} label={item.title} selected={project?.id === item.id}
            onPress={() => { setSelectedId(item.id); update('episodeNumber', null); }} />)}
        </View>
      </AdminField>}
    </AdminPanel>
    <AdminPanel title="캠페인">
      <AdminField label="회차 번호" required error={errors.episodeNumber}>
        <Input accessibilityLabel="회차 번호" value={episodeNumber} onChangeText={(value) => update('episodeNumber', value)} keyboardType="number-pad" />
      </AdminField>
      <AdminField label="캠페인 제목" required error={errors.campaignTitle}>
        <Input accessibilityLabel="캠페인 제목" value={form.campaignTitle} onChangeText={(value) => update('campaignTitle', value)} />
      </AdminField>
      {fileField('video', '영상 파일', 'video/*', true)}
      {fileField('cover', '표지 이미지', 'image/*', false)}
      <AdminField label="가격 포인트" required error={errors.price} hint="0이면 무료 회차예요.">
        <Input accessibilityLabel="가격 포인트" value={form.price} onChangeText={(value) => update('price', value)} keyboardType="number-pad" />
      </AdminField>
      <AdminField label="공개 예정 일시" required error={errors.releaseAt} hint="YYYY-MM-DD HH:mm (KST)">
        <Input accessibilityLabel="공개 예정 일시" value={form.releaseAt} onChangeText={(value) => update('releaseAt', value)} placeholder="2026-11-12 18:00" />
      </AdminField>
    </AdminPanel>
    <View style={[styles.row, styles.wrap]}>
      <Button label="업로드 확인" onPress={submit} style={styles.submit} />
      {errorKeys.length ? <AppText accessibilityLiveRegion="polite" style={styles.errorSummary}>
        {`확인이 필요한 항목 ${errorKeys.length}개: ${errorKeys.map((key) => fieldLabels[key]).join(', ')}`}
      </AppText> : null}
    </View>
  </AdminShell>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexWrap: 'wrap' },
  muted: { fontSize: 13, lineHeight: 20, color: colors.muted },
  successTitle: { fontSize: 19 },
  input: { minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
    color: colors.text, fontFamily: typography.regular, fontSize: 15, paddingHorizontal: 12, paddingVertical: 10 },
  choice: { minHeight: 38, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  choiceSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  submit: { alignSelf: 'flex-start' },
  errorSummary: { flexShrink: 1, fontSize: 13, lineHeight: 20, color: colors.danger },
});
