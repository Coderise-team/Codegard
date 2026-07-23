import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ContestBanner from './ContestBanner';

const D = {
  contest: {
    name: 'Codegard Cup #40',
    date: 'Jun 6, 2026',
    time: '17:00',
    duration: '2h',
    registeredCount: 1234,
    endedAgo: '3h ago',
  },
  problems: [
    { id: 'A', title: 'Two Sum', solvedBy: 100 },
    { id: 'B', title: 'Brackets', solvedBy: null },
  ],
  yourProbs: { live: ['solved', 'attempted'], finished: ['solved', 'open'] },
};

const renderBanner = (props) =>
  render(
    <ContestBanner
      D={D}
      contestId={5}
      state="soon"
      seconds={7200}
      registered={false}
      onToggle={() => {}}
      {...props}
    />
  );

// Registered pips and the Enter-round button are links, so they need a router.
const renderRouted = (props) =>
  render(
    <MemoryRouter>
      <ContestBanner
        D={D}
        contestId={5}
        state="live"
        seconds={7200}
        registered
        onToggle={() => {}}
        {...props}
      />
    </MemoryRouter>
  );

describe('ContestBanner', () => {
  it('soon: locked pips, starts-in countdown and the Register pill', () => {
    const onToggle = vi.fn();
    const { container } = renderBanner({ onToggle });

    expect(container.querySelectorAll('.hpip.s-locked').length).toBe(2);
    expect(container.querySelector('.cp-count .k').textContent).toBe(
      'Starts in'
    );
    expect(container.querySelector('.cp-count .v').textContent).toBe(
      '02:00:00'
    );

    fireEvent.click(container.querySelector('.reg-pill.go'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('soon registered: the pill is a button and toggles back', () => {
    const onToggle = vi.fn();
    const { container } = renderBanner({ registered: true, onToggle });

    const pill = container.querySelector('button.reg-pill.done');
    expect(pill).toBeTruthy();
    fireEvent.click(pill);
    expect(onToggle).toHaveBeenCalled();
  });

  it('live: statuses on the pips, solved counts, and the urgent timer', () => {
    const { container } = renderBanner({ state: 'live', seconds: 200 });

    expect(container.querySelector('.hbadge.live')).toBeTruthy();
    expect(container.querySelector('.hpip.s-solved')).toBeTruthy();
    expect(container.querySelector('.hpip.s-attempted')).toBeTruthy();
    expect(container.textContent).toContain('100 solved');
    expect(container.querySelector('.cp-count .v.urgent')).toBeTruthy();
  });

  it('live: hides the solved line when the count is missing', () => {
    const { container } = renderBanner({ state: 'live' });
    const pts = container.querySelectorAll('.hpip .pt');
    // only problem A carries a count; B renders no solved line
    expect(pts.length).toBe(1);
  });

  it('finished: shows when it ended and no cta at all', () => {
    const { container } = renderBanner({ state: 'finished' });

    expect(container.querySelector('.cp-count .k').textContent).toBe('Ended');
    expect(container.querySelector('.cp-count .v').textContent).toBe('3h ago');
    expect(container.querySelector('.cp-cta')).toBeNull();
  });

  it('live registered: Enter round and pips link into the round', () => {
    const { container } = renderRouted();

    expect(container.querySelector('a.btn-primary').getAttribute('href')).toBe(
      '/contests/5/problems/A'
    );
    const pip = container.querySelector('.hpip.s-solved');
    expect(pip.tagName).toBe('A');
    expect(pip.getAttribute('href')).toBe('/contests/5/problems/A');
  });

  it('live not registered: pips are inert and the cta is Register', () => {
    const { container } = renderRouted({ registered: false });

    expect(container.querySelector('.hpip.s-solved').tagName).toBe('SPAN');
    expect(container.querySelector('a.btn-primary')).toBeNull();
    expect(container.querySelector('.reg-pill.go')).toBeTruthy();
  });
});
