// =============================================================
// Codegard — landing page content.
// Marketing copy, the demo submission, the live-contest board and the
// global-rating sample rows all live here so the components stay
// presentational.
//
// Everything here has to be true of the product. The sample rows follow the
// real scoring rules (100 points per solved problem, penalty in minutes) and
// the tiers come from the shared rank ladder rather than a copy of it.
// =============================================================

import { CG_RANKS, cgRankFor } from './ranks';

export const DEMO_CODE = [
  'class Solution:',
  '    def twoSum(self, nums: List[int], target: int) -> List[int]:',
  '        seen = {}',
  '        for i, x in enumerate(nums):',
  '            need = target - x',
  '            if need in seen:',
  '                return [seen[need], i]',
  '            seen[x] = i',
  '        return []',
].join('\n');

const POINTS_PER_PROBLEM = 100;

/** A contest row: the score follows from the number of solved problems. */
const participant = (handle, initials, solved, penalty, last, you = false) => ({
  handle,
  initials,
  solved,
  pts: solved * POINTS_PER_PROBLEM,
  pen: penalty,
  last,
  you,
});

/** A rating row: the tier and its colour follow from the rating itself. */
const coder = (rank, handle, initials, rating, delta, you = false) => {
  const tier = cgRankFor(rating);
  return {
    rank,
    handle,
    initials,
    rating,
    delta,
    tier: tier.name,
    color: tier.color,
    you,
  };
};

const landingContent = {
  hero: {
    eyebrow: 'Free · every problem, every contest',
    lines: ['Write code.', 'Get judged.', 'Climb the rating.'],
    sub: 'Compete against other programmers and earn a rating, or sharpen your skills in a calm solo mode. Either way the verdict comes back in seconds.',
    note: 'Sign in with Google or GitHub, or make an account in ten seconds.',
  },

  // Live contest board. Points are 100 per solved problem, so the board moves
  // a whole problem at a time; the penalty is in minutes, counted from the
  // start of the round.
  contest: {
    name: 'Codegard Round 12',
    lengthSeconds: 3 * 3600,
    secondsLeft: 1 * 3600 + 23 * 60 + 45,
    // Letters and their status, as the contest topbar shows them.
    current: 'C',
    problems: [
      { id: 'A', status: 'solved' },
      { id: 'B', status: 'solved' },
      { id: 'C', status: 'open' },
      { id: 'D', status: 'attempted' },
      { id: 'E', status: 'open' },
    ],
    board: [
      participant('n3ptune', 'NP', 4, 203, '01:41', true),
      participant('hexraven', 'HR', 5, 214, '01:12'),
      participant('voidwolf', 'VW', 4, 168, '01:29'),
      participant('segfaultx', 'SX', 4, 247, '01:55'),
      participant('lambdacore', 'LC', 3, 132, '01:04'),
      participant('turingfox', 'TF', 3, 158, '01:18'),
    ],
  },

  // The four steps walk through a contest, start to finish; solving at your own
  // pace is the solo section's story, so it stays out of here.
  steps: [
    {
      t: 'Pick your order',
      d: 'The problems open together and nobody tells you where to start. Take the cheap ones first, or gamble on the hard one.',
    },
    {
      t: 'Write the solution',
      d: 'The editor is the one from VS Code, sitting next to the statement. Drag the divider and give each side the room you want. Everything here is built to keep you comfortable while you write.',
    },
    {
      t: 'Send it to the judge',
      d: 'An answer comes back in seconds: the verdict, the time it ran, the memory it took.',
    },
    {
      t: 'Move the rating',
      d: 'When the round ends you get your rating, and your place on the global leaderboard moves.',
    },
  ],

  solo: {
    eyebrow: 'Solo practice',
    title:
      'You do not have to race, and you do not have to compete with anyone.',
    body: 'Open the catalogue and take whatever you like: filter by tag, by difficulty, or go straight for the problem the fewest people have solved. Nothing is timed, nothing is rated, nobody is watching. What matters in programming is regularity: take the daily challenge and beat your own record for days in a row.',
    note: 'For an interview, for an olympiad, or just to keep your hands warm.',
    // Sorted by the share of attempts that pass, hardest first — the view the
    // copy points at.
    catalogue: [
      {
        id: 512,
        title: 'Minimum Spanning Forest',
        tags: ['graphs', 'dsu'],
        difficulty: 'Hard',
        acceptance: 12.8,
      },
      {
        id: 337,
        title: 'Palindromic Partitions',
        tags: ['dp', 'strings'],
        difficulty: 'Hard',
        acceptance: 19.5,
      },
      {
        id: 128,
        title: 'Segment Sum Queries',
        tags: ['segment tree'],
        difficulty: 'Medium',
        acceptance: 34.2,
      },
      {
        id: 61,
        title: 'Balanced Brackets',
        tags: ['stack'],
        difficulty: 'Easy',
        acceptance: 58.9,
      },
      {
        id: 12,
        title: 'Two Sum',
        tags: ['hash map'],
        difficulty: 'Easy',
        acceptance: 71.3,
      },
    ],
  },

  // Global rating — the order is 2nd / 1st / 3rd; CSS puts them on the podium.
  podium: [
    coder(2, 'quantumlynx', 'QL', 2571),
    coder(1, 'hexraven', 'HR', 2603),
    coder(3, 'eulergate', 'EG', 2498),
  ],
  table: [
    coder(4, 'dijkstraflux', 'DF', 2388, 28),
    coder(5, 'voidwolf', 'VW', 2301, -12),
    coder(6, 'cipherzero', 'CZ', 2246, 44),
    coder(7, 'modulowave', 'MW', 2174, 9),
    coder(8, 'gaussnode', 'GN', 2088, -31),
    coder(9, 'heapifyx', 'HX', 2015, 17),
    coder(214, 'n3ptune', 'NP', 1863, 35, true),
  ],
  ladder: CG_RANKS,

  // What the judge does, told at the level a visitor needs. How the sandbox is
  // locked down is deliberately not spelled out here.
  judge: [
    { icon: 'cpu', t: 'Your code runs in an isolated sandbox.' },
    {
      icon: 'clock',
      t: 'Every problem carries its own time and memory limit, and the run is cut off the moment it goes past.',
    },
    {
      icon: 'list',
      t: 'Submissions line up in a queue and wait their turn. If the judge goes down mid-run, the queue is picked back up instead of lost.',
    },
    { icon: 'flag', t: 'Full verdict set: AC, WA, TLE, MLE, OLE, RE, CE.' },
  ],

  faq: [
    {
      q: 'Does Codegard cost anything?',
      a: 'No. Every problem, every contest and the rating are open to everyone. All you need is an account.',
    },
    {
      q: 'Which language can I submit?',
      a: 'Python for now. We are working on more, so your favourite will most likely be here soon.',
    },
    {
      q: 'How is a contest scored?',
      a: 'A solved problem is worth 100 points, whichever problem it is. When two people finish level, the smaller penalty wins: the minutes from the start of the round to each of your accepted solutions, plus ten minutes for every rejected try on the way there.',
    },
    {
      q: 'How does my rating change?',
      a: 'Every account starts at 1200. A rated contest recomputes it when the round closes, from how you placed against everyone else in it. Solving outside a contest never moves it.',
    },
    {
      q: 'What do the verdicts mean?',
      a: 'AC every test passed. WA the answer was wrong. TLE too slow. MLE too much memory. OLE the output was too large. RE the program crashed. CE it did not compile.',
    },
  ],
};

export default landingContent;
