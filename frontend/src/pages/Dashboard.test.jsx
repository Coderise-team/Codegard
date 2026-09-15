import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// The dashboard searches nothing itself: all it owns is what Enter in the top
// bar does with the term. Stand in for the shell to capture the declaration and
// keep the dashboard blocks (each of which fetches) out of the way.
const shell = vi.hoisted(() => ({ search: null }));
const navigate = vi.hoisted(() => vi.fn());

vi.mock('../components/layout/AppShell', () => ({
  default: ({ search }) => {
    shell.search = search;
    return null;
  },
}));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}));
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ username: 'me', avatar: null }),
}));

import Dashboard from './Dashboard';

beforeEach(() => {
  shell.search = null;
  navigate.mockReset();
  render(<Dashboard />);
});

describe('Dashboard search', () => {
  it('declares a term it cannot answer itself', () => {
    expect(shell.search.onSubmit).toBeTypeOf('function');
    expect(shell.search.onChange).toBeUndefined();
  });

  it('opens the catalog on the term', () => {
    shell.search.onSubmit('arrays');

    expect(navigate).toHaveBeenCalledWith('/problems?search=arrays');
  });

  it('escapes a term the address would otherwise cut short', () => {
    shell.search.onSubmit('two sum & more');

    expect(navigate).toHaveBeenCalledWith(
      '/problems?search=two%20sum%20%26%20more'
    );
  });

  it('stays put on an empty term', () => {
    shell.search.onSubmit('');

    expect(navigate).not.toHaveBeenCalled();
  });
});
