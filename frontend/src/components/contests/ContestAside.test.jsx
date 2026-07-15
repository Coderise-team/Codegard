import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ContestAside from './ContestAside';

const panelOf = (rows, extra = {}) => ({
  rows,
  total: rows.length,
  hasMore: false,
  loading: false,
  error: null,
  loadMore: () => {},
  ...extra,
});

// Rows render as router Links, so the tree needs a router around it.
const renderAside = (props) =>
  render(
    <MemoryRouter>
      <ContestAside
        state="soon"
        open
        onToggle={() => {}}
        panel={panelOf([])}
        problemsCount={5}
        you="n3ptune"
        myStanding={null}
        {...props}
      />
    </MemoryRouter>
  );

describe('ContestAside', () => {
  it('collapsed: renders the labelled edge tab and expands on click', () => {
    const onToggle = vi.fn();
    const { container } = renderAside({ open: false, onToggle });

    const tab = container.querySelector('.cp-aside-tab');
    expect(tab.textContent).toBe('Registered');
    fireEvent.click(tab);
    expect(onToggle).toHaveBeenCalled();
  });

  it('collapsed tab says Standings once the contest is not upcoming', () => {
    const { container } = renderAside({ open: false, state: 'live' });
    expect(container.querySelector('.cp-aside-tab').textContent).toBe(
      'Standings'
    );
  });

  it('the whole header is the collapse button', () => {
    const onToggle = vi.fn();
    const { container } = renderAside({ onToggle });

    const header = container.querySelector('button.cp-aside-hd');
    fireEvent.click(header);
    expect(onToggle).toHaveBeenCalled();
  });

  it('registrants: rank by position, tier from the rating, profile links', () => {
    const rows = [
      { username: 'tourist_ng', elo_rating: 2405 },
      { username: 'n3ptune', elo_rating: 1850 },
    ];
    const { container } = renderAside({ panel: panelOf(rows) });

    const rendered = container.querySelectorAll('.cp-row');
    expect(rendered.length).toBe(2);
    expect(rendered[0].querySelector('.cp-rk').textContent).toBe('1');
    expect(rendered[0].textContent).toContain('Kernel'); // 2405 tier
    expect(rendered[0].getAttribute('href')).toBe('/users/tourist_ng');
    expect(rendered[1].textContent).toContain('Master'); // 1850 tier
    expect(rendered[1].classList.contains('you')).toBe(true);
    expect(rendered[1].getAttribute('href')).toBe('/profile'); // own row
  });

  it('live: LIVE badge, table header and solved/pts/penalty columns', () => {
    const rows = [
      {
        rank: 1,
        username: 'tourist_ng',
        score: 300,
        penalty: 74,
        solved_count: 3,
        rating_delta: null,
      },
    ];
    const { container } = renderAside({ state: 'live', panel: panelOf(rows) });

    expect(container.querySelector('.live-dot')).toBeTruthy();
    expect(container.querySelector('.cp-thead').textContent).toContain(
      'Penalty'
    );
    const row = container.querySelector('.cp-row');
    expect(row.classList.contains('r1')).toBe(true);
    const cells = [...row.querySelectorAll('.cp-cell')].map(
      (c) => c.textContent
    );
    expect(cells).toEqual(['3/5', '300', '74']);
  });

  it('finished: colored delta column after the metrics', () => {
    const rows = [
      {
        rank: 1,
        username: 'a',
        score: 300,
        penalty: 74,
        solved_count: 3,
        rating_delta: 48,
      },
      {
        rank: 2,
        username: 'b',
        score: 200,
        penalty: 90,
        solved_count: 2,
        rating_delta: -12,
      },
    ];
    const { container } = renderAside({
      state: 'finished',
      panel: panelOf(rows),
    });

    expect(container.querySelector('.cp-thead').textContent).toContain('Δ');
    const first = [
      ...container.querySelectorAll('.cp-row')[0].querySelectorAll('.cp-cell'),
    ].map((c) => c.textContent);
    expect(first).toEqual(['3/5', '300', '74', '+48']);

    const deltas = container.querySelectorAll('.cp-dl');
    expect(deltas[0].classList.contains('up')).toBe(true);
    expect(deltas[1].textContent).toBe('-12');
    expect(deltas[1].classList.contains('down')).toBe(true);
  });

  it('live: renders my out-of-view row from my-standing under the gap', () => {
    const rows = [
      {
        rank: 1,
        username: 'tourist_ng',
        score: 300,
        penalty: 74,
        solved_count: 3,
        rating_delta: null,
      },
    ];
    const { container } = renderAside({
      state: 'live',
      panel: panelOf(rows),
      myStanding: { rank: 42, score: 100, solved: 1 },
    });

    expect(container.querySelector('.cp-gap')).toBeTruthy();
    const mine = container.querySelector('.cp-row.you');
    expect(mine.querySelector('.cp-rk').textContent).toBe('42');
    expect(mine.textContent).toContain('n3ptune');
    expect(mine.getAttribute('href')).toBe('/profile');
  });

  it('live: my extra row is not duplicated when I am already listed', () => {
    const rows = [
      {
        rank: 1,
        username: 'n3ptune',
        score: 300,
        penalty: 74,
        solved_count: 3,
        rating_delta: null,
      },
    ];
    const { container } = renderAside({
      state: 'live',
      panel: panelOf(rows),
      myStanding: { rank: 1, score: 300, solved: 3 },
    });

    expect(container.querySelector('.cp-gap')).toBeNull();
    expect(container.querySelectorAll('.cp-row').length).toBe(1);
  });

  it('shows loading, empty and sentinel states', () => {
    const loading = renderAside({ panel: panelOf([], { loading: true }) });
    expect(loading.container.textContent).toContain('Loading…');

    const empty = renderAside({ panel: panelOf([]) });
    expect(empty.container.textContent).toContain('No one has registered yet.');

    const rows = [{ username: 'a', elo_rating: 1500 }];
    const more = renderAside({ panel: panelOf(rows, { hasMore: true }) });
    expect(more.container.querySelector('.cp-sentinel')).toBeTruthy();
  });
});
