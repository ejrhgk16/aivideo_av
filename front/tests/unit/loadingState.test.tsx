import { render, screen } from '@testing-library/react-native';
import { colors } from '@/common/theme/tokens';
import { LoadingState } from '@/components/ui';

describe('LoadingState', () => {
  it('shows an accessible large spinner without visible loading copy by default', () => {
    render(<LoadingState />);

    const progress = screen.getByRole('progressbar', { name: '로딩 중' });

    expect(progress).toBeBusy();
    expect(screen.queryByText('로딩 중')).not.toBeOnTheScreen();
    expect(progress.props).toMatchObject({
      accessible: true,
      accessibilityRole: 'progressbar',
      accessibilityLabel: '로딩 중',
      accessibilityState: { busy: true },
      size: 'large',
      color: colors.accent,
    });
  });

  it('shows an accessible small spinner without visible loading copy in compact mode', () => {
    render(<LoadingState compact />);

    const progress = screen.getByRole('progressbar', { name: '로딩 중' });

    expect(progress).toBeBusy();
    expect(screen.queryByText('로딩 중')).not.toBeOnTheScreen();
    expect(progress.props).toMatchObject({
      accessible: true,
      accessibilityRole: 'progressbar',
      accessibilityLabel: '로딩 중',
      accessibilityState: { busy: true },
      size: 'small',
      color: colors.accent,
    });
  });
});
