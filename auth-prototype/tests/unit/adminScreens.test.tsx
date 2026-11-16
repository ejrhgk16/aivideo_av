/** @jest-environment jsdom */

import React from 'react';
import { Text } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import AdminLayout from '@/app/admin/_layout';
import AdminWebLayout from '@/app/admin/_layout.web';
import AdminLoginRoute from '@/app/admin/login';
import AdminProjectsRoute from '@/app/admin/index';
import AdminProjectRoute from '@/app/admin/projects/[projectId]';
import AdminCampaignRoute from '@/app/admin/campaigns/[campaignId]';
import AdminUploadRoute from '@/app/admin/upload';
import { ADMIN_METRICS, compareKpis, formatCount, steepestDrop, summarize } from '@/features/admin/adminMetrics';
import { ADMIN_SAMPLE_PROJECTS, ADMIN_SAMPLE_TODAY, findAdminCampaign } from '@/features/admin/adminSampleData';
import { ADMIN_SESSION_KEY } from '@/features/admin/adminSession';

jest.mock('@/components/AdminFilePicker', () => {
  const { Button } = require('@/components/ui');
  return {
    AdminFilePicker: ({ label, onPick }: { label: string; onPick: (file: { name: string; size: number }) => void }) =>
      <Button label={label} onPress={() => onPick({ name: `${label}.bin`, size: 5_242_880 })} />,
  };
});

const OPERATOR = 'operator@example.com';
beforeEach(() => sessionStorage.clear());

/** Mounts the web admin layout, signed in as OPERATOR unless `email` is null (like reloading a signed-in tab). */
function renderAdmin(initialUrl: string, email: string | null = OPERATOR) {
  if (email) sessionStorage.setItem(ADMIN_SESSION_KEY, email);
  return renderRouter({
    _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
    'admin/_layout': AdminWebLayout,
    'admin/login': AdminLoginRoute,
    'admin/index': AdminProjectsRoute,
    'admin/projects/[projectId]': AdminProjectRoute,
    'admin/campaigns/[campaignId]': AdminCampaignRoute,
    'admin/upload': AdminUploadRoute,
  }, { initialUrl });
}

/** Row labels read "<name>, <column> <value>, ..., <action>"; returns the names in display order. */
const rowNames = (pattern: RegExp) => screen.getAllByRole('button', { name: pattern })
  .map((row) => String(row.props.accessibilityLabel).split(', ')[0]);

test('project list shows the sample badge, every project, and re-sorts by a metric column', async () => {
  const user = userEvent.setup();
  renderAdmin('/admin');
  expect(await screen.findByRole('header', { name: '프로젝트 목록' })).toBeOnTheScreen();
  expect(screen.getByText('샘플 데이터')).toBeOnTheScreen();
  expect(rowNames(/상세 보기$/)).toEqual(ADMIN_SAMPLE_PROJECTS.map((project) => project.title));

  const range = compareKpis([], 28, ADMIN_SAMPLE_TODAY).range;
  const first = summarize(ADMIN_SAMPLE_PROJECTS[0].campaigns, range);
  expect(screen.getByRole('button', { name: new RegExp(`^${ADMIN_SAMPLE_PROJECTS[0].title}, `) }).props.accessibilityLabel)
    .toContain(`노출수 ${formatCount(first.impressions)}`);
  const byImpressions = [...ADMIN_SAMPLE_PROJECTS]
    .sort((a, b) => summarize(b.campaigns, range).impressions - summarize(a.campaigns, range).impressions)
    .map((project) => project.title);
  await user.press(screen.getByRole('button', { name: '노출수 기준 정렬' }));
  expect(rowNames(/상세 보기$/)).toEqual(byImpressions);
  await user.press(screen.getByRole('button', { name: '노출수, 내림차순 정렬됨' }));
  expect(rowNames(/상세 보기$/)).toEqual([...byImpressions].reverse());
  expect(screen.getByRole('button', { name: '노출수, 오름차순 정렬됨' })).toBeOnTheScreen();

  await user.press(screen.getByRole('tab', { name: '최근 7일' }));
  expect(screen.getByRole('tab', { name: '최근 7일' })).toBeSelected();
  expect(screen.getByText('2026.10.30 – 2026.11.05 (KST) · 증감은 이전 7일 대비')).toBeOnTheScreen();
});

test('project row opens its campaigns, and 캠페인 추가 preselects the project with the next episode number', async () => {
  const user = userEvent.setup();
  const project = ADMIN_SAMPLE_PROJECTS[0];
  renderAdmin('/admin');
  await user.press(await screen.findByRole('button', { name: new RegExp(`^${project.title}, .*상세 보기$`) }));
  expect(await screen.findByRole('header', { name: project.title })).toBeOnTheScreen();
  expect(rowNames(/대시보드 보기$/)).toEqual(project.campaigns.map((item) => `${item.episodeNumber}화 ${item.title}`));

  await user.press(screen.getByRole('button', { name: '캠페인 추가' }));
  expect(await screen.findByRole('header', { name: '업로드' })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: '기존 프로젝트에 캠페인 추가' })).toBeChecked();
  expect(screen.getByRole('radio', { name: project.title })).toBeChecked();
  expect(screen.getByLabelText('회차 번호')).toHaveDisplayValue(String(project.campaigns.length + 1));
});

test('campaign dashboard shows KPI values, the steepest drop, and metric definitions', async () => {
  const found = findAdminCampaign(ADMIN_SAMPLE_PROJECTS[1].campaigns[0].id)!;
  const { current } = compareKpis([found.campaign], 28, ADMIN_SAMPLE_TODAY);
  const drop = steepestDrop(found.campaign.retention)!;
  renderAdmin(`/admin/campaigns/${found.campaign.id}`);
  expect(await screen.findByRole('header', { name: `1화 ${found.campaign.title}` })).toBeOnTheScreen();
  expect(screen.getByText(formatCount(current.impressions))).toBeOnTheScreen();
  expect(screen.getByText(formatCount(current.views))).toBeOnTheScreen();
  expect(screen.getByText(`${drop.from}–${drop.to}% 구간에서 가장 많이 이탈 (−${Math.round(drop.drop * 100)}%p)`)).toBeOnTheScreen();
  expect(screen.getByText('지표 정의')).toBeOnTheScreen();
  expect(screen.getByText(ADMIN_METRICS.avgViewedRate.definition)).toBeOnTheScreen();
  expect(ADMIN_METRICS.avgViewedRate.definition).toContain('(시청률)');
  expect(screen.getByText(ADMIN_METRICS.retention.definition)).toBeOnTheScreen();
});

test('unreleased campaign shows dashes instead of NaN rates', async () => {
  const scheduled = ADMIN_SAMPLE_PROJECTS.find((project) => project.status === 'SCHEDULED')!.campaigns[0];
  renderAdmin(`/admin/campaigns/${scheduled.id}`);
  expect(await screen.findAllByText('아직 공개 전이라 시청 데이터가 없어요.')).toHaveLength(3);
  expect(screen.getByText(new RegExp(`^공개 예정 ${scheduled.releaseDate.replaceAll('-', '.')}`))).toBeOnTheScreen();
  expect(screen.getAllByText('–').length).toBeGreaterThanOrEqual(4);
  expect(screen.queryByText(/NaN|Infinity/)).not.toBeOnTheScreen();
});

test('upload validates required fields and shows a simulated success', async () => {
  const user = userEvent.setup();
  renderAdmin('/admin/upload');
  await user.press(await screen.findByRole('button', { name: '업로드 확인' }));
  for (const message of ['프로젝트 제목을 입력해 주세요.', '장르를 선택해 주세요.', '포스터 이미지를 선택해 주세요.',
    '캠페인 제목을 입력해 주세요.', '영상 파일을 선택해 주세요.', '공개 예정 일시를 YYYY-MM-DD HH:mm 형식으로 입력해 주세요.']) {
    expect(screen.getByText(message)).toBeOnTheScreen();
  }

  await user.type(screen.getByLabelText('프로젝트 제목'), '새 작품');
  await user.press(screen.getByRole('radio', { name: '로맨스' }));
  await user.press(screen.getByRole('button', { name: '포스터 이미지 선택' }));
  await user.type(screen.getByLabelText('캠페인 제목'), '첫 만남');
  await user.press(screen.getByRole('button', { name: '영상 파일 선택' }));
  expect(screen.getByText('영상 파일 선택.bin · 5.0 MB')).toBeOnTheScreen();
  await user.type(screen.getByLabelText('공개 예정 일시'), '2026/11/12');
  expect(screen.queryByText('프로젝트 제목을 입력해 주세요.')).not.toBeOnTheScreen();
  expect(screen.getByText('공개 예정 일시를 YYYY-MM-DD HH:mm 형식으로 입력해 주세요.')).toBeOnTheScreen();
  await user.clear(screen.getByLabelText('공개 예정 일시'));
  await user.type(screen.getByLabelText('공개 예정 일시'), '2026-11-12 18:00');

  await user.press(screen.getByRole('button', { name: '업로드 확인' }));
  expect(await screen.findByText('입력 확인을 마쳤어요')).toBeOnTheScreen();
  expect(screen.getByText('새 작품 · 1화 첫 만남 · 영상 파일 선택.bin')).toBeOnTheScreen();
  expect(screen.getByText(/실제로 업로드되거나 저장된 내용은 없어요/)).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: '프로젝트 목록으로' }));
  expect(await screen.findByRole('header', { name: '프로젝트 목록' })).toBeOnTheScreen();
});

test('daily chart selection resets when the range changes', async () => {
  const user = userEvent.setup();
  const campaign = ADMIN_SAMPLE_PROJECTS[0].campaigns[0];
  renderAdmin(`/admin/campaigns/${campaign.id}?range=90`);
  const chart = await screen.findByRole('image', { name: /^일별 조회수 그래프/ });
  fireEvent.press(chart.children[10] as ReactTestInstance);
  expect(screen.getByText(/^2026\.08\.18 · 조회수/)).toBeOnTheScreen();
  await user.press(screen.getByRole('tab', { name: '최근 7일' }));
  expect(screen.getByText(/^2026\.11\.05 · 조회수/)).toBeOnTheScreen();
});

test('upload rejects impossible or past dates and duplicate episode numbers, and summarizes errors at the button', async () => {
  const user = userEvent.setup();
  const project = ADMIN_SAMPLE_PROJECTS[0];
  renderAdmin(`/admin/upload?projectId=${project.id}`);
  expect(await screen.findByText('* 표시는 필수 항목이에요.')).toBeOnTheScreen();
  await user.clear(screen.getByLabelText('회차 번호'));
  await user.type(screen.getByLabelText('회차 번호'), '3');
  await user.type(screen.getByLabelText('공개 예정 일시'), '2026-02-31 10:00');
  await user.press(screen.getByRole('button', { name: '업로드 확인' }));
  expect(screen.getByText('이미 있는 회차 번호예요.')).toBeOnTheScreen();
  expect(screen.getByText('공개 예정 일시를 YYYY-MM-DD HH:mm 형식으로 입력해 주세요.')).toBeOnTheScreen();
  expect(screen.getByText('확인이 필요한 항목 4개: 회차 번호, 캠페인 제목, 영상 파일, 공개 예정 일시')).toBeOnTheScreen();

  await user.clear(screen.getByLabelText('공개 예정 일시'));
  await user.type(screen.getByLabelText('공개 예정 일시'), '2020-01-01 00:00');
  expect(screen.getByText(`공개 예정 일시는 기준일(${ADMIN_SAMPLE_TODAY}) 이후로 입력해 주세요.`)).toBeOnTheScreen();
});

test.each(['/admin/projects/missing', '/admin/campaigns/missing'])('unknown id %s shows an empty state linking back', async (url) => {
  const user = userEvent.setup();
  renderAdmin(url);
  await user.press(await screen.findByRole('button', { name: '프로젝트 목록으로' }));
  expect(await screen.findByRole('header', { name: '프로젝트 목록' })).toBeOnTheScreen();
});

test('signed-out visit lands on login, which validates after the first submit and signs in on Enter', async () => {
  const user = userEvent.setup();
  const view = renderAdmin('/admin/upload', null);
  expect(await screen.findByRole('header', { name: '관리자 로그인' })).toBeOnTheScreen();
  expect(view.getPathname()).toBe('/admin/login');
  expect(screen.getByText('시안 화면이에요. 이메일 형식과 8자 이상 비밀번호면 들어갈 수 있어요.')).toBeOnTheScreen();
  expect(screen.queryByText('이메일 형식으로 입력해 주세요.')).not.toBeOnTheScreen();

  await user.press(screen.getByRole('button', { name: '로그인' }));
  expect(screen.getByText('이메일 형식으로 입력해 주세요.')).toBeOnTheScreen();
  expect(screen.getByText('비밀번호는 8자 이상 입력해 주세요.')).toBeOnTheScreen();
  await user.type(screen.getByLabelText('이메일'), 'operator@example');
  await user.type(screen.getByLabelText('비밀번호'), 'short', { submitEditing: true });
  expect(screen.getByText('이메일 형식으로 입력해 주세요.')).toBeOnTheScreen();
  expect(screen.queryByRole('header', { name: '프로젝트 목록' })).not.toBeOnTheScreen();

  await user.type(screen.getByLabelText('이메일'), '.com');
  expect(screen.queryByText('이메일 형식으로 입력해 주세요.')).not.toBeOnTheScreen();
  await user.clear(screen.getByLabelText('비밀번호'));
  await user.type(screen.getByLabelText('비밀번호'), 'pass123', { submitEditing: true });
  expect(screen.getByText('비밀번호는 8자 이상 입력해 주세요.')).toBeOnTheScreen();
  expect(view.getPathname()).toBe('/admin/login');
  await user.type(screen.getByLabelText('비밀번호'), '4', { submitEditing: true });
  expect(await screen.findByRole('header', { name: '프로젝트 목록' })).toBeOnTheScreen();
  expect(view.getPathname()).toBe('/admin');
  expect(sessionStorage.getItem(ADMIN_SESSION_KEY)).toBe(OPERATOR);
  // The test window is narrower than 1024px, so the compact sidebar shows only the short logout label.
  expect(screen.getByRole('button', { name: '나가기 (로그아웃)' })).toHaveTextContent('나가기');
  expect(screen.queryByText(OPERATOR)).not.toBeOnTheScreen();
});

test('signed-in login visit goes to the list, and logout returns to login and clears the tab session', async () => {
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 1280, height: 800, scale: 1, fontScale: 1 });
  const user = userEvent.setup();
  const view = renderAdmin('/admin/login');
  expect(await screen.findByRole('header', { name: '프로젝트 목록' })).toBeOnTheScreen();
  expect(view.getPathname()).toBe('/admin');
  expect(screen.getByText(OPERATOR)).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: '로그아웃' }));
  expect(await screen.findByRole('header', { name: '관리자 로그인' })).toBeOnTheScreen();
  expect(view.getPathname()).toBe('/admin/login');
  expect(sessionStorage.getItem(ADMIN_SESSION_KEY)).toBeNull();
});

test('native admin layout redirects to the viewer home', async () => {
  renderRouter({
    _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
    index: () => <Text>홈 화면</Text>,
    'admin/_layout': AdminLayout,
    'admin/index': AdminProjectsRoute,
  }, { initialUrl: '/admin' });
  expect(await screen.findByText('홈 화면')).toBeOnTheScreen();
  expect(screen.queryByText('샘플 데이터')).not.toBeOnTheScreen();
});
