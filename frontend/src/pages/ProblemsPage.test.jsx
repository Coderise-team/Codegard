import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The catalog maps the term and the filters onto one query, and tells a search
// that found nothing apart from a filter that left nothing. Stub the data layer
// and assert on those.
const hooks = vi.hoisted(() => ({
  useProblems: vi.fn(),
  useDifficultyBreakdown: vi.fn(),
  useDaily: vi.fn(),
  useTags: vi.fn(),
}));
vi.mock('../hooks/useProblems', () => ({ useProblems: hooks.useProblems }));
vi.mock('../hooks/useDifficultyBreakdown', () => ({
  useDifficultyBreakdown: hooks.useDifficultyBreakdown,
}));
vi.mock('../hooks/useDaily', () => ({ useDaily: hooks.useDaily }));
vi.mock('../hooks/useTags', () => ({ useTags: hooks.useTags }));
vi.mock('../store/authStore', () => ({
  useAuthStore: (selector) => selector({ user: { username: 'me' } }),
}));

import ProblemsPage from './ProblemsPage';

const problem = (id, title) => ({
  id,
  title,
  difficulty: 'easy',
  tags: [],
  acceptance: 50,
  status: 'todo',
});

const result = (items, over = {}) => ({
  items,
  total: items.length,
  hasMore: false,
  loading: false,
  error: null,
  loadMore: vi.fn(),
  ...over,
});

const lastParams = () => hooks.useProblems.mock.lastCall[0];

const renderPage = (entry = '/problems') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ProblemsPage />
    </MemoryRouter>
  );

beforeEach(() => {
  hooks.useProblems.mockReset();
  hooks.useProblems.mockReturnValue(result([problem(1, 'Two Sum')]));
  hooks.useDifficultyBreakdown.mockReturnValue({ data: null });
  hooks.useDaily.mockReturnValue({ data: null });
  hooks.useTags.mockReturnValue({ data: [] });
});

describe('ProblemsPage search', () => {
  it('sends nothing of its own until a term arrives', () => {
    renderPage();

    expect(lastParams()).toEqual({});
  });

  it('searches for the term the address arrived with', () => {
    renderPage('/problems?search=arrys');

    expect(lastParams()).toEqual({ search: 'arrys' });
  });

  it('searches within the difficulty and the tags already picked', () => {
    renderPage('/problems?search=arrys&tag=arrays');

    // By role: the header prints the same word above its Easy total.
    fireEvent.click(screen.getByRole('radio', { name: 'Easy' }));

    expect(lastParams()).toEqual({
      search: 'arrys',
      difficulty: 'easy',
      tag: ['arrays'],
    });
  });

  it('says the search found nothing and offers to clear it', () => {
    hooks.useProblems.mockReturnValue(result([]));
    renderPage('/problems?search=zzz');

    expect(screen.getByText('Nothing found for that search')).toBeTruthy();
    expect(
      screen.queryByText('No problems match these filters')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear search'));
    expect(lastParams()).toEqual({});
  });

  it('says the catalog failed instead of blaming the spelling', () => {
    hooks.useProblems.mockReturnValue(result([], { error: new Error('down') }));
    renderPage('/problems?search=arrays');

    expect(screen.getByText('Problems unavailable')).toBeTruthy();
    expect(
      screen.queryByText('Nothing found for that search')
    ).not.toBeInTheDocument();
  });

  it('keeps the rows it has when an extra page fails to load', () => {
    hooks.useProblems.mockReturnValue(
      result([problem(1, 'Two Sum')], { error: new Error('down') })
    );
    const { container } = renderPage();

    expect(container.querySelectorAll('.prow')).toHaveLength(1);
    expect(screen.queryByText('Problems unavailable')).not.toBeInTheDocument();
  });

  it('points at the filters instead when no search is running', () => {
    hooks.useProblems.mockReturnValue(result([]));
    renderPage('/problems?tag=arrays');

    expect(screen.getByText('No problems match these filters')).toBeTruthy();
    expect(screen.queryByText('Clear search')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Reset filters'));
    expect(lastParams()).toEqual({});
  });
});
