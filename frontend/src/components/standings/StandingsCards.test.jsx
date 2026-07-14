import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

import { StandingRow, PodiumCard, StHead } from './StandingsCards';

const coder = (over = {}) => ({
  username: 'n3ptune',
  elo_rating: 1700, // Expert band
  maxRating: 1812,
  globalRank: 5,
  delta: 12,
  ...over,
});

describe('StandingRow', () => {
  it('medals the top three places and prints the rest as plain numbers', () => {
    const { container: second } = render(
      <StandingRow u={coder({ globalRank: 2 })} />
    );
    expect(second.querySelector('.medal.m2')).toBeTruthy();

    const { container: fourth } = render(
      <StandingRow u={coder({ globalRank: 4 })} />
    );
    expect(fourth.querySelector('.medal')).toBeNull();
    expect(fourth.querySelector('.rn').textContent).toBe('4');
  });

  it('medals a shared place by the place itself, not by row order', () => {
    // Dense ranking: two coders tie for 2nd, so both wear silver.
    const { container } = render(
      <>
        <StandingRow u={coder({ username: 'a', globalRank: 2 })} />
        <StandingRow u={coder({ username: 'b', globalRank: 2 })} />
      </>
    );
    expect(container.querySelectorAll('.medal.m2')).toHaveLength(2);
    expect(container.querySelector('.medal.m3')).toBeNull();
  });

  it('marks only your own row', () => {
    const { container: mine } = render(<StandingRow u={coder()} isYou />);
    expect(mine.querySelector('.st-row.you')).toBeTruthy();
    expect(mine.querySelector('.you-tag')).toBeTruthy();

    const { container: theirs } = render(<StandingRow u={coder()} />);
    expect(theirs.querySelector('.st-row.you')).toBeNull();
    expect(theirs.querySelector('.you-tag')).toBeNull();
  });

  it('shows the tier the rating maps to', () => {
    render(<StandingRow u={coder({ elo_rating: 1700 })} />);
    expect(screen.getByText('Expert')).toBeTruthy();
  });

  it('renders the rating delta up, down, or as a dash when unknown', () => {
    const { container: up } = render(<StandingRow u={coder({ delta: 12 })} />);
    expect(up.querySelector('.st-delta.up').textContent).toContain('12');

    const { container: down } = render(
      <StandingRow u={coder({ delta: -8 })} />
    );
    expect(down.querySelector('.st-delta.down').textContent).toContain('8');

    // No rated contest yet -> the API sends null, and we must not invent a zero.
    const { container: none } = render(
      <StandingRow u={coder({ delta: null })} />
    );
    expect(none.querySelector('.st-delta.flat').textContent).toBe('·');

    // A contest that moved nothing IS a zero — a different fact from "never
    // played", and it must not be dressed up as one.
    const { container: zero } = render(<StandingRow u={coder({ delta: 0 })} />);
    expect(zero.querySelector('.st-delta.flat').textContent).toBe('0');
  });

  it('dashes the peak rating when it is missing', () => {
    const { container } = render(
      <StandingRow u={coder({ maxRating: null })} />
    );
    expect(container.querySelector('.st-max').textContent).toBe('—');
  });
});

describe('PodiumCard', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the place, not the position in the list', () => {
    const { container } = render(
      <PodiumCard place={2} users={[coder({ globalRank: 2 })]} />
    );
    expect(container.querySelector('.pod-2')).toBeTruthy();
    expect(container.querySelector('.pod-medal').textContent).toBe('2');
  });

  it('has no revolver when one coder holds the place alone', () => {
    const { container } = render(
      <PodiumCard place={1} users={[coder({ username: 'solo' })]} />
    );
    expect(container.querySelector('.pod-rev')).toBeNull();
  });

  it('revolves through everyone sharing the place', () => {
    const users = [
      coder({ username: 'ann', globalRank: 1 }),
      coder({ username: 'bob', globalRank: 1 }),
      coder({ username: 'cid', globalRank: 1 }),
    ];
    const { container } = render(<PodiumCard place={1} users={users} />);

    expect(container.querySelector('.pod-rev-n').textContent).toBe('1/3');
    expect(screen.getByText('ann')).toBeTruthy();

    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText('bob')).toBeTruthy();
    expect(container.querySelector('.pod-rev-n').textContent).toBe('2/3');
  });

  it('pages through the tie by hand, wrapping at both ends', () => {
    const users = [
      coder({ username: 'ann' }),
      coder({ username: 'bob' }),
      coder({ username: 'cid' }),
    ];
    const { container } = render(<PodiumCard place={1} users={users} />);

    // Back from the first coder wraps to the last one.
    fireEvent.click(container.querySelector('.pod-arw.prev'));
    expect(screen.getByText('cid')).toBeTruthy();

    // Forward from the last wraps around to the first.
    fireEvent.click(container.querySelector('.pod-arw.next'));
    expect(screen.getByText('ann')).toBeTruthy();
  });

  it('leads with the peak and drops the current rating below it when sorted by peak', () => {
    const u = coder({ elo_rating: 2050, maxRating: 2300 });

    const { container: byRating } = render(
      <PodiumCard place={1} users={[u]} metric="rating" />
    );
    expect(byRating.querySelector('.pod-rating').textContent).toBe('2050');
    expect(byRating.querySelector('.pod-max').textContent).toContain('max');

    const { container: byMax } = render(
      <PodiumCard place={1} users={[u]} metric="max" />
    );
    expect(byMax.querySelector('.pod-rating').textContent).toBe('2300');
    expect(byMax.querySelector('.pod-max').textContent).toContain('rating');
    expect(byMax.querySelector('.pod-max b').textContent).toBe('2050');
  });

  it('marks the tile as yours only while your own row is showing', () => {
    const users = [coder({ username: 'ann' }), coder({ username: 'me' })];
    const { container } = render(
      <PodiumCard place={1} users={users} youUsername="me" />
    );

    expect(container.querySelector('.pod.you')).toBeNull();

    act(() => vi.advanceTimersByTime(4000));
    expect(container.querySelector('.pod.you')).toBeTruthy();
  });
});

describe('StHead', () => {
  it('only lets you sort by rating and peak rating', () => {
    const onSort = vi.fn();
    render(<StHead sort={{ key: 'rating', dir: 'desc' }} onSort={onSort} />);

    // Rank and Last Δ are labels: the server has no ordering for them.
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Rating↓',
      'Max',
    ]);

    fireEvent.click(screen.getByText('Max'));
    expect(onSort).toHaveBeenCalledWith('max');
  });

  it('lights exactly the column the board is sorted by', () => {
    const { container } = render(
      <StHead sort={{ key: 'max', dir: 'asc' }} onSort={vi.fn()} />
    );

    expect(container.querySelector('.sth-max.active')).toBeTruthy();
    expect(container.querySelector('.sth-rating.active')).toBeNull();
    expect(container.querySelector('.sth-max .ar').textContent).toBe('↑');
  });
});
