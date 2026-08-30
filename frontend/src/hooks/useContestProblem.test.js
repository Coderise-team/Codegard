import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { useContest } = vi.hoisted(() => ({ useContest: vi.fn() }));
vi.mock('./useContest', () => ({ useContest }));

import { useContestProblem } from './useContestProblem';

const contestSays = (over = {}) =>
  useContest.mockReturnValue({
    contest: null,
    loading: false,
    error: null,
    ...over,
  });

const notFound = () => ({ response: { status: 404 } });

beforeEach(() => {
  useContest.mockReset();
});

describe('useContestProblem', () => {
  it('turns the letter into the statement the round holds at that spot', () => {
    // The letter is a position in the round, and the entry there is the whole
    // statement: the round ships it, the catalogue never serves it.
    const second = { id: 22, title: 'Second', test_cases: [] };
    contestSays({ contest: { id: 7, problems: [{ id: 11 }, second] } });

    const { result } = renderHook(() => useContestProblem(7, 'B'));

    expect(result.current.problem).toBe(second);
    expect(result.current.notFound).toBe(false);
  });

  it('takes a hand-typed lowercase letter', () => {
    const first = { id: 11 };
    contestSays({ contest: { id: 7, problems: [first] } });

    const { result } = renderHook(() => useContestProblem(7, 'a'));

    expect(result.current.problem).toBe(first);
  });

  it('calls a letter past the end of the round a dead url', () => {
    contestSays({ contest: { id: 7, problems: [{ id: 11 }] } });

    const { result } = renderHook(() => useContestProblem(7, 'C'));

    expect(result.current.notFound).toBe(true);
    expect(result.current.problem).toBe(null);
  });

  it('calls a segment that is not a letter a dead url', () => {
    contestSays({ contest: { id: 7, problems: [{ id: 11 }] } });

    const { result } = renderHook(() => useContestProblem(7, '42'));

    expect(result.current.notFound).toBe(true);
  });

  it('passes a missing contest through as a dead url', () => {
    // A round that has not started counts too: the backend hides its problems
    // until the start, so the page has nothing to draw either way.
    contestSays({ error: notFound() });

    const { result } = renderHook(() => useContestProblem(99, 'A'));

    expect(result.current.notFound).toBe(true);
  });

  it('waits while the round is still loading', () => {
    contestSays({ loading: true });

    const { result } = renderHook(() => useContestProblem(7, 'A'));

    expect(result.current.loading).toBe(true);
    expect(result.current.notFound).toBe(false);
  });

  it('hands up a real failure', () => {
    const failure = new Error('boom');
    contestSays({ error: failure });

    const { result } = renderHook(() => useContestProblem(7, 'A'));

    expect(result.current.error).toBe(failure);
    expect(result.current.notFound).toBe(false);
  });
});
