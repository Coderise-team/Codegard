import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { ContestHeroView } from './ContestHero';

// A live contest with two problems; `is_joined` is flipped per test.
const makeData = (isJoined) => ({
  contest: {
    id: 7,
    title: 'Codegard Cup #40',
    subtitle: 'Round 2',
    start_time: '2026-06-06T15:00:00Z',
    end_time: '2026-06-06T17:00:00Z',
    participants_count: 1234,
    is_joined: isJoined,
    problems: [
      { id: 11, title: 'Two Sum' },
      { id: 12, title: 'Brackets' },
    ],
  },
  standing: {
    rank: 3,
    score: 100,
    solved: 1,
    problems: [
      { id: 11, status: 'solved' },
      { id: 12, status: 'open' },
    ],
  },
});

const renderHero = (isJoined) =>
  render(
    <MemoryRouter>
      <ContestHeroView
        state="live"
        data={makeData(isJoined)}
        loading={false}
        error={null}
        reload={() => {}}
      />
    </MemoryRouter>
  );

describe('ContestHero (live gating)', () => {
  it('participant: Enter round and the pips link into the round', () => {
    const { container } = renderHero(true);

    const enter = container.querySelector('.hero-cta a.btn-primary');
    expect(enter).toBeTruthy();
    // lands on the first unsolved problem (B), never on a done task
    expect(enter.getAttribute('href')).toBe('/contests/7/problems/B');

    const pip = container.querySelector('.hero-probs .hpip');
    expect(pip.tagName).toBe('A');
  });

  it('non-participant: no Enter round and the pips are inert', () => {
    const { container } = renderHero(false);

    expect(container.querySelector('.hero-cta a.btn-primary')).toBeNull();
    // the only way in is Details -> the contest page
    const details = container.querySelector('.hero-cta a.btn');
    expect(details.getAttribute('href')).toBe('/contests/7');

    const pip = container.querySelector('.hero-probs .hpip');
    expect(pip.tagName).toBe('SPAN');
  });
});
