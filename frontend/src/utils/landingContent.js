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
    sub: 'Timed contests with a live leaderboard. Every submission gets a verdict in seconds.',
    note: 'No card, no trial. Nothing here is paid for.',
  },

  // Live contest board. Points are 100 per solved problem, so the board moves
  // a whole problem at a time; the penalty is in minutes, counted from the
  // start of the round.
  contest: {
    name: 'Div. 2 · Round 418',
    lengthSeconds: 3 * 3600,
    secondsLeft: 1 * 3600 + 23 * 60 + 45,
    problems: [
      { id: 'A', state: 'solved' },
      { id: 'B', state: 'solved' },
      { id: 'C', state: 'cur' },
      { id: 'D', state: 'att' },
      { id: 'E', state: '' },
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

  steps: [
    {
      t: 'Pick a problem',
      d: 'Statement, limits, samples and tags on one screen. Filter the catalogue by tag or by difficulty.',
    },
    {
      t: 'Write the solution',
      d: 'The editor sits next to the statement, with the sample cases in reach.',
    },
    {
      t: 'Submit to the judge',
      d: 'One verdict comes back, with the runtime and the memory it took.',
    },
    {
      t: 'Move the rating',
      d: 'Every rated contest recomputes your rating and your place in the global ladder.',
    },
  ],

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

  judge: [
    { icon: 'cpu', t: 'Every run happens in an isolated sandbox.' },
    { icon: 'clock', t: 'Each problem carries its own time and memory limit.' },
    { icon: 'flag', t: 'Full verdict set: AC, WA, TLE, MLE, OLE, RE, CE.' },
    {
      icon: 'trophy',
      t: 'Contest standings update live; the rating is recomputed when the round closes.',
    },
  ],

  faq: [
    {
      q: 'Does Codegard cost anything?',
      a: 'No. Every problem, every contest and the rating are open to every account.',
    },
    {
      q: 'Which language can I submit?',
      a: 'Python. Every submission runs in its own sandbox, under the time and memory limit the problem sets.',
    },
    {
      q: 'How is a contest scored?',
      a: 'A solved problem is worth 100 points, whichever problem it is. Ties are broken by penalty: the minutes from the start of the round to each accepted solution, plus ten minutes for every wrong attempt on a problem you go on to solve.',
    },
    {
      q: 'How does my rating change?',
      a: 'Every account starts at 1200. A rated contest recomputes it when the round closes, from how you placed against everyone else in it. Solving outside a contest never moves it.',
    },
    {
      q: 'What comes back from the judge?',
      a: 'One verdict for the submission, with the runtime and the memory it used. Accepted means every test passed, including the ones you cannot see.',
    },
    {
      q: 'Do I need to install anything?',
      a: 'No. The editor and the judge both live in the browser.',
    },
  ],
};

export default landingContent;
