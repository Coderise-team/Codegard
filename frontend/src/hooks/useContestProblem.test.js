import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { useContest, useProblem } = vi.hoisted(() => ({
  useContest: vi.fn(),
  useProblem: vi.fn(),
}));
vi.mock('./useContest', () => ({ useContest }));
vi.mock('./useProblem', () => ({ useProblem }));

import { useContestProblem } from './useContestProblem';

const contestSays = (over = {}) =>
  useContest.mockReturnValue({
    contest: null,
    loading: false,
    error: null,
    ...over,
  });

const problemSays = (over = {}) =>
  useProblem.mockReturnValue({
    data: null,
    loading: false,
    error: null,
    ...over,
  });

const notFound = () => ({ response: { status: 404 } });

beforeEach(() => {
  useContest.mockReset();
  useProblem.mockReset();
});

describe('useContestProblem', () => {
  it('turns the letter into the problem the round holds at that spot', () => {
    // The letter is a position in the round; the entry there carries the
    // catalogue id, and the statement is loaded from the catalogue because the
    // contest payload ships a trimmed problem.
    contestSays({ contest: { id: 7, problems: [{ id: 11 }, { id: 22 }] } });
    problemSays({ data: { id: 22, title: 'Second' } });

    const { result } = renderHook(() => useContestProblem(7, 'B'));

    expect(useProblem).toHaveBeenCalledWith(22);
    expect(result.current.problem).toEqual({ id: 22, title: 'Second' });
    expect(result.current.notFound).toBe(false);
  });

  it('takes a hand-typed lowercase letter', () => {
    contestSays({ contest: { id: 7, problems: [{ id: 11 }] } });
    problemSays({ data: { id: 11 } });

    renderHook(() => useContestProblem(7, 'a'));

    expect(useProblem).toHaveBeenCalledWith(11);
  });

  it('calls a letter past the end of the round a dead url', () => {
    contestSays({ contest: { id: 7, problems: [{ id: 11 }] } });
    problemSays();

    const { result } = renderHook(() => useContestProblem(7, 'C'));

    expect(result.current.notFound).toBe(true);
    expect(useProblem).toHaveBeenCalledWith(null);
  });

  it('calls a segment that is not a letter a dead url', () => {
    contestSays({ contest: { id: 7, problems: [{ id: 11 }] } });
    problemSays();

    const { result } = renderHook(() => useContestProblem(7, '42'));

    expect(result.current.notFound).toBe(true);
  });

  it('passes a missing contest through as a dead url', () => {
    // A round that has not started counts too: the backend hides its problems
    // until the start, so the page has nothing to draw either way.
    contestSays({ error: notFound() });
    problemSays();

    const { result } = renderHook(() => useContestProblem(99, 'A'));

    expect(result.current.notFound).toBe(true);
  });

  it('waits while the round is still loading', () => {
    contestSays({ loading: true });
    problemSays();

    const { result } = renderHook(() => useContestProblem(7, 'A'));

    expect(result.current.loading).toBe(true);
    expect(result.current.notFound).toBe(false);
  });

  it('does not wait for a problem that was never addressed', () => {
    // useProblem sits at loading:true on a null id; leaking that out would
    // spin forever on a url that addresses nothing.
    contestSays({ contest: { id: 7, problems: [] } });
    problemSays({ loading: true });

    const { result } = renderHook(() => useContestProblem(7, 'A'));

    expect(result.current.loading).toBe(false);
    expect(result.current.notFound).toBe(true);
  });

  it('hands up a real failure of either half', () => {
    const failure = new Error('boom');
    contestSays({ error: failure });
    problemSays();

    const { result } = renderHook(() => useContestProblem(7, 'A'));

    expect(result.current.error).toBe(failure);
    expect(result.current.notFound).toBe(false);
  });
});
