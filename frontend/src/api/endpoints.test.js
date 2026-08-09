import { describe, it, expect, vi, beforeEach } from 'vitest';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('./client', () => ({ default: { get, post } }));

import * as contests from './contests';
import * as problems from './problems';
import * as standings from './standings';
import * as submissions from './submissions';
import * as users from './users';

/**
 * One table for the whole request layer.
 *
 * Every function here is the same three lines: call an address, hand back a
 * slice of the answer. What can actually break is a typo in the address, a
 * forgotten query parameter, or unwrapping the wrong field - and that is
 * exactly what each row pins down. Written as a table rather than as thirty
 * near-identical tests: the shape is shared, only the row differs.
 */
const reads = [
  {
    name: 'users.getUserStats',
    run: () => users.getUserStats('alice'),
    calledWith: ['users/alice/stats/'],
    answer: { solved: 12 },
    result: { solved: 12 },
  },
  {
    name: 'users.getUserActivity',
    run: () => users.getUserActivity('alice'),
    calledWith: ['users/alice/activity/'],
    answer: { '2026-08-01': 3 },
    result: { '2026-08-01': 3 },
  },
  {
    name: 'users.getUser',
    run: () => users.getUser('alice'),
    calledWith: ['users/alice/'],
    answer: { username: 'alice' },
    result: { username: 'alice' },
  },
  {
    name: 'users.getEloHistory',
    run: () => users.getEloHistory('alice'),
    calledWith: ['users/alice/elo-history/'],
    answer: [{ rating: 1200 }],
    result: [{ rating: 1200 }],
  },
  {
    name: 'users.getStreak',
    run: () => users.getStreak('alice'),
    calledWith: ['users/alice/streak/'],
    answer: { current_streak: 4 },
    result: { current_streak: 4 },
  },
  {
    name: 'users.getDifficultyBreakdown',
    run: () => users.getDifficultyBreakdown('alice'),
    calledWith: ['users/alice/difficulty/'],
    answer: { easy: { solved: 1, total: 2 } },
    result: { easy: { solved: 1, total: 2 } },
  },
  {
    // Paginated endpoint: the caller wants the rows, not the envelope.
    name: 'users.getContestHistory',
    run: () => users.getContestHistory('alice'),
    calledWith: ['users/alice/contest-history/', { params: { page_size: 5 } }],
    answer: { count: 1, results: [{ id: 7 }] },
    result: [{ id: 7 }],
  },
  {
    name: 'users.getUserSubmissions',
    run: () => users.getUserSubmissions('alice', 6),
    calledWith: ['users/alice/submissions/', { params: { page_size: 6 } }],
    answer: { count: 1, results: [{ id: 3 }] },
    result: [{ id: 3 }],
  },
  {
    // No page size asked for -> no page_size sent, so the backend default wins.
    name: 'users.getUserSubmissions (no page size)',
    run: () => users.getUserSubmissions('alice'),
    calledWith: ['users/alice/submissions/', { params: {} }],
    answer: { results: [] },
    result: [],
  },
  {
    // Array filters repeat as tag=A&tag=B, which is what getlist() reads.
    name: 'problems.getProblems',
    run: () => problems.getProblems({ tag: ['dp', 'math'] }),
    calledWith: [
      'problems/',
      { params: { tag: ['dp', 'math'] }, paramsSerializer: { indexes: null } },
    ],
    answer: { count: 0, results: [] },
    result: { count: 0, results: [] },
  },
  {
    name: 'problems.getProblem',
    run: () => problems.getProblem(42),
    calledWith: ['problems/42/'],
    answer: { id: 42 },
    result: { id: 42 },
  },
  {
    name: 'problems.getTags',
    run: () => problems.getTags(),
    calledWith: ['problems/tags/'],
    answer: [{ name: 'dp', count: 3 }],
    result: [{ name: 'dp', count: 3 }],
  },
  {
    name: 'problems.getRecommended',
    run: () => problems.getRecommended(),
    calledWith: ['problems/recommended/'],
    answer: [{ id: 1 }],
    result: [{ id: 1 }],
  },
  {
    name: 'problems.getDaily',
    run: () => problems.getDaily(),
    calledWith: ['problems/daily/'],
    answer: { id: 9 },
    result: { id: 9 },
  },
  {
    name: 'submissions.getSubmissions',
    run: () => submissions.getSubmissions({ problem: 42 }),
    calledWith: ['submissions/', { params: { problem: 42 } }],
    answer: { results: [{ id: 5 }] },
    result: [{ id: 5 }],
  },
  {
    name: 'submissions.getSubmission',
    run: () => submissions.getSubmission(5),
    calledWith: ['submissions/5/'],
    answer: { id: 5, verdict: 'AC' },
    result: { id: 5, verdict: 'AC' },
  },
  {
    name: 'submissions.getLanguages',
    run: () => submissions.getLanguages(),
    calledWith: ['languages/'],
    answer: [{ id: 'python', name: 'Python' }],
    result: [{ id: 'python', name: 'Python' }],
  },
  {
    name: 'standings.getStandings',
    run: () => standings.getStandings({ page: 2 }),
    calledWith: ['users/standings/', { params: { page: 2 } }],
    answer: { results: [], you: null },
    result: { results: [], you: null },
  },
  {
    name: 'contests.getContests',
    run: () => contests.getContests({ status: 'active' }),
    calledWith: ['contests/', { params: { status: 'active' } }],
    answer: { results: [{ id: 1 }] },
    result: [{ id: 1 }],
  },
  {
    // Same endpoint as above, but the hub's infinite scroll needs the envelope.
    name: 'contests.getContestsPage',
    run: () => contests.getContestsPage({ page: 3 }),
    calledWith: ['contests/', { params: { page: 3 } }],
    answer: { count: 9, next: null, results: [] },
    result: { count: 9, next: null, results: [] },
  },
  {
    name: 'contests.getContest',
    run: () => contests.getContest(7),
    calledWith: ['contests/7/'],
    answer: { id: 7 },
    result: { id: 7 },
  },
  {
    name: 'contests.getMyStanding',
    run: () => contests.getMyStanding(7),
    calledWith: ['contests/7/my-standing/'],
    answer: { rank: 3 },
    result: { rank: 3 },
  },
  {
    name: 'contests.getRegistrants',
    run: () => contests.getRegistrants(7, { page: 2 }),
    calledWith: ['contests/7/registrants/', { params: { page: 2 } }],
    answer: { count: 1, results: [] },
    result: { count: 1, results: [] },
  },
  {
    name: 'contests.getLeaderboard',
    run: () => contests.getLeaderboard(7, { page: 2 }),
    calledWith: ['contests/7/leaderboard/', { params: { page: 2 } }],
    answer: { count: 1, results: [] },
    result: { count: 1, results: [] },
  },
];

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe.each(reads)('$name', ({ run, calledWith, answer, result }) => {
  it('asks its own endpoint and hands back the useful part', async () => {
    get.mockResolvedValue({ data: answer });

    await expect(run()).resolves.toEqual(result);
    expect(get).toHaveBeenCalledWith(...calledWith);
  });
});

describe('submissions.createSubmission', () => {
  it('files a solo attempt without a contest field', async () => {
    post.mockResolvedValue({ data: { id: 1, status: 'queued' } });

    const data = await submissions.createSubmission({
      problem: 42,
      code: 'print(1)',
      language: 'python',
    });

    // A stray contest: null would file the attempt into a round that isn't one.
    expect(post).toHaveBeenCalledWith('submissions/', {
      problem: 42,
      code: 'print(1)',
      language: 'python',
    });
    expect(data).toEqual({ id: 1, status: 'queued' });
  });

  it('files a contest attempt with the round id', async () => {
    post.mockResolvedValue({ data: { id: 2 } });

    await submissions.createSubmission({
      problem: 42,
      code: 'print(1)',
      language: 'python',
      contest: 7,
    });

    expect(post).toHaveBeenCalledWith('submissions/', {
      problem: 42,
      code: 'print(1)',
      language: 'python',
      contest: 7,
    });
  });
});

describe.each([
  ['joinContest', contests.joinContest, 'contests/7/join/'],
  ['leaveContest', contests.leaveContest, 'contests/7/leave/'],
])('contests.%s', (_name, call, url) => {
  it('posts to its own endpoint and returns nothing', async () => {
    post.mockResolvedValue({ status: 204 });

    await expect(call(7)).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledWith(url);
  });
});
