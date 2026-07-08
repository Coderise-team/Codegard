import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const { useUserStats } = vi.hoisted(() => ({ useUserStats: vi.fn() }));
vi.mock('../../hooks/useUserStats', () => ({ useUserStats }));

import StatsStrip from './StatsStrip';

const values = (container) =>
  [...container.querySelectorAll('.stat .sv')].map((n) => n.textContent);

beforeEach(() => {
  useUserStats.mockReset();
});

describe('StatsStrip', () => {
  it('shows "—" placeholders until the stats load', () => {
    useUserStats.mockReturnValue({ data: null });

    const { container } = render(<StatsStrip username="alice" />);

    expect(values(container)).toEqual(['—', '—', '—']);
  });

  it('formats the loaded core stats', () => {
    useUserStats.mockReturnValue({
      data: { solved: 12, contests: 4, acceptance: 67 },
    });

    const { container } = render(<StatsStrip username="alice" />);

    expect(values(container)).toEqual(['12', '4', '67%']);
  });

  it('appends pre-formatted extraStats after the core cards', () => {
    useUserStats.mockReturnValue({
      data: { solved: 1, contests: 2, acceptance: 3 },
    });

    const { container } = render(
      <StatsStrip
        username="alice"
        extraStats={[
          { key: 'streak', label: 'Max streak', icon: 'flame', value: '9 d' },
        ]}
      />
    );

    expect(values(container)).toEqual(['1', '2', '3%', '9 d']);
  });
});
