import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The hub maps its open section and the typed term onto one query. Stub the
// data layer and drive that.
const hooks = vi.hoisted(() => ({
  useContests: vi.fn(),
  useContestHero: vi.fn(),
}));
vi.mock('../hooks/useContests', () => ({ useContests: hooks.useContests }));
vi.mock('../hooks/useContestHero', () => ({
  useContestHero: hooks.useContestHero,
}));
vi.mock('../store/authStore', () => ({
  useAuthStore: (selector) => selector({ user: { username: 'me' } }),
}));

import ContestsPage from './ContestsPage';

const result = (items) => ({
  items,
  total: items.length,
  hasMore: false,
  loading: false,
  loadMore: vi.fn(),
});

const contest = (id, title) => ({
  id,
  title,
  subtitle: '',
  start_time: '2030-01-01T10:00:00Z',
  end_time: '2030-01-01T12:00:00Z',
  problems_count: 5,
  participants_count: 3,
  is_joined: false,
});

const lastParams = () => hooks.useContests.mock.lastCall[0];

const renderPage = (entry = '/contests') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ContestsPage />
    </MemoryRouter>
  );

beforeEach(() => {
  hooks.useContests.mockReset();
  hooks.useContests.mockReturnValue(result([contest(1, 'Div 2 Round')]));
  hooks.useContestHero.mockReturnValue({ state: 'none', data: null });
});

describe('ContestsPage search', () => {
  it('searches inside the open section', () => {
    renderPage('/contests?search=div');

    // No ordering of ours: it would override the server's ranking by how well
    // each title matches, and the closest name is what was asked for.
    expect(lastParams()).toEqual({ status: 'pending', search: 'div' });
  });

  it('asks for the nearest round first once the search is cleared', () => {
    renderPage('/contests?search=div');

    fireEvent.click(screen.getByTitle('Clear'));

    expect(lastParams()).toEqual({
      status: 'pending',
      ordering: 'start_time',
    });
  });

  it('asks the other section for the same term when it is opened', () => {
    renderPage('/contests?search=div');

    fireEvent.click(screen.getByText('Past'));

    expect(lastParams()).toEqual({ status: 'finished', search: 'div' });
  });

  it('hides the featured contest so a match is not dropped from the list', () => {
    hooks.useContestHero.mockReturnValue({
      state: 'soon',
      data: { contest: contest(1, 'Div 2 Round') },
      loading: false,
      error: null,
    });

    // Without a search it heads the page, and its row is kept out of the list
    // below so the same contest is not shown twice.
    const plain = renderPage();
    expect(plain.container.querySelector('.hero')).toBeTruthy();
    expect(plain.container.querySelectorAll('.ct-list .ct-row')).toHaveLength(
      0
    );
    plain.unmount();

    const searched = renderPage('/contests?search=div');
    expect(searched.container.querySelector('.hero')).toBeNull();
    // The featured contest is a row like any other while a search is on.
    expect(
      searched.container.querySelectorAll('.ct-list .ct-row')
    ).toHaveLength(1);
  });

  it('says the search found nothing in this section and offers to clear it', () => {
    hooks.useContests.mockReturnValue(result([]));
    renderPage('/contests?search=zzz');

    expect(screen.getByText('Nothing found for that search')).toBeTruthy();
    expect(screen.queryByText('No upcoming contests')).toBeNull();

    fireEvent.click(screen.getByText('Clear search'));
    expect(lastParams()).toEqual({ status: 'pending', ordering: 'start_time' });
  });
});
